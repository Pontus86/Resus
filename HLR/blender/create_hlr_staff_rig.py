"""Bygg en återanvändbar, riggad lågpoly-person för HLR-rummet."""

from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-staff-rig.blend"


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


def material(name, color, metallic=0.0, roughness=0.62):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def tag(obj, bone, material_role):
    obj["hlr_bone"] = bone
    obj["hlr_material"] = material_role
    return obj


def assign(obj, mat):
    obj.data.materials.append(mat)


def parent_to_bone(obj, armature, bone_name):
    # Primitivens skala måste först nå depsgraphen; annars innehåller matrix_world fortfarande
    # enhetsskala och sfärer växer tillbaka till två meters diameter när de benparentas.
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world
    bpy.context.view_layer.update()


def parent_contact_to_bone(obj, armature, bone_name, contact_name):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world
    obj["hlr_contact"] = contact_name
    obj["hlr_contact_bone"] = bone_name
    bpy.context.view_layer.update()


def move_to(obj, collection):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)


def sphere(name, location, scale, mat, armature, bone, material_role, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, mat)
    tag(obj, bone, material_role)
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
    tag(obj, bone, material_role)
    parent_to_bone(obj, armature, bone)
    return obj


def cone(name, location, depth, lower, upper, mat, armature, bone, material_role):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=lower, radius2=upper, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    tag(obj, bone, material_role)
    parent_to_bone(obj, armature, bone)
    return obj


