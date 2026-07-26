from __future__ import annotations

import ast
import base64
import json
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import resus_blender_mcp as mcp  # noqa: E402


def read_exact(connection: socket.socket, length: int) -> bytes:
    data = bytearray()
    while len(data) < length:
        chunk = connection.recv(length - len(data))
        if not chunk:
            raise RuntimeError("connection closed")
        data.extend(chunk)
    return bytes(data)


class FakeBlender:
    def __init__(self, root: Path, result: dict | None = None):
        self.socket_path = root / ".agent-state" / "resus-blender.sock"
        self.socket_path.parent.mkdir(parents=True)
        self.result = result or {"connected": True, "blend_file": "HLR/blender/test.blend"}
        self.request: dict | None = None
        self.ready = threading.Event()
        self.thread = threading.Thread(target=self._serve, daemon=True)

    def __enter__(self):
        self.thread.start()
        if not self.ready.wait(timeout=2):
            raise RuntimeError("fake Blender did not start")
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.thread.join(timeout=2)
        self.socket_path.unlink(missing_ok=True)

    def _serve(self):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
            listener.bind(str(self.socket_path))
            listener.listen(1)
            self.ready.set()
            connection, _address = listener.accept()
            with connection:
                length = struct.unpack(">I", read_exact(connection, 4))[0]
                self.request = json.loads(read_exact(connection, length))
                encoded = json.dumps({"ok": True, "result": self.result}).encode()
                connection.sendall(struct.pack(">I", len(encoded)) + encoded)


class TemporaryRoot:
    def __init__(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name)
        (self.path / "HLR" / "blender").mkdir(parents=True)
        (self.path / ".mcp.json").write_text("{}\n", encoding="utf-8")

    def cleanup(self):
        self.temporary.cleanup()


class SchemaTests(unittest.TestCase):
    def test_tool_names_are_unique_and_mapped(self):
        names = [tool["name"] for tool in mcp.TOOLS]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(set(names), set(mcp.TOOL_COMMANDS))
        self.assertTrue(all(tool["inputSchema"]["type"] == "object" for tool in mcp.TOOLS))

    def test_sensitive_tools_require_explicit_confirmation(self):
        tools = {tool["name"]: tool for tool in mcp.TOOLS}
        export_schema = tools["resus_blender_export_current"]["inputSchema"]
        self.assertIn("confirm_export", export_schema["required"])
        save_schema = tools["resus_blender_save_scene"]["inputSchema"]
        self.assertIn("confirm_source_save", save_schema["properties"])

    def test_initialize_and_unknown_method(self):
        temporary = TemporaryRoot()
        self.addCleanup(temporary.cleanup)
        bridge = mcp.BlenderBridge(temporary.path)
        initialized = mcp.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"protocolVersion": "2025-03-26"},
            },
            bridge,
        )
        self.assertEqual(initialized["result"]["protocolVersion"], "2025-03-26")
        self.assertEqual(initialized["result"]["serverInfo"]["name"], "resus-blender")
        unknown = mcp.handle_request(
            {"jsonrpc": "2.0", "id": 2, "method": "resources/list"}, bridge
        )
        self.assertEqual(unknown["error"]["code"], -32601)

    def test_notification_has_no_response(self):
        temporary = TemporaryRoot()
        self.addCleanup(temporary.cleanup)
        response = mcp.handle_request(
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            mcp.BlenderBridge(temporary.path),
        )
        self.assertIsNone(response)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.root = TemporaryRoot()

    def tearDown(self):
        self.root.cleanup()

    def test_length_prefixed_round_trip(self):
        with FakeBlender(self.root.path) as fake:
            result = mcp.BlenderBridge(self.root.path).call(
                "set_transform", {"name": "doctor", "location": [1, 2, 3]}
            )
        self.assertTrue(result["connected"])
        self.assertEqual(fake.request["version"], 1)
        self.assertEqual(fake.request["command"], "set_transform")
        self.assertEqual(fake.request["arguments"]["name"], "doctor")

    def test_missing_socket_is_clear(self):
        with self.assertRaisesRegex(mcp.BridgeError, "inte startat"):
            mcp.BlenderBridge(self.root.path).call("status", {})

    def test_non_finite_arguments_are_rejected_before_transport(self):
        with self.assertRaisesRegex(mcp.BridgeError, "NaN"):
            mcp.BlenderBridge(self.root.path).call(
                "set_transform", {"location": [float("nan"), 0, 0]}
            )

    def test_image_response_is_validated_and_forwarded(self):
        image = base64.b64encode(b"png").decode("ascii")
        with FakeBlender(
            self.root.path,
            {"width": 10, "height": 10, "image_base64": image, "mime_type": "image/png"},
        ):
            response = mcp.handle_request(
                {
                    "jsonrpc": "2.0",
                    "id": 4,
                    "method": "tools/call",
                    "params": {
                        "name": "resus_blender_render_preview",
                        "arguments": {"width": 160, "height": 120},
                    },
                },
                mcp.BlenderBridge(self.root.path),
            )
        content = response["result"]["content"]
        self.assertEqual([item["type"] for item in content], ["text", "image"])
        self.assertNotIn("image_base64", response["result"]["structuredContent"])

    def test_unknown_tool_is_an_mcp_tool_error(self):
        response = mcp.handle_request(
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {"name": "execute_python", "arguments": {}},
            },
            mcp.BlenderBridge(self.root.path),
        )
        self.assertTrue(response["result"]["isError"])
        self.assertIn("Okänt", response["result"]["content"][0]["text"])


