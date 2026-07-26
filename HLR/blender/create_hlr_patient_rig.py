"""Bygg en liggande, riggad patient med kliniska fästpunkter för HLR-rummet."""

from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-patient-rig.blend"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    bpy.data.collections["Collection"].name = "PREVIEW"
    for datablocks in (bpy.data.armatures, bpy.data.meshes, bpy.data.materials):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name, color, roughness=0.65):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def assign(obj, mat):
    obj.data.materials.append(mat)


def move_to(obj, collection):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)


def parent_to_bone(obj, armature, bone_name):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world
    bpy.context.view_layer.update()
    obj["hlr_bone"] = bone_name


def sphere(name, location, scale, mat, armature, bone, material_role, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, mat)
    obj["hlr_material"] = material_role
    parent_to_bone(obj, armature, bone)
    return obj


def cylinder_between(name, start, end, radius, mat, armature, bone, material_role, vertices=12):
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    assign(obj, mat)
    obj["hlr_material"] = material_role
    parent_to_bone(obj, armature, bone)
    return obj


def cube(name, location, dimensions, mat, armature, bone, material_role, rotation_z=0.0, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.rotation_euler[2] = rotation_z
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Mjuka kanter", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    assign(obj, mat)
    obj["hlr_material"] = material_role
    parent_to_bone(obj, armature, bone)
    return obj


def create_armature():
    data = bpy.data.armatures.new("HLR_PATIENT_ARMATURE")
    armature = bpy.data.objects.new("HLR_PATIENT_RIG", data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    armature["hlr_patient_rig"] = True
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = (
        ("root", None, (0, -0.65, 0.08), (0, -0.30, 0.10)),
        ("chest", "root", (0, -0.30, 0.12), (0, 0.55, 0.15)),
        ("head", "root", (0, 1.04, 0.13), (0, 1.72, 0.16)),
        ("upper_arm.L", "root", (-0.43, 0.42, 0.10), (-0.72, -0.02, 0.08)),
        ("forearm.L", "upper_arm.L", (-0.72, -0.02, 0.08), (-1.02, -0.48, 0.06)),
        ("hand.L", "forearm.L", (-1.02, -0.48, 0.06), (-1.05, -0.68, 0.06)),
        ("upper_arm.R", "root", (0.43, 0.42, 0.10), (0.72, -0.02, 0.08)),
        ("forearm.R", "upper_arm.R", (0.72, -0.02, 0.08), (1.02, -0.48, 0.06)),
        ("hand.R", "forearm.R", (1.02, -0.48, 0.06), (1.05, -0.68, 0.06)),
        ("thigh.L", "root", (-0.24, -0.82, 0.08), (-0.31, -1.35, 0.07)),
        ("shin.L", "thigh.L", (-0.31, -1.35, 0.07), (-0.36, -1.93, 0.06)),
        ("foot.L", "shin.L", (-0.36, -1.93, 0.06), (-0.36, -2.15, 0.05)),
        ("thigh.R", "root", (0.24, -0.82, 0.08), (0.31, -1.35, 0.07)),
        ("shin.R", "thigh.R", (0.31, -1.35, 0.07), (0.36, -1.93, 0.06)),
        ("foot.R", "shin.R", (0.36, -1.93, 0.06), (0.36, -2.15, 0.05)),
    )
    created = {}
    for name, parent, head, tail in bones:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = created[parent]
        created[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def create_meshes(armature):
    mats = {
        "skin": material("Skin", (0.67, 0.42, 0.27)),
        "gown": material("Patient gown", (0.43, 0.67, 0.57)),
        "hair": material("Hair", (0.08, 0.055, 0.04)),
        "dark": material("Eyes", (0.025, 0.035, 0.03)),
        "lips": material("Lips", (0.38, 0.16, 0.18)),
        "eye_white": material("Eye whites", (0.86, 0.84, 0.78)),
        "gown_dark": material("Gown seams", (0.24, 0.48, 0.40)),
        "gown_light": material("Gown folds", (0.58, 0.76, 0.67)),
        "wristband": material("Patient wristband", (0.84, 0.88, 0.82)),
    }
    sphere("chest_mesh", (0, 0.10, 0.17), (0.58, 0.79, 0.23), mats["gown"], armature, "chest", "gown", 3)
    sphere("pelvis_mesh", (0, -0.72, 0.13), (0.49, 0.43, 0.19), mats["gown"], armature, "root", "gown", 2)
    cylinder_between("neck_mesh", (0, 0.88, 0.13), (0, 1.12, 0.14), 0.15, mats["skin"], armature, "head", "skin", 14)
    sphere("head_mesh", (0, 1.43, 0.16), (0.33, 0.40, 0.29), mats["skin"], armature, "head", "skin", 3)
    sphere("jaw_mesh", (0, 1.22, 0.14), (0.24, 0.22, 0.22), mats["skin"], armature, "head", "skin", 2)
    sphere("hair_mesh", (0, 1.56, 0.29), (0.34, 0.31, 0.11), mats["hair"], armature, "head", "hair", 2)
    sphere("nose_mesh", (0, 1.46, 0.455), (0.05, 0.07, 0.055), mats["skin"], armature, "head", "skin", 1)
    sphere("lips_mesh", (0, 1.34, 0.435), (0.075, 0.022, 0.018), mats["lips"], armature, "head", "lips", 1)
    for side, sign in (("L", -1), ("R", 1)):
        sphere(f"eye_white_{side}", (sign * 0.105, 1.50, 0.425), (0.048, 0.030, 0.018),
               mats["eye_white"], armature, "head", "eye_white", 1)
        sphere(f"ear_{side}", (sign * 0.31, 1.43, 0.16), (0.045, 0.07, 0.055),
               mats["skin"], armature, "head", "skin", 1)
        cylinder_between(f"eyebrow_{side}", (sign * 0.16, 1.55, 0.452), (sign * 0.055, 1.57, 0.455),
                         0.012, mats["hair"], armature, "head", "hair", 7)
    cube("gown_center_seam", (0, 0.06, 0.402), (0.026, 1.10, 0.020),
         mats["gown_dark"], armature, "chest", "gown_dark", bevel=0.006)
    for side, sign in (("L", -1), ("R", 1)):
        cube(f"gown_neckline_{side}", (sign * 0.08, 0.68, 0.397), (0.13, 0.26, 0.024),
             mats["gown_dark"], armature, "chest", "gown_dark", rotation_z=sign * 0.55, bevel=0.01)
        cube(f"gown_fold_{side}", (sign * 0.28, 0.03, 0.398), (0.018, 0.88, 0.018),
             mats["gown_light"], armature, "chest", "gown_light", rotation_z=sign * 0.06, bevel=0.004)
    for side, sign in (("L", -1), ("R", 1)):
        sphere(f"eye_{side}", (sign * 0.105, 1.50, 0.444), (0.019, 0.016, 0.010), mats["dark"], armature, "head", "dark", 1)
        cylinder_between(f"upper_arm_{side}", (sign * 0.43, 0.42, 0.10), (sign * 0.72, -0.02, 0.08), 0.13, mats["skin"], armature, f"upper_arm.{side}", "skin")
        cylinder_between(f"forearm_{side}", (sign * 0.72, -0.02, 0.08), (sign * 1.02, -0.48, 0.06), 0.115, mats["skin"], armature, f"forearm.{side}", "skin")
        sphere(f"hand_{side}", (sign * 1.04, -0.59, 0.06), (0.13, 0.19, 0.08), mats["skin"], armature, f"hand.{side}", "skin", 1)
        cylinder_between(f"thigh_{side}", (sign * 0.24, -0.82, 0.08), (sign * 0.31, -1.35, 0.07), 0.15, mats["gown"], armature, f"thigh.{side}", "gown")
        cylinder_between(f"shin_{side}", (sign * 0.31, -1.35, 0.07), (sign * 0.36, -1.93, 0.06), 0.13, mats["skin"], armature, f"shin.{side}", "skin")
        sphere(f"foot_{side}", (sign * 0.36, -2.04, 0.06), (0.15, 0.27, 0.10), mats["skin"], armature, f"foot.{side}", "skin", 1)
    cylinder_between("patient_wristband", (0.86, -0.23, 0.065), (0.91, -0.31, 0.063), 0.124,
                     mats["wristband"], armature, "forearm.R", "wristband", 14)


def create_anchor(name, location, collection):
    obj = bpy.data.objects.new("ANCHOR_" + name, None)
    collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = 0.07
    obj.show_in_front = True
    obj["hlr_anchor"] = name
    return obj


def organize_preview(armature):
    rig_collection = bpy.data.collections.new("ARMATURE")
    mesh_collection = bpy.data.collections.new("RIGGED_MESHES")
    anchor_collection = bpy.data.collections.new("CLINICAL_ANCHORS")
    bpy.context.scene.collection.children.link(rig_collection)
    bpy.context.scene.collection.children.link(mesh_collection)
    bpy.context.scene.collection.children.link(anchor_collection)
    move_to(armature, rig_collection)
    for obj in [item for item in bpy.data.objects if item.get("hlr_bone")]:
        move_to(obj, mesh_collection)

    anchors = {
        "sternum": (0, 0.18, 0.39),
        "compression_hand_left": (-0.055, 0.18, 0.42),
        "compression_hand_right": (0.055, 0.18, 0.445),
        "airway": (0, 1.41, 0.49),
        "mask_seal": (0, 1.41, 0.49),
        "bag_grip": (0.38, 1.82, 0.58),
        "pad_left": (-0.34, 0.60, 0.38),
        "pad_right": (0.34, -0.12, 0.38),
        "access_right": (1.02, -0.38, 0.20),
        "ultrasound": (0.48, -0.15, 0.36),
    }
    for name, location in anchors.items():
        create_anchor(name, location, anchor_collection)

    preview = bpy.data.collections["PREVIEW"]
    floor_mat = material("Preview table", (0.18, 0.23, 0.21), roughness=0.82)
    bpy.ops.mesh.primitive_cube_add(location=(0, -0.2, -0.12))
    table = bpy.context.object
    table.name = "preview_table"
    table.dimensions = (2.8, 4.8, 0.18)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(table, floor_mat)
    move_to(table, preview)

    bpy.ops.object.camera_add(location=(3.2, -4.6, 4.2))
    camera = bpy.context.object
    camera.name = "PREVIEW_CAMERA"
    move_to(camera, preview)
    target = bpy.data.objects.new("PREVIEW_TARGET", None)
    preview.objects.link(target)
    target.location = (0, -0.2, 0.1)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    for name, location, energy, color in (
        ("KEY", (-3.0, 1.0, 5.5), 1000, (1.0, 0.88, 0.72)),
        ("FILL", (3.5, -1.5, 3.8), 650, (0.66, 0.82, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = 3.0
        data.color = color
        light = bpy.data.objects.new(name, data)
        preview.objects.link(light)
        light.location = location
        track = light.constraints.new("TRACK_TO")
        track.target = target
        track.track_axis = "TRACK_NEGATIVE_Z"
        track.up_axis = "UP_Y"


def add_instructions():
    text = bpy.data.texts.new("READ_ME_FIRST")
    text.write(
        "HLR PATIENT RIG\n\n"
        "Patienten ligger med huvudet mot positiv Blender-Y.\n"
        "Posera HLR_PATIENT_RIG i Pose Mode. Ändra inte bennamn eller ankarnamn.\n"
        "CLINICAL_ANCHORS styr sternum, luftväg, plattor, infart och ultraljud i webben.\n"
        "Kör export_hlr_patient_rig.py efter en avsiktlig modelländring.\n"
    )


def main():
    clear_scene()
    armature = create_armature()
    create_meshes(armature)
    organize_preview(armature)
    add_instructions()
    scene = bpy.context.scene
    scene["hlr_patient_rig_version"] = 1
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 680
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.045, 0.04)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), check_existing=False)
    print(f"HLR-patientrigg skapad: {OUTPUT}")


if __name__ == "__main__":
    main()
