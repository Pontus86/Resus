"""Exportera HLR-rummets redigerbara Blender-transformer till vanlig JavaScript.

Kör från reporoten:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    HLR/blender/hlr-room.blend --python HLR/blender/export_hlr_layout.py
"""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix


REQUIRED_ROLES = {
    "bed",
    "patient",
    "lucas",
    "doctor",
    "nurse_ssk",
    "compressor",
    "airway_staff",
    "ambulance",
    "narkos_ssk",
    "surgeon",
    "crash_cart",
    "defib",
    "ultrasound",
    "ventilator",
    "iv_pole",
    "o2_cyl",
    "sink",
    "computer",
    "stool",
    "monitor_wall",
    "gas_panel",
    "sign",
    "wall_clock",
    "ceiling_light_left",
    "ceiling_light_right",
}

# Blender: X höger, Y bort från kameran, Z upp.
# Three.js: X höger, Y upp, Z mot kameran.
BLENDER_TO_THREE = Matrix(
    (
        (1.0, 0.0, 0.0, 0.0),
        (0.0, 0.0, 1.0, 0.0),
        (0.0, -1.0, 0.0, 0.0),
        (0.0, 0.0, 0.0, 1.0),
    )
)


def clean_number(value):
    rounded = round(float(value), 6)
    return 0 if abs(rounded) < 0.0000005 else rounded


def clean_vector(values):
    return [clean_number(value) for value in values]


def three_matrix(obj):
    return BLENDER_TO_THREE @ obj.matrix_world @ BLENDER_TO_THREE.inverted()


def export_transform(obj):
    location, rotation, scale = three_matrix(obj).decompose()
    return {
        "position": clean_vector(location),
        "quaternion": clean_vector((rotation.x, rotation.y, rotation.z, rotation.w)),
        "scale": clean_vector(scale),
    }


def three_position(obj):
    location = three_matrix(obj).to_translation()
    return clean_vector(location)


def output_path():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if args:
        return Path(args[0]).expanduser().resolve()
    blend_path = Path(bpy.data.filepath).resolve()
    return blend_path.parent.parent / "js" / "room3d-layout-data.js"


def build_layout():
    objects = {}
    for obj in bpy.data.objects:
        role = obj.get("hlr_role")
        if role:
            if role in objects:
                raise RuntimeError(f"Duplicerad HLR-roll i Blender-scenen: {role}")
            objects[role] = export_transform(obj)

    missing = sorted(REQUIRED_ROLES - objects.keys())
    if missing:
        raise RuntimeError("Blender-scenen saknar HLR-roller: " + ", ".join(missing))

    lights = {}
    for obj in bpy.data.objects:
        role = obj.get("hlr_light_role")
        if not role:
            continue
        target_name = obj.get("hlr_target")
        target = bpy.data.objects.get(target_name)
        if not target:
            raise RuntimeError(f"Spotlight {role} saknar målobjektet {target_name}")
        lights[role] = {
            "position": three_position(obj),
            "target": three_position(target),
            "color": obj.data.color[:3],
            "intensity": clean_number(obj.get("hlr_intensity", 1)),
            "distance": clean_number(obj.get("hlr_distance", 15)),
            "angle": clean_number(obj.data.spot_size / 2),
            "penumbra": clean_number(obj.data.spot_blend),
            "decay": clean_number(obj.get("hlr_decay", 1.35)),
            "shadow": bool(obj.get("hlr_shadow", False)),
        }
        lights[role]["color"] = clean_vector(lights[role]["color"])

    camera = next((obj for obj in bpy.data.objects if obj.get("hlr_camera")), None)
    if not camera:
        raise RuntimeError("Blender-scenen saknar HLR-kamera")
    camera_target = bpy.data.objects.get(camera.get("hlr_target"))
    if not camera_target:
        raise RuntimeError("HLR-kamerans mål saknas")

    return {
        "version": 1,
        "objects": dict(sorted(objects.items())),
        "lights": dict(sorted(lights.items())),
        "camera": {
            "position": three_position(camera),
            "target": three_position(camera_target),
            "frustum": clean_number(camera.data.ortho_scale),
        },
    }


def main():
    destination = output_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(build_layout(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    text = (
        "/* Genererad från HLR/blender/hlr-room.blend. Redigera Blender-scenen och kör\n"
        "   export_hlr_layout.py i stället för att handredigera denna fil. */\n"
        f"window.HLR_ROOM3D_LAYOUT={payload};\n"
    )
    destination.write_text(text, encoding="utf-8", newline="\n")
    print(f"HLR-layout exporterad: {destination}")


if __name__ == "__main__":
    main()
