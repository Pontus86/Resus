"""Exportera patientrigg, meshar och kliniska ankare till vanlig JavaScript."""

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
    "root", "chest", "head",
    "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
    "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
}
REQUIRED_ANCHORS = {"sternum", "airway", "pad_left", "pad_right", "access_right", "ultrasound"}


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
    return Path(bpy.data.filepath).resolve().parent.parent / "js" / "room3d-patient-rig-data.js"


def find_armature():
    candidates = [obj for obj in bpy.data.objects if obj.get("hlr_patient_rig")]
    if len(candidates) != 1:
        raise RuntimeError(f"Förväntade exakt en HLR-patientrigg, hittade {len(candidates)}")
    return candidates[0]


def export_bones(armature):
    bones = {}
    world_matrices = {}
    for bone in armature.data.bones:
        head_world = armature.matrix_world @ bone.head_local
        head_three = BLENDER_TO_THREE @ head_world.to_4d()
        world_matrices[bone.name] = Matrix.Translation(head_three.to_3d())
    missing = REQUIRED_BONES - world_matrices.keys()
    if missing:
        raise RuntimeError("Patientriggen saknar ben: " + ", ".join(sorted(missing)))
    for bone in armature.data.bones:
        world = world_matrices[bone.name]
        local = world_matrices[bone.parent.name].inverted() @ world if bone.parent else world
        bones[bone.name] = {"parent": bone.parent.name if bone.parent else None, **transform_payload(local)}
    return dict(sorted(bones.items())), world_matrices


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


def export_meshes(bone_world):
    result = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        bone_name = obj.get("hlr_bone")
        if not bone_name:
            continue
        positions, indices = mesh_geometry(obj, depsgraph)
        local = bone_world[bone_name].inverted() @ convert_matrix(obj.matrix_world)
        result.append({
            "name": obj.name, "bone": bone_name, "material": obj.get("hlr_material", "skin"),
            **transform_payload(local), "positions": positions, "indices": indices,
        })
    if not result:
        raise RuntimeError("Patientriggen saknar exporterbara meshar")
    return result


def export_anchors():
    anchors = {}
    for obj in bpy.data.objects:
        name = obj.get("hlr_anchor")
        if name:
            anchors[name] = clean_vector(convert_matrix(obj.matrix_world).to_translation())
    missing = REQUIRED_ANCHORS - anchors.keys()
    if missing:
        raise RuntimeError("Patientriggen saknar ankare: " + ", ".join(sorted(missing)))
    return dict(sorted(anchors.items()))


def main():
    armature = find_armature()
    bones, bone_world = export_bones(armature)
    payload = {
        "version": 1,
        "bones": bones,
        "meshes": export_meshes(bone_world),
        "anchors": export_anchors(),
    }
    destination = output_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    destination.write_text(
        "/* Genererad från HLR/blender/hlr-patient-rig.blend. Kör export_hlr_patient_rig.py. */\n"
        f"window.HLR_PATIENT_RIG={encoded};\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"HLR-patientrigg exporterad: {destination}")


if __name__ == "__main__":
    main()
