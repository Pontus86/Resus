#!/usr/bin/env python3
"""Dependency-free MCP-brygga till det allowlistade Resus-tillägget i Blender."""

from __future__ import annotations

import argparse
import base64
import json
import math
import socket
import struct
import sys
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-06-18"
SERVER_NAME = "resus-blender"
SERVER_VERSION = "1.0.0"
MAX_FRAME_BYTES = 12 * 1024 * 1024
DEFAULT_TIMEOUT = 20.0
LONG_COMMAND_TIMEOUT = 180.0
LONG_COMMANDS = {"export_current", "render_preview", "save_scene"}


class BridgeError(RuntimeError):
    pass


def _array_schema(description: str, *, minimum: float, maximum: float) -> dict[str, Any]:
    return {
        "type": "array",
        "description": description,
        "items": {"type": "number", "minimum": minimum, "maximum": maximum},
        "minItems": 3,
        "maxItems": 3,
    }


TOOLS: tuple[dict[str, Any], ...] = (
    {
        "name": "resus_blender_status",
        "description": "Kontrollera anslutningen och den öppna, tillåtna Resus-scenen.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "resus_blender_list_objects",
        "description": "Lista namngivna objekt och deras transform i den öppna Blender-scenen.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name_contains": {"type": "string", "maxLength": 120},
                "object_type": {
                    "type": "string",
                    "enum": ["ARMATURE", "CAMERA", "EMPTY", "LIGHT", "MESH"],
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 500},
            },
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "resus_blender_get_object",
        "description": "Läs transform, material, modifierare och relevanta riggdata för ett objekt.",
        "inputSchema": {
            "type": "object",
            "properties": {"name": {"type": "string", "minLength": 1, "maxLength": 160}},
            "required": ["name"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "resus_blender_select_object",
        "description": "Markera ett namngivet objekt i Blender utan att ändra dess geometri.",
        "inputSchema": {
            "type": "object",
            "properties": {"name": {"type": "string", "minLength": 1, "maxLength": 160}},
            "required": ["name"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "resus_blender_set_transform",
        "description": "Sätt eller förskjut position, Euler-rotation i grader och skala för ett objekt.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 160},
                "mode": {"type": "string", "enum": ["absolute", "delta"], "default": "absolute"},
                "location": _array_schema("Blender-X/Y/Z.", minimum=-1000, maximum=1000),
                "rotation_degrees": _array_schema(
                    "Euler-X/Y/Z i grader.", minimum=-3600, maximum=3600
                ),
                "scale": _array_schema("Skala X/Y/Z.", minimum=0.001, maximum=100),
            },
            "required": ["name"],
            "anyOf": [
                {"required": ["location"]},
                {"required": ["rotation_degrees"]},
                {"required": ["scale"]},
            ],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
    },
    {
        "name": "resus_blender_set_visibility",
        "description": "Visa eller dölj ett objekt i viewport och/eller rendering.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 160},
                "viewport_visible": {"type": "boolean"},
                "render_visible": {"type": "boolean"},
            },
            "required": ["name"],
            "anyOf": [{"required": ["viewport_visible"]}, {"required": ["render_visible"]}],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "resus_blender_set_material",
        "description": "Ändra endast befintligt materials basfärg, metallic eller roughness.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {"type": "string", "minLength": 1, "maxLength": 160},
                "material_name": {"type": "string", "maxLength": 160},
                "base_color": {
                    "type": "array",
                    "items": {"type": "number", "minimum": 0, "maximum": 1},
                    "minItems": 3,
                    "maxItems": 4,
                },
                "metallic": {"type": "number", "minimum": 0, "maximum": 1},
                "roughness": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["object_name"],
            "anyOf": [
                {"required": ["base_color"]},
                {"required": ["metallic"]},
                {"required": ["roughness"]},
            ],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "resus_blender_list_actions",
        "description": "Lista sparade Actions och armaturer i den öppna scenen.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "resus_blender_apply_action",
        "description": "Applicera en befintlig Action på en namngiven armatur eller återställ posen.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "armature_name": {"type": "string", "minLength": 1, "maxLength": 160},
                "action_name": {"type": ["string", "null"], "maxLength": 160},
                "frame": {"type": "number", "minimum": -100000, "maximum": 100000},
            },
            "required": ["armature_name", "action_name"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
    },
    {
        "name": "resus_blender_render_preview",
        "description": "Rendera den aktiva kameran och returnera en PNG utan beständig scenändring.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "width": {"type": "integer", "minimum": 160, "maximum": 1600},
                "height": {"type": "integer", "minimum": 120, "maximum": 1200},
                "samples": {"type": "integer", "minimum": 1, "maximum": 128},
            },
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False},
    },
    {
        "name": "resus_blender_save_scene",
        "description": (
            "Spara en tidsstämplad säkerhetskopia, eller skriv käll-.blend endast med "
            "confirm_source_save=true."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {"type": "string", "enum": ["snapshot", "source"], "default": "snapshot"},
                "confirm_source_save": {"type": "boolean", "default": False},
            },
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
    },
    {
        "name": "resus_blender_export_current",
        "description": (
            "Kör endast den spårade exporterare som hör till den öppna HLR-.blend-filen. "
            "Scenen måste vara sparad först."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"confirm_export": {"type": "boolean"}},
            "required": ["confirm_export"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
    },
)