class StdioIntegrationTests(unittest.TestCase):
    def test_server_lists_tools_and_calls_fake_blender(self):
        root = TemporaryRoot()
        self.addCleanup(root.cleanup)
        with FakeBlender(root.path):
            process = subprocess.run(
                [
                    sys.executable,
                    str(REPO_ROOT / "scripts" / "resus_blender_mcp.py"),
                    "--root",
                    str(root.path),
                ],
                input=(
                    json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": "initialize",
                            "params": {"protocolVersion": mcp.PROTOCOL_VERSION},
                        }
                    )
                    + "\n"
                    + json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": 2,
                            "method": "tools/call",
                            "params": {
                                "name": "resus_blender_status",
                                "arguments": {},
                            },
                        }
                    )
                    + "\n"
                ),
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
                check=True,
            )
        responses = [json.loads(line) for line in process.stdout.splitlines()]
        self.assertEqual(responses[0]["result"]["serverInfo"]["name"], "resus-blender")
        self.assertFalse(responses[1]["result"]["isError"])
        self.assertTrue(responses[1]["result"]["structuredContent"]["connected"])
        self.assertEqual(process.stderr, "")


class SecurityContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.addon_path = REPO_ROOT / "HLR" / "blender" / "resus_blender_mcp_addon.py"
        cls.source = cls.addon_path.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source)

    def test_addon_has_no_network_or_process_modules(self):
        forbidden = {"requests", "subprocess", "urllib", "http", "ftplib"}
        imports = {
            alias.name.split(".")[0]
            for node in ast.walk(self.tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        imports.update(
            node.module.split(".")[0]
            for node in ast.walk(self.tree)
            if isinstance(node, ast.ImportFrom) and node.module
        )
        self.assertTrue(forbidden.isdisjoint(imports))
        self.assertNotIn("AF_INET", self.source)

    def test_addon_has_no_free_eval_or_exec(self):
        called_names = {
            node.func.id
            for node in ast.walk(self.tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        self.assertNotIn("eval", called_names)
        self.assertNotIn("exec", called_names)
        self.assertEqual(self.source.count("runpy.run_path("), 1)

    def test_exporters_are_literal_allowlist(self):
        expected = {
            "hlr-room.blend",
            "hlr-staff-rig.blend",
            "hlr-patient-rig.blend",
            "hlr-equipment-details.blend",
        }
        assignment = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "EXPORTERS" for target in node.targets)
        )
        exporters = ast.literal_eval(assignment.value)
        self.assertEqual(set(exporters), expected)

    def test_project_mcp_config_uses_local_standard_library_server(self):
        config = json.loads((REPO_ROOT / ".mcp.json").read_text(encoding="utf-8"))
        server = config["mcpServers"]["resus-blender"]
        self.assertEqual(server["command"], "python3")
        self.assertEqual(server["args"], ["scripts/resus_blender_mcp.py"])
        self.assertNotIn("env", server)


if __name__ == "__main__":
    unittest.main()
