"""Allowlistat Blender-tillägg för Resus MCP.

Installera denna fil som Blender-tillägg. Den lyssnar endast på en användarskyddad
Unix-socket i den arbetskopia som äger den öppna HLR-scenen.
"""

from __future__ import annotations

import base64
import json
import math
import os
import queue
import runpy
import socket
import struct
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

import bpy


bl_info = {
    "name": "Resus Blender MCP",
    "author": "Resus",
    "version": (1, 0, 0),
    "blender": (4, 3, 0),
    "location": "3D View > Sidebar > Resus MCP",
    "description": "Allowlistad lokal MCP-styrning av spårade Resus-scener",
    "category": "Interface",
}

MAX_FRAME_BYTES = 12 * 1024 * 1024
SOCKET_NAME = "resus-blender.sock"
EXPORTERS = {
    "hlr-room.blend": "export_hlr_layout.py",
    "hlr-staff-rig.blend": "export_hlr_staff_rig.py",
    "hlr-patient-rig.blend": "export_hlr_patient_rig.py",
    "hlr-equipment-details.blend": "export_hlr_equipment_details.py",
}

_REQUESTS: queue.Queue[tuple[dict[str, Any], threading.Event, dict[str, Any]]] = queue.Queue()
_SERVER_THREAD: threading.Thread | None = None
_STOP_EVENT = threading.Event()
_LISTENER: socket.socket | None = None
_PROJECT_ROOT: Path | None = None
_SOCKET_PATH: Path | None = None
_STATUS = "Stoppad"


class ResusMcpError(RuntimeError):
    pass


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _discover_root() -> Path:
    if not bpy.data.filepath:
        raise ResusMcpError("Spara eller öppna först en spårad HLR .blend-fil.")
    blend_path = Path(bpy.data.filepath).resolve()
    for candidate in (blend_path.parent, *blend_path.parents):
        if (candidate / ".mcp.json").is_file() and (candidate / "HLR" / "blender").is_dir():
            allowed = (candidate / "HLR" / "blender").resolve()
            if blend_path.suffix.lower() != ".blend" or not _inside(blend_path, allowed):
                break
            return candidate.resolve()
    raise ResusMcpError("Den öppna filen ligger inte i Resus/HLR/blender.")


def _require_safe_scene() -> tuple[Path, Path]:
    root = _PROJECT_ROOT or _discover_root()
    blend_path = Path(bpy.data.filepath).resolve()
    allowed = (root / "HLR" / "blender").resolve()
    if blend_path.suffix.lower() != ".blend" or not _inside(blend_path, allowed):
        raise ResusMcpError("Kommandot får endast användas på HLR/blender/*.blend.")
    return root, blend_path


def _vector(values: Any, label: str, minimum: float, maximum: float) -> tuple[float, float, float]:
    if not isinstance(values, list) or len(values) != 3:
        raise ResusMcpError(f"{label} måste innehålla exakt tre tal.")
    result = tuple(float(value) for value in values)
    if any(not math.isfinite(value) or value < minimum or value > maximum for value in result):
        raise ResusMcpError(f"{label} ligger utanför tillåtet intervall.")
    return result


def _object(name: Any) -> bpy.types.Object:
    if not isinstance(name, str) or not name or len(name) > 160:
        raise ResusMcpError("Objektnamnet är ogiltigt.")
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ResusMcpError(f"Objektet finns inte: {name}")
    return obj


def _clean_number(value: float) -> float:
    rounded = round(float(value), 6)
    return 0.0 if abs(rounded) < 0.0000005 else rounded


def _clean_vector(values: Any) -> list[float]:
    return [_clean_number(value) for value in values]


def _transform(obj: bpy.types.Object) -> dict[str, Any]:
    return {
        "location": _clean_vector(obj.location),
        "rotation_degrees": _clean_vector(math.degrees(value) for value in obj.rotation_euler),
        "scale": _clean_vector(obj.scale),
    }


