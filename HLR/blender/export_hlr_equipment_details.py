"""Exportera Blender-byggda apparatdetaljer till vanlig inbäddad JavaScript."""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix


BLENDER_TO_THREE = Matrix(
    (
        (1.0, 0.0, 0.0, 0.0),
        (0.0, 0.0, 1.0, 0.0),
        (0.0, -1.0, 0.0, 0.0),
        (0.0, 0.0, 0.0, 1.0),
    )
)
REQUIRED_ROLES = {"defib", "ultrasound", "ventilator", "lucas"}


def clean_number(value):
    rounded = round(float(value), 6)
    return 0 if abs(rounded) < 0.0000005 else rounded


def clean_vector(values):
    return [clean_number(value) for value in values]


def convert_matrix(matrix):
    return BLENDER_TO_THREE @ matrix @ BLENDER_TO_THREE.inverted()


def transform_payload(matrix):
    position, rotation, scale = matrix.decompose()
    return {
        "position": clean_vector(position),
        "quaternion": clean_vector((rotation.x, rotation.y, rotation.z, rotation.w)),
        "scale": clean_vector(scale),
    }


def output_path():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if args:
        return Path(args[0]).expanduser().resolve()
    return Path(bpy.data.filepath).resolve().parent.parent / "js" / "room3d-equipment-detail-data.js"


def mesh_geometry(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        positions = [number for vertex in mesh.vertices for number in clean_vector(vertex.co)]
        indices = [int(index) for triangle in mesh.loop_triangles for index in triangle.vertices]
        return positions, indices
    finally:
        evaluated.to_mesh_clear()


def main():
    roots = {
        obj.get("hlr_equipment_root"): obj
        for obj in bpy.data.objects
        if obj.get("hlr_equipment_root")
    }
    if REQUIRED_ROLES - roots.keys():
        raise RuntimeError("Utrustningsfilen saknar rotobjekt: " + ", ".join(sorted(REQUIRED_ROLES - roots.keys())))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    roles = {role: [] for role in sorted(REQUIRED_ROLES)}
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        role = obj.get("hlr_equipment_role")
        if role not in roles or obj.type != "MESH":
            continue
        positions, indices = mesh_geometry(obj, depsgraph)
        local = convert_matrix(obj.matrix_local)
        roles[role].append({
            "name": obj.get("hlr_part", obj.name),
            "material": obj.get("hlr_material", "dark"),
            **transform_payload(local),
            "positions": positions,
            "indices": indices,
        })
    if any(not meshes for meshes in roles.values()):
        raise RuntimeError("Minst en utrustningsroll saknar exporterbara detaljer")
    payload = {"version": 1, "roles": roles}
    destination = output_path()
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    destination.write_text(
        "/* Genererad från HLR/blender/hlr-equipment-details.blend. */\n"
        f"window.HLR_EQUIPMENT_DETAILS={encoded};\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"HLR-utrustningsdetaljer exporterade: {destination}")


if __name__ == "__main__":
    main()
