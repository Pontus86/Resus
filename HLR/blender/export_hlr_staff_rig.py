"""Exportera HLR-personriggens ben och lågpolymeshar till vanlig JavaScript."""

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
REQUIRED_BONES = {
    "pelvis", "spine", "neck", "head",
    "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
    "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
}


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
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if args:
        return Path(args[0]).expanduser().resolve()
    return Path(bpy.data.filepath).resolve().parent.parent / "js" / "room3d-staff-rig-data.js"


def find_armature():
    candidates = [obj for obj in bpy.data.objects if obj.get("hlr_staff_rig")]
    if len(candidates) != 1:
        raise RuntimeError(f"Förväntade exakt en HLR-personrigg, hittade {len(candidates)}")
    return candidates[0]


def export_bones(armature):
    bones = {}
    world_matrices = {}
    for bone in armature.data.bones:
        # Runtimebenen använder HLR-rummets globala axlar. Blenders bone-roll hör till
        # redigeringsverktyget och skulle annars göra poseaxlarna svåra att förutsäga.
        head_world = armature.matrix_world @ bone.head_local
        head_three = BLENDER_TO_THREE @ head_world.to_4d()
        world_matrices[bone.name] = Matrix.Translation(head_three.to_3d())
    missing = REQUIRED_BONES - world_matrices.keys()
    if missing:
        raise RuntimeError("Personriggen saknar ben: " + ", ".join(sorted(missing)))
    for bone in armature.data.bones:
        world = world_matrices[bone.name]
        local = world_matrices[bone.parent.name].inverted() @ world if bone.parent else world
        bones[bone.name] = {
            "parent": bone.parent.name if bone.parent else None,
            **transform_payload(local),
        }
    return dict(sorted(bones.items())), world_matrices


def mesh_geometry(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        positions = []
        for vertex in mesh.vertices:
            positions.extend(clean_vector(vertex.co))
        indices = []
        for triangle in mesh.loop_triangles:
            indices.extend(int(index) for index in triangle.vertices)
        return positions, indices
    finally:
        evaluated.to_mesh_clear()


def export_meshes(armature, bone_world):
    result = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        bone_name = obj.get("hlr_bone")
        if not bone_name:
            continue
        if bone_name not in bone_world:
            raise RuntimeError(f"Meshen {obj.name} hänvisar till okänt ben {bone_name}")
        positions, indices = mesh_geometry(obj, depsgraph)
        object_world = convert_matrix(obj.matrix_world)
        local = bone_world[bone_name].inverted() @ object_world
        result.append({
            "name": obj.name,
            "bone": bone_name,
            "material": obj.get("hlr_material", "scrub"),
            **transform_payload(local),
            "positions": positions,
            "indices": indices,
        })
    if not result:
        raise RuntimeError("Personriggen saknar exporterbara meshar")
    return result


def main():
    armature = find_armature()
    bones, bone_world = export_bones(armature)
    payload = {
        "version": 1,
        "bones": bones,
        "meshes": export_meshes(armature, bone_world),
    }
    destination = output_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    text = (
        "/* Genererad från HLR/blender/hlr-staff-rig.blend. Kör export_hlr_staff_rig.py. */\n"
        f"window.HLR_STAFF_RIG={encoded};\n"
    )
    destination.write_text(text, encoding="utf-8", newline="\n")
    print(f"HLR-personrigg exporterad: {destination}")


if __name__ == "__main__":
    main()