def _object_summary(obj: bpy.types.Object) -> dict[str, Any]:
    return {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "collections": sorted(collection.name for collection in obj.users_collection),
        "viewport_visible": not obj.hide_viewport,
        "render_visible": not obj.hide_render,
        **_transform(obj),
    }


def _status() -> dict[str, Any]:
    root, blend_path = _require_safe_scene()
    return {
        "connected": True,
        "project_root": str(root),
        "blend_file": str(blend_path.relative_to(root)),
        "dirty": bool(bpy.data.is_dirty),
        "objects": len(bpy.data.objects),
        "actions": len(bpy.data.actions),
        "active_object": bpy.context.view_layer.objects.active.name
        if bpy.context.view_layer.objects.active
        else None,
        "socket": str((_SOCKET_PATH or root / ".agent-state" / SOCKET_NAME).relative_to(root)),
        "security": {
            "transport": "AF_UNIX",
            "arbitrary_python": False,
            "network_downloads": False,
            "scene_scope": "HLR/blender/*.blend",
        },
    }


def _list_objects(arguments: dict[str, Any]) -> dict[str, Any]:
    name_contains = str(arguments.get("name_contains", "")).casefold()
    object_type = arguments.get("object_type")
    limit = int(arguments.get("limit", 200))
    if limit < 1 or limit > 500:
        raise ResusMcpError("limit måste ligga mellan 1 och 500.")
    if object_type is not None and object_type not in {"ARMATURE", "CAMERA", "EMPTY", "LIGHT", "MESH"}:
        raise ResusMcpError("Objekttypen är inte tillåten.")
    matches = [
        obj
        for obj in sorted(bpy.data.objects, key=lambda item: item.name.casefold())
        if (not name_contains or name_contains in obj.name.casefold())
        and (not object_type or obj.type == object_type)
    ]
    return {
        "total_matches": len(matches),
        "truncated": len(matches) > limit,
        "objects": [_object_summary(obj) for obj in matches[:limit]],
    }


def _get_object(arguments: dict[str, Any]) -> dict[str, Any]:
    obj = _object(arguments.get("name"))
    result = _object_summary(obj)
    result.update(
        {
            "selected": obj.select_get(),
            "materials": [
                slot.material.name if slot.material else None for slot in obj.material_slots
            ],
            "modifiers": [
                {
                    "name": modifier.name,
                    "type": modifier.type,
                    "object": modifier.object.name
                    if hasattr(modifier, "object") and modifier.object
                    else None,
                }
                for modifier in obj.modifiers
            ],
            "custom_properties": {
                key: value
                for key, value in obj.items()
                if isinstance(value, (bool, float, int, str))
            },
        }
    )
    if obj.type == "MESH":
        result["mesh"] = {
            "vertices": len(obj.data.vertices),
            "edges": len(obj.data.edges),
            "polygons": len(obj.data.polygons),
        }
    elif obj.type == "ARMATURE":
        result["armature"] = {
            "bones": [bone.name for bone in obj.data.bones],
            "active_action": obj.animation_data.action.name
            if obj.animation_data and obj.animation_data.action
            else None,
        }
    return result


def _select_object(arguments: dict[str, Any]) -> dict[str, Any]:
    obj = _object(arguments.get("name"))
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return {"selected": obj.name}