TOOL_COMMANDS = {
    "resus_blender_status": "status",
    "resus_blender_list_objects": "list_objects",
    "resus_blender_get_object": "get_object",
    "resus_blender_select_object": "select_object",
    "resus_blender_set_transform": "set_transform",
    "resus_blender_set_visibility": "set_visibility",
    "resus_blender_set_material": "set_material",
    "resus_blender_list_actions": "list_actions",
    "resus_blender_apply_action": "apply_action",
    "resus_blender_render_preview": "render_preview",
    "resus_blender_save_scene": "save_scene",
    "resus_blender_export_current": "export_current",
}


def _require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise BridgeError(f"{label} måste vara ett JSON-objekt.")
    return value


def _validate_finite(value: Any, label: str) -> None:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)) and not math.isfinite(float(value)):
        raise BridgeError(f"{label} får inte innehålla NaN eller infinity.")
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_finite(item, f"{label}[{index}]")
    if isinstance(value, dict):
        for key, item in value.items():
            _validate_finite(item, f"{label}.{key}")


def _read_exact(stream: socket.socket, length: int) -> bytes:
    chunks = bytearray()
    while len(chunks) < length:
        chunk = stream.recv(length - len(chunks))
        if not chunk:
            raise BridgeError("Blender stängde anslutningen innan svaret var komplett.")
        chunks.extend(chunk)
    return bytes(chunks)


class BlenderBridge:
    def __init__(self, root: Path, timeout: float = DEFAULT_TIMEOUT):
        self.root = root.resolve()
        self.socket_path = self.root / ".agent-state" / "resus-blender.sock"
        self.timeout = timeout

    def call(self, command: str, arguments: dict[str, Any]) -> dict[str, Any]:
        _validate_finite(arguments, "arguments")
        if not self.socket_path.exists():
            raise BridgeError(
                "Resus Blender-tillägget är inte startat för denna arbetskopia. "
                "Öppna en HLR .blend-fil och klicka Starta i panelen Resus MCP."
            )
        request = json.dumps(
            {"version": 1, "command": command, "arguments": arguments},
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(request) > MAX_FRAME_BYTES:
            raise BridgeError("Begäran är för stor.")
        timeout = LONG_COMMAND_TIMEOUT if command in LONG_COMMANDS else self.timeout
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.settimeout(timeout)
                client.connect(str(self.socket_path))
                client.sendall(struct.pack(">I", len(request)) + request)
                response_length = struct.unpack(">I", _read_exact(client, 4))[0]
                if response_length > MAX_FRAME_BYTES:
                    raise BridgeError("Blender-svaret överskrider säkerhetsgränsen.")
                response = json.loads(_read_exact(client, response_length).decode("utf-8"))
        except (OSError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            raise BridgeError(f"Kan inte kommunicera med Blender: {exc}") from exc
        response = _require_object(response, "Blender-svaret")
        if not response.get("ok"):
            raise BridgeError(str(response.get("error") or "Blender avvisade kommandot."))
        return _require_object(response.get("result", {}), "result")


def _tool_result(result: dict[str, Any]) -> dict[str, Any]:
    image_data = result.pop("image_base64", None)
    mime_type = result.pop("mime_type", "image/png")
    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True),
        }
    ]
    if image_data is not None:
        try:
            base64.b64decode(image_data, validate=True)
        except (ValueError, TypeError) as exc:
            raise BridgeError("Blender returnerade ogiltiga bilddata.") from exc
        content.append({"type": "image", "data": image_data, "mimeType": mime_type})
    return {"content": content, "structuredContent": result, "isError": False}


def _error_result(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "isError": True}


def handle_request(message: dict[str, Any], bridge: BlenderBridge) -> dict[str, Any] | None:
    request_id = message.get("id")
    method = message.get("method")
    if request_id is None:
        return None
    if method == "initialize":
        params = _require_object(message.get("params", {}), "params")
        requested = params.get("protocolVersion")
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": requested if isinstance(requested, str) else PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        }
    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": list(TOOLS)}}
    if method == "tools/call":
        params = _require_object(message.get("params", {}), "params")
        tool_name = params.get("name")
        arguments = _require_object(params.get("arguments", {}), "arguments")
        command = TOOL_COMMANDS.get(tool_name)
        if command is None:
            result = _error_result(f"Okänt Resus Blender-verktyg: {tool_name!r}")
        else:
            try:
                result = _tool_result(bridge.call(command, dict(arguments)))
            except BridgeError as exc:
                result = _error_result(str(exc))
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"Metoden stöds inte: {method!r}"},
    }


def serve(root: Path) -> int:
    bridge = BlenderBridge(root)
    for raw_line in sys.stdin.buffer:
        try:
            message = json.loads(raw_line)
            message = _require_object(message, "MCP-meddelandet")
            response = handle_request(message, bridge)
        except (BridgeError, json.JSONDecodeError) as exc:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": str(exc)},
            }
        if response is not None:
            encoded = json.dumps(
                response, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            sys.stdout.buffer.write(encoded + b"\n")
            sys.stdout.buffer.flush()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Säker, allowlistad MCP-brygga till Resus Blender-tillägg."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Resus-arbetskopians rot (standard: roten som innehåller detta skript).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    if not (root / "HLR" / "blender").is_dir() or not (root / ".mcp.json").is_file():
        print(f"Ogiltig Resus-rot: {root}", file=sys.stderr)
        return 2
    return serve(root)


if __name__ == "__main__":
    raise SystemExit(main())