def cube(name, location, dimensions, mat, armature, bone, material_role, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Mjuka kanter", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    assign(obj, mat)
    tag(obj, bone, material_role)
    parent_to_bone(obj, armature, bone)
    return obj


def create_armature():
    data = bpy.data.armatures.new("HLR_STAFF_ARMATURE")
    armature = bpy.data.objects.new("HLR_STAFF_RIG", data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True
    armature["hlr_staff_rig"] = True
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    bones = (
        ("pelvis", None, (0, 0, 1.03), (0, 0, 1.28)),
        ("spine", "pelvis", (0, 0, 1.25), (0, 0, 1.76)),
        ("neck", "spine", (0, 0, 1.74), (0, 0, 1.98)),
        ("head", "neck", (0, 0, 1.96), (0, 0, 2.33)),
        ("upper_arm.L", "spine", (-0.34, 0, 1.70), (-0.48, 0, 1.30)),
        ("forearm.L", "upper_arm.L", (-0.48, 0, 1.30), (-0.43, -0.02, 0.96)),
        ("hand.L", "forearm.L", (-0.43, -0.02, 0.96), (-0.43, -0.08, 0.75)),
        ("upper_arm.R", "spine", (0.34, 0, 1.70), (0.48, 0, 1.30)),
        ("forearm.R", "upper_arm.R", (0.48, 0, 1.30), (0.43, -0.02, 0.96)),
        ("hand.R", "forearm.R", (0.43, -0.02, 0.96), (0.43, -0.08, 0.75)),
        ("thigh.L", "pelvis", (-0.18, 0, 1.08), (-0.19, 0, 0.67)),
        ("shin.L", "thigh.L", (-0.19, 0, 0.67), (-0.18, 0, 0.15)),
        ("foot.L", "shin.L", (-0.18, 0, 0.15), (-0.18, -0.28, 0.07)),
        ("thigh.R", "pelvis", (0.18, 0, 1.08), (0.19, 0, 0.67)),
        ("shin.R", "thigh.R", (0.19, 0, 0.67), (0.18, 0, 0.15)),
        ("foot.R", "shin.R", (0.18, 0, 0.15), (0.18, -0.28, 0.07)),
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
        "scrub": material("Scrub preview", (0.05, 0.23, 0.42)),
        "skin": material("Skin", (0.66, 0.40, 0.25)),
        "dark": material("Shoes and details", (0.035, 0.05, 0.045)),
        "hair_or_cap": material("Hair or cap", (0.08, 0.05, 0.035)),
        "eye": material("Eyes", (0.025, 0.035, 0.03)),
    }
    sphere("pelvis_mesh", (0, 0, 1.14), (0.38, 0.27, 0.28), mats["scrub"], armature, "pelvis", "scrub")
    cone("torso_mesh", (0, 0, 1.52), 0.68, 0.43, 0.31, mats["scrub"], armature, "spine", "scrub")
    sphere("shoulders_mesh", (0, 0, 1.68), (0.45, 0.27, 0.23), mats["scrub"], armature, "spine", "scrub")
    cylinder_between("neck_mesh", (0, 0, 1.82), (0, 0, 2.02), 0.11, mats["skin"], armature, "neck", "skin")
    sphere("head_mesh", (0, 0, 2.17), (0.26, 0.23, 0.31), mats["skin"], armature, "head", "skin", 3)
    sphere("jaw_mesh", (0, -0.015, 2.07), (0.21, 0.20, 0.18), mats["skin"], armature, "head", "skin")
    sphere("nose_mesh", (0, -0.235, 2.18), (0.045, 0.06, 0.07), mats["skin"], armature, "head", "skin", 1)
    sphere("hair_mesh", (0, 0.025, 2.34), (0.27, 0.23, 0.13), mats["hair_or_cap"], armature, "head", "hair_or_cap", 2)
    for side, sign in (("L", -1), ("R", 1)):
        sphere(f"eye_{side}", (sign * 0.09, -0.218, 2.21), (0.022, 0.014, 0.022), mats["eye"], armature, "head", "eye", 1)
        sphere(f"ear_{side}", (sign * 0.255, 0, 2.18), (0.045, 0.025, 0.065), mats["skin"], armature, "head", "skin", 1)
        cylinder_between(f"upper_arm_{side}", (sign * 0.34, 0, 1.70), (sign * 0.48, 0, 1.30), 0.115, mats["scrub"], armature, f"upper_arm.{side}", "scrub")
        sphere(f"elbow_{side}", (sign * 0.48, 0, 1.30), (0.12, 0.12, 0.12), mats["skin"], armature, f"forearm.{side}", "skin", 1)
        cylinder_between(f"forearm_{side}", (sign * 0.48, 0, 1.30), (sign * 0.43, -0.02, 0.96), 0.09, mats["skin"], armature, f"forearm.{side}", "skin")
        sphere(f"palm_{side}", (sign * 0.43, -0.06, 0.84), (0.105, 0.075, 0.12), mats["skin"], armature, f"hand.{side}", "skin", 1)
        for finger in range(4):
            x = sign * (0.385 + finger * 0.03)
            cylinder_between(
                f"finger_{side}_{finger + 1}", (x, -0.07, 0.80), (x, -0.085, 0.71),
                0.018, mats["skin"], armature, f"hand.{side}", "skin", 7,
            )
        cylinder_between(
            f"thumb_{side}", (sign * 0.35, -0.07, 0.84), (sign * 0.31, -0.09, 0.76),
            0.022, mats["skin"], armature, f"hand.{side}", "skin", 7,
        )
        cylinder_between(f"thigh_{side}", (sign * 0.18, 0, 1.08), (sign * 0.19, 0, 0.67), 0.14, mats["scrub"], armature, f"thigh.{side}", "scrub")
        sphere(f"knee_{side}", (sign * 0.19, 0, 0.67), (0.125, 0.125, 0.13), mats["scrub"], armature, f"shin.{side}", "scrub", 1)
        cylinder_between(f"shin_{side}", (sign * 0.19, 0, 0.67), (sign * 0.18, 0, 0.15), 0.105, mats["scrub"], armature, f"shin.{side}", "scrub")
        cube(f"shoe_{side}", (sign * 0.18, -0.10, 0.08), (0.22, 0.39, 0.13), mats["dark"], armature, f"foot.{side}", "dark")


def create_contacts(armature):
    contacts = bpy.data.collections.new("CONTACT_POINTS")
    bpy.context.scene.collection.children.link(contacts)
    for side, sign in (("L", -1), ("R", 1)):
        obj = bpy.data.objects.new(f"CONTACT_palm.{side}", None)
        contacts.objects.link(obj)
        obj.location = (sign * 0.43, -0.085, 0.70)
        obj.empty_display_type = "SPHERE"
        obj.empty_display_size = 0.035
        obj.show_in_front = True
        parent_contact_to_bone(obj, armature, f"hand.{side}", f"palm.{side}")


def create_actions(armature):
    armature["hlr_torso_lean"] = 0.0
    armature["hlr_contact_depth"] = 0.0
    armature["hlr_bag_squeeze"] = 0.0
    clips = {
        "compression": {
            "frames": (1, 5, 9, 17),
            "hlr_torso_lean": (0.0, -0.24, 0.0, 0.0),
            "hlr_contact_depth": (0.0, 1.0, 0.0, 0.0),
            "hlr_bag_squeeze": (0.0, 0.0, 0.0, 0.0),
        },
        "ventilation": {
            "frames": (1, 15, 30),
            "hlr_torso_lean": (-0.08, -0.12, -0.08),
            "hlr_contact_depth": (0.0, 0.0, 0.0),
            "hlr_bag_squeeze": (0.0, 1.0, 0.0),
        },
    }
    for clip_name, clip in clips.items():
        action = bpy.data.actions.new("HLR_" + clip_name.capitalize())
        action.use_fake_user = True
        action["hlr_clip"] = clip_name
        action["hlr_fps"] = 30
        for channel, values in clip.items():
            if channel == "frames":
                continue
            curve = action.fcurves.new(data_path=f'["{channel}"]')
            for frame, value in zip(clip["frames"], values):
                point = curve.keyframe_points.insert(frame, value)
                point.interpolation = "LINEAR"


def organize_and_light(armature):
    rig_collection = bpy.data.collections.new("ARMATURE")
    mesh_collection = bpy.data.collections.new("RIGGED_MESHES")
    bpy.context.scene.collection.children.link(rig_collection)
    bpy.context.scene.collection.children.link(mesh_collection)
    move_to(armature, rig_collection)
    for obj in [item for item in bpy.data.objects if item.get("hlr_bone")]:
        move_to(obj, mesh_collection)

    preview = bpy.data.collections["PREVIEW"]
    floor_mat = material("Preview floor", (0.16, 0.20, 0.18), roughness=0.85)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "preview_floor"
    assign(floor, floor_mat)
    move_to(floor, preview)

    bpy.ops.object.camera_add(location=(3.7, -6.2, 3.0))
    camera = bpy.context.object
    camera.name = "PREVIEW_CAMERA"
    move_to(camera, preview)
    target = bpy.data.objects.new("PREVIEW_TARGET", None)
    preview.objects.link(target)
    target.location = (0, 0, 1.2)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    camera.data.lens = 58
    bpy.context.scene.camera = camera

    for name, location, energy, size, color in (
        ("KEY", (-3.0, -3.5, 5.5), 900, 3.0, (1.0, 0.88, 0.72)),
        ("FILL", (3.5, -1.0, 3.6), 650, 2.5, (0.66, 0.82, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
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
        "HLR STAFF RIG\n\n"
        "Armaturen HLR_STAFF_RIG är den gemensamma personriggen.\n"
        "Posera benen i Pose Mode. Ändra inte bennamn eller hlr_bone-egenskaper.\n"
        "Mesharna är rigid-bundna till varsitt ben för en liten deterministisk webbexport.\n"
        "Kör export_hlr_staff_rig.py från reporoten efter en avsiktlig modelländring.\n"
    )


def main():
    clear_scene()
    armature = create_armature()
    create_meshes(armature)
    create_contacts(armature)
    create_actions(armature)
    organize_and_light(armature)
    add_instructions()
    scene = bpy.context.scene
    scene["hlr_staff_rig_version"] = 2
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.045, 0.04)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), check_existing=False)
    print(f"HLR-personrigg skapad: {OUTPUT}")


if __name__ == "__main__":
    main()