def _set_transform(arguments: dict[str, Any]) -> dict[str, Any]:
    obj = _object(arguments.get("name"))
    mode = arguments.get("mode", "absolute")
    if mode not in {"absolute", "delta"}:
        raise ResusMcpError("mode måste vara absolute eller delta.")
    new_location = tuple(obj.location)
    new_rotation = tuple(obj.rotation_euler)
    new_scale = tuple(obj.scale)
    changed = False
    if "location" in arguments:
        values = _vector(arguments["location"], "location", -1000, 1000)
        new_location = (
            tuple(current + delta for current, delta in zip(obj.location, values))
            if mode == "delta"
            else values
        )
        changed = True
    if "rotation_degrees" in arguments:
        degrees = _vector(arguments["rotation_degrees"], "rotation_degrees", -3600, 3600)
        values = tuple(math.radians(value) for value in degrees)
        new_rotation = (
            tuple(current + delta for current, delta in zip(obj.rotation_euler, values))
            if mode == "delta"
            else values
        )
        changed = True
    if "scale" in arguments:
        values = _vector(arguments["scale"], "scale", 0.001, 100)
        new_scale = (
            tuple(current * factor for current, factor in zip(obj.scale, values))
            if mode == "delta"
            else values
        )
        changed = True
    if not changed:
        raise ResusMcpError("Minst en transform måste anges.")
    if (
        any(abs(value) > 1000 for value in new_location)
        or any(abs(math.degrees(value)) > 3600 for value in new_rotation)
        or any(value < 0.001 or value > 100 for value in new_scale)
    ):
        raise ResusMcpError("Den resulterande transformen ligger utanför säkerhetsgränsen.")
    obj.location = new_location
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = new_rotation
    obj.scale = new_scale
    bpy.context.view_layer.update()
    return _object_summary(obj)


def _set_visibility(arguments: dict[str, Any]) -> dict[str, Any]:
    obj = _object(arguments.get("name"))
    if "viewport_visible" not in arguments and "render_visible" not in arguments:
        raise ResusMcpError("Minst en synlighetsinställning måste anges.")
    if "viewport_visible" in arguments:
        obj.hide_viewport = not bool(arguments["viewport_visible"])
    if "render_visible" in arguments:
        obj.hide_render = not bool(arguments["render_visible"])
    return _object_summary(obj)


def _set_material(arguments: dict[str, Any]) -> dict[str, Any]:
    obj = _object(arguments.get("object_name"))
    requested_name = arguments.get("material_name")
    materials = [slot.material for slot in obj.material_slots if slot.material]
    material = (
        next((item for item in materials if item.name == requested_name), None)
        if requested_name
        else (materials[0] if len(materials) == 1 else None)
    )
    if material is None:
        raise ResusMcpError(
            "Ange ett befintligt material_name när objektet inte har exakt ett material."
        )
    changed = False
    if "base_color" in arguments:
        values = arguments["base_color"]
        if not isinstance(values, list) or len(values) not in {3, 4}:
            raise ResusMcpError("base_color måste innehålla tre eller fyra värden.")
        color = tuple(float(value) for value in values)
        if any(not math.isfinite(value) or value < 0 or value > 1 for value in color):
            raise ResusMcpError("base_color måste ligga mellan 0 och 1.")
        material.diffuse_color = (*color[:3], color[3] if len(color) == 4 else 1.0)
        changed = True
    for key in ("metallic", "roughness"):
        if key in arguments:
            value = float(arguments[key])
            if not math.isfinite(value) or value < 0 or value > 1:
                raise ResusMcpError(f"{key} måste ligga mellan 0 och 1.")
            setattr(material, key, value)
            changed = True
    if not changed:
        raise ResusMcpError("Minst en materialparameter måste anges.")
    return {
        "object": obj.name,
        "material": material.name,
        "base_color": _clean_vector(material.diffuse_color),
        "metallic": _clean_number(material.metallic),
        "roughness": _clean_number(material.roughness),
    }


def _list_actions() -> dict[str, Any]:
    return {
        "actions": sorted(action.name for action in bpy.data.actions),
        "armatures": [
            {
                "name": obj.name,
                "active_action": obj.animation_data.action.name
                if obj.animation_data and obj.animation_data.action
                else None,
            }
            for obj in sorted(bpy.data.objects, key=lambda item: item.name)
            if obj.type == "ARMATURE"
        ],
    }


def _apply_action(arguments: dict[str, Any]) -> dict[str, Any]:
    armature = _object(arguments.get("armature_name"))
    if armature.type != "ARMATURE":
        raise ResusMcpError("Objektet är inte en armatur.")
    action_name = arguments.get("action_name")
    armature.animation_data_create()
    if action_name is None:
        armature.animation_data.action = None
        for bone in armature.pose.bones:
            bone.matrix_basis.identity()
    else:
        if not isinstance(action_name, str) or len(action_name) > 160:
            raise ResusMcpError("Action-namnet är ogiltigt.")
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise ResusMcpError(f"Action finns inte: {action_name}")
        armature.animation_data.action = action
    frame = float(arguments.get("frame", 1))
    if not math.isfinite(frame) or frame < -100000 or frame > 100000:
        raise ResusMcpError("frame ligger utanför tillåtet intervall.")
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    bpy.context.view_layer.update()
    return {
        "armature": armature.name,
        "action": armature.animation_data.action.name if armature.animation_data.action else None,
        "frame": frame,
    }


def _render_preview(arguments: dict[str, Any]) -> dict[str, Any]:
    root, _blend_path = _require_safe_scene()
    scene = bpy.context.scene
    if scene.camera is None:
        raise ResusMcpError("Scenen saknar aktiv kamera.")
    width = int(arguments.get("width", 900))
    height = int(arguments.get("height", 680))
    samples = int(arguments.get("samples", 32))
    if not 160 <= width <= 1600 or not 120 <= height <= 1200 or not 1 <= samples <= 128:
        raise ResusMcpError("Renderinställningen ligger utanför säkerhetsgränsen.")
    runtime_dir = root / ".agent-state"
    runtime_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    old_values = (
        scene.render.filepath,
        scene.render.resolution_x,
        scene.render.resolution_y,
        scene.render.resolution_percentage,
        scene.render.image_settings.file_format,
        scene.render.image_settings.color_mode,
    )
    old_eevee_samples = (
        scene.eevee.taa_render_samples if hasattr(scene, "eevee") else None
    )
    old_cycles_samples = (
        scene.cycles.samples if hasattr(scene, "cycles") else None
    )
    render_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="resus-blender-", suffix=".png", dir=runtime_dir, delete=False
        ) as temporary:
            render_path = Path(temporary.name)
        scene.render.filepath = str(render_path)
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        if scene.render.engine == "BLENDER_EEVEE_NEXT" and old_eevee_samples is not None:
            scene.eevee.taa_render_samples = samples
        elif scene.render.engine == "CYCLES" and old_cycles_samples is not None:
            scene.cycles.samples = samples
        bpy.ops.render.render(write_still=True)
        encoded = base64.b64encode(render_path.read_bytes()).decode("ascii")
        return {
            "width": width,
            "height": height,
            "samples_requested": samples,
            "camera": scene.camera.name,
            "image_base64": encoded,
            "mime_type": "image/png",
        }
    finally:
        (
            scene.render.filepath,
            scene.render.resolution_x,
            scene.render.resolution_y,
            scene.render.resolution_percentage,
            scene.render.image_settings.file_format,
            scene.render.image_settings.color_mode,
        ) = old_values
        if old_eevee_samples is not None:
            scene.eevee.taa_render_samples = old_eevee_samples
        if old_cycles_samples is not None:
            scene.cycles.samples = old_cycles_samples
        if render_path is not None:
            render_path.unlink(missing_ok=True)


def _save_scene(arguments: dict[str, Any]) -> dict[str, Any]:
    root, blend_path = _require_safe_scene()
    mode = arguments.get("mode", "snapshot")
    if mode == "snapshot":
        snapshot_dir = root / ".agent-state" / "blender-snapshots"
        snapshot_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        destination = snapshot_dir / f"{blend_path.stem}-{timestamp}.blend"
        counter = 1
        while destination.exists():
            destination = snapshot_dir / f"{blend_path.stem}-{timestamp}-{counter}.blend"
            counter += 1
        bpy.ops.wm.save_as_mainfile(filepath=str(destination), copy=True, compress=True)
        return {"mode": "snapshot", "path": str(destination.relative_to(root))}
    if mode == "source":
        if arguments.get("confirm_source_save") is not True:
            raise ResusMcpError("Källfilssparning kräver confirm_source_save=true.")
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)
        return {"mode": "source", "path": str(blend_path.relative_to(root))}
    raise ResusMcpError("mode måste vara snapshot eller source.")


def _export_current(arguments: dict[str, Any]) -> dict[str, Any]:
    if arguments.get("confirm_export") is not True:
        raise ResusMcpError("Export kräver confirm_export=true.")
    root, blend_path = _require_safe_scene()
    if bpy.data.is_dirty:
        raise ResusMcpError("Scenen har osparade ändringar. Spara källfilen före export.")
    exporter_name = EXPORTERS.get(blend_path.name)
    if exporter_name is None:
        raise ResusMcpError("Den öppna scenen har ingen allowlistad exporterare.")
    exporter = (root / "HLR" / "blender" / exporter_name).resolve()
    allowed = (root / "HLR" / "blender").resolve()
    if not exporter.is_file() or not _inside(exporter, allowed):
        raise ResusMcpError("Den spårade exporteraren saknas eller ligger utanför tillåten mapp.")
    runpy.run_path(str(exporter), run_name="__main__")
    return {
        "blend_file": str(blend_path.relative_to(root)),
        "exporter": str(exporter.relative_to(root)),
        "completed": True,
    }


COMMANDS = {
    "status": lambda _arguments: _status(),
    "list_objects": _list_objects,
    "get_object": _get_object,
    "select_object": _select_object,
    "set_transform": _set_transform,
    "set_visibility": _set_visibility,
    "set_material": _set_material,
    "list_actions": lambda _arguments: _list_actions(),
    "apply_action": _apply_action,
    "render_preview": _render_preview,
    "save_scene": _save_scene,
    "export_current": _export_current,
}


def _handle_command(request: dict[str, Any]) -> dict[str, Any]:
    if request.get("version") != 1:
        raise ResusMcpError("Protokollversionen stöds inte.")
    command = request.get("command")
    arguments = request.get("arguments", {})
    if command not in COMMANDS or not isinstance(arguments, dict):
        raise ResusMcpError("Kommandot är inte allowlistat eller har ogiltiga argument.")
    _require_safe_scene()
    return COMMANDS[command](arguments)


def _read_exact(connection: socket.socket, length: int) -> bytes:
    data = bytearray()
    while len(data) < length:
        chunk = connection.recv(length - len(data))
        if not chunk:
            raise ResusMcpError("Klienten stängde anslutningen för tidigt.")
        data.extend(chunk)
    return bytes(data)


def _serve_connection(connection: socket.socket) -> None:
    try:
        length = struct.unpack(">I", _read_exact(connection, 4))[0]
        if length > MAX_FRAME_BYTES:
            raise ResusMcpError("Begäran överskrider säkerhetsgränsen.")
        request = json.loads(_read_exact(connection, length).decode("utf-8"))
        if not isinstance(request, dict):
            raise ResusMcpError("Begäran måste vara ett JSON-objekt.")
        completed = threading.Event()
        holder: dict[str, Any] = {}
        _REQUESTS.put((request, completed, holder))
        if not completed.wait(timeout=185):
            raise ResusMcpError("Blender hann inte slutföra kommandot.")
        response = holder["response"]
    except Exception as exc:
        response = {"ok": False, "error": str(exc)}
    encoded = json.dumps(response, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > MAX_FRAME_BYTES:
        encoded = json.dumps(
            {"ok": False, "error": "Svaret överskrider säkerhetsgränsen."},
            ensure_ascii=False,
        ).encode("utf-8")
    connection.sendall(struct.pack(">I", len(encoded)) + encoded)


def _server_loop(socket_path: Path) -> None:
    global _LISTENER, _STATUS
    try:
        socket_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if socket_path.exists():
            try:
                with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as probe:
                    probe.settimeout(0.2)
                    probe.connect(str(socket_path))
                raise ResusMcpError("En annan Resus MCP-server använder redan arbetskopian.")
            except (ConnectionRefusedError, FileNotFoundError, socket.timeout):
                socket_path.unlink(missing_ok=True)
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        _LISTENER = listener
        listener.bind(str(socket_path))
        os.chmod(socket_path, 0o600)
        listener.listen(4)
        listener.settimeout(0.5)
        _STATUS = f"Lyssnar: {socket_path.name}"
        while not _STOP_EVENT.is_set():
            try:
                connection, _address = listener.accept()
            except socket.timeout:
                continue
            with connection:
                connection.settimeout(190)
                _serve_connection(connection)
    except Exception as exc:
        _STATUS = f"Fel: {exc}"
    finally:
        if _LISTENER is not None:
            _LISTENER.close()
        _LISTENER = None
        socket_path.unlink(missing_ok=True)
        if not _STATUS.startswith("Fel:"):
            _STATUS = "Stoppad"


def _drain_requests() -> float:
    for _index in range(8):
        try:
            request, completed, holder = _REQUESTS.get_nowait()
        except queue.Empty:
            break
        try:
            holder["response"] = {"ok": True, "result": _handle_command(request)}
        except Exception as exc:
            holder["response"] = {"ok": False, "error": str(exc)}
        finally:
            completed.set()
    return 0.05 if _SERVER_THREAD and _SERVER_THREAD.is_alive() else 0.5


def start_server() -> None:
    global _PROJECT_ROOT, _SOCKET_PATH, _SERVER_THREAD, _STATUS
    if _SERVER_THREAD and _SERVER_THREAD.is_alive():
        raise ResusMcpError("Resus MCP är redan startad.")
    _PROJECT_ROOT = _discover_root()
    _SOCKET_PATH = _PROJECT_ROOT / ".agent-state" / SOCKET_NAME
    _STOP_EVENT.clear()
    _STATUS = "Startar…"
    _SERVER_THREAD = threading.Thread(
        target=_server_loop, args=(_SOCKET_PATH,), name="ResusBlenderMCP", daemon=True
    )
    _SERVER_THREAD.start()
    if not bpy.app.timers.is_registered(_drain_requests):
        bpy.app.timers.register(_drain_requests, first_interval=0.05, persistent=True)


def stop_server() -> None:
    global _SERVER_THREAD, _STATUS
    _STOP_EVENT.set()
    if _SERVER_THREAD:
        _SERVER_THREAD.join(timeout=1.5)
    _SERVER_THREAD = None
    _STATUS = "Stoppad"


class RESUSMCP_OT_start(bpy.types.Operator):
    bl_idname = "resus_mcp.start"
    bl_label = "Starta Resus MCP"
    bl_description = "Starta den lokala, allowlistade MCP-socketen för denna arbetskopia"

    def execute(self, _context):
        try:
            start_server()
        except ResusMcpError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, "Resus MCP startad")
        return {"FINISHED"}


class RESUSMCP_OT_stop(bpy.types.Operator):
    bl_idname = "resus_mcp.stop"
    bl_label = "Stoppa Resus MCP"

    def execute(self, _context):
        stop_server()
        self.report({"INFO"}, "Resus MCP stoppad")
        return {"FINISHED"}


class RESUSMCP_PT_panel(bpy.types.Panel):
    bl_label = "Resus MCP"
    bl_idname = "RESUSMCP_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Resus MCP"

    def draw(self, _context):
        layout = self.layout
        layout.label(text=_STATUS)
        row = layout.row(align=True)
        row.operator(RESUSMCP_OT_start.bl_idname, icon="PLAY")
        row.operator(RESUSMCP_OT_stop.bl_idname, icon="PAUSE")
        layout.separator()
        layout.label(text="Endast HLR/blender/*.blend")
        layout.label(text="Ingen fri kod eller nedladdning")


CLASSES = (RESUSMCP_OT_start, RESUSMCP_OT_stop, RESUSMCP_PT_panel)


def register():
    for item in CLASSES:
        bpy.utils.register_class(item)


def unregister():
    stop_server()
    if bpy.app.timers.is_registered(_drain_requests):
        bpy.app.timers.unregister(_drain_requests)
    for item in reversed(CLASSES):
        bpy.utils.unregister_class(item)


if __name__ == "__main__":
    register()
