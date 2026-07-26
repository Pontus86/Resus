"""Bygg en liggande, riggad patient från Kropps-atlasens anatomiska hudyta."""

import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-patient-rig.blend"
ATLAS_SKIN = HERE.parent.parent / "Kroppsatlas" / "models" / "body" / "skin.js"
ATLAS_SCALE = 0.0023
ATLAS_CENTER = Vector((-0.647, -100.7677, 781.6244))


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


def load_atlas_skin():
    source = ATLAS_SKIN.read_text(encoding="utf-8")
    marker = "window.BODY3D_OBJ['skin'] = "
    start = source.index(marker) + len(marker)
    encoded = source[start:].strip()
    if encoded.endswith(";"):
        encoded = encoded[:-1]
    obj_text = json.loads(encoded)
    vertices = []
    faces = []
    for line in obj_text.splitlines():
        if line.startswith("v "):
            raw = Vector(tuple(float(value) for value in line.split()[1:4]))
            # BodyParts3D står upp (Z kraniellt, negativ Y framåt). Patienten ligger på rygg med huvudet mot +Y.
            vertices.append(
                (
                    (raw.x - ATLAS_CENTER.x) * ATLAS_SCALE,
                    (raw.z - ATLAS_CENTER.z) * ATLAS_SCALE - 0.12,
                    (45.2476 - raw.y) * ATLAS_SCALE,
                )
            )
        elif line.startswith("f "):
            faces.append(tuple(int(part.split("/")[0]) - 1 for part in line.split()[1:]))
    if not vertices or not faces:
        raise RuntimeError("Kunde inte läsa Atlas-huden")
    return vertices, faces


def create_atlas_body(mat):
    vertices, faces = load_atlas_skin()
    mesh = bpy.data.meshes.new("AtlasPatientSkin")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("atlas_body_mesh", mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    obj["hlr_material"] = "skin"
    obj["hlr_skinned"] = True
    modifier = obj.modifiers.new("Webboptimerad yta", "DECIMATE")
    modifier.ratio = 0.07
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def create_gown_shell(body, mat):
    source = body.data
    selected = []
    used = set()
    for polygon in source.polygons:
        center = sum((source.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        width = 0.60 if center.y > -0.50 else 0.48
        if -0.82 <= center.y <= 0.82 and abs(center.x) <= width:
            face = tuple(polygon.vertices)
            selected.append(face)
            used.update(face)
    remap = {old: new for new, old in enumerate(sorted(used))}
    vertices = [source.vertices[old].co.copy() for old in sorted(used)]
    faces = [tuple(remap[index] for index in face) for face in selected]
    mesh = bpy.data.meshes.new("AtlasPatientGown")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for vertex in mesh.vertices:
        vertex.co += vertex.normal * 0.025
    mesh.update()
    obj = bpy.data.objects.new("atlas_gown_mesh", mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    obj["hlr_material"] = "gown"
    obj["hlr_skinned"] = True
    return obj


def distance_to_segment(point, start, end):
    segment = end - start
    factor = max(0.0, min(1.0, (point - start).dot(segment) / max(segment.length_squared, 0.000001)))
    return (point - (start + segment * factor)).length


def weight_candidates(point):
    side = "L" if point.x < 0 else "R"
    if point.y > 0.90:
        return ("head", "chest")
    if point.y < -0.68:
        return (f"thigh.{side}", f"shin.{side}", f"foot.{side}", "root")
    if abs(point.x) > 0.38:
        return (f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}", "chest", "root")
    return ("root", "chest", "head")


def assign_skin_weights(obj, armature):
    segments = {
        bone.name: (bone.head_local.copy(), bone.tail_local.copy())
        for bone in armature.data.bones
    }
    groups = {name: obj.vertex_groups.new(name=name) for name in segments}
    for vertex in obj.data.vertices:
        distances = sorted(
            (
                (distance_to_segment(vertex.co, *segments[name]), name)
                for name in weight_candidates(vertex.co)
            ),
            key=lambda item: item[0],
        )[:2]
        raw_weights = [(1.0 / max(distance, 0.025) ** 2, name) for distance, name in distances]
        total = sum(weight for weight, _name in raw_weights)
        for weight, name in raw_weights:
            groups[name].add((vertex.index,), weight / total, "REPLACE")
    obj.parent = armature
    obj["hlr_armature"] = armature.name


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
        ("root", None, (0, -0.67, 0.18), (0, -0.28, 0.20)),
        ("chest", "root", (0, -0.28, 0.22), (0, 0.76, 0.31)),
        ("head", "root", (0, 0.96, 0.25), (0, 1.75, 0.30)),
        ("upper_arm.L", "root", (-0.49, 0.63, 0.22), (-0.62, 0.05, 0.18)),
        ("forearm.L", "upper_arm.L", (-0.62, 0.05, 0.18), (-0.68, -0.50, 0.15)),
        ("hand.L", "forearm.L", (-0.68, -0.50, 0.15), (-0.70, -0.73, 0.14)),
        ("upper_arm.R", "root", (0.49, 0.63, 0.22), (0.62, 0.05, 0.18)),
        ("forearm.R", "upper_arm.R", (0.62, 0.05, 0.18), (0.68, -0.50, 0.15)),
        ("hand.R", "forearm.R", (0.68, -0.50, 0.15), (0.70, -0.73, 0.14)),
        ("thigh.L", "root", (-0.19, -0.62, 0.16), (-0.20, -1.30, 0.13)),
        ("shin.L", "thigh.L", (-0.20, -1.30, 0.13), (-0.21, -1.90, 0.10)),
        ("foot.L", "shin.L", (-0.21, -1.90, 0.10), (-0.21, -2.13, 0.08)),
        ("thigh.R", "root", (0.19, -0.62, 0.16), (0.20, -1.30, 0.13)),
        ("shin.R", "thigh.R", (0.20, -1.30, 0.13), (0.21, -1.90, 0.10)),
        ("foot.R", "shin.R", (0.21, -1.90, 0.10), (0.21, -2.13, 0.08)),
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
    body = create_atlas_body(mats["skin"])
    gown = create_gown_shell(body, mats["gown"])
    assign_skin_weights(body, armature)
    assign_skin_weights(gown, armature)
    sphere("hair_mesh", (0, 1.61, 0.47), (0.30, 0.27, 0.10), mats["hair"], armature, "head", "hair", 2)
    sphere("lips_mesh", (0, 1.48, 0.65), (0.065, 0.020, 0.014), mats["lips"], armature, "head", "lips", 1)
    for side, sign in (("L", -1), ("R", 1)):
        sphere(f"eye_white_{side}", (sign * 0.095, 1.62, 0.625), (0.044, 0.026, 0.015),
               mats["eye_white"], armature, "head", "eye_white", 1)
        cylinder_between(f"eyebrow_{side}", (sign * 0.15, 1.68, 0.647), (sign * 0.05, 1.69, 0.65),
                         0.012, mats["hair"], armature, "head", "hair", 7)
    cube("gown_center_seam", (0, 0.02, 0.605), (0.026, 1.14, 0.020),
         mats["gown_dark"], armature, "chest", "gown_dark", bevel=0.006)
    for side, sign in (("L", -1), ("R", 1)):
        cube(f"gown_neckline_{side}", (sign * 0.08, 0.69, 0.598), (0.13, 0.26, 0.024),
             mats["gown_dark"], armature, "chest", "gown_dark", rotation_z=sign * 0.55, bevel=0.01)
        cube(f"gown_fold_{side}", (sign * 0.28, 0.02, 0.600), (0.018, 0.88, 0.018),
             mats["gown_light"], armature, "chest", "gown_light", rotation_z=sign * 0.06, bevel=0.004)
    for side, sign in (("L", -1), ("R", 1)):
        sphere(f"eye_{side}", (sign * 0.095, 1.62, 0.641), (0.017, 0.014, 0.009), mats["dark"], armature, "head", "dark", 1)
    cylinder_between("patient_wristband", (0.65, -0.36, 0.16), (0.67, -0.44, 0.15), 0.102,
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
    for obj in [item for item in bpy.data.objects if item.get("hlr_bone") or item.get("hlr_skinned")]:
        move_to(obj, mesh_collection)

    anchors = {
        "sternum": (0, 0.18, 0.61),
        "compression_hand_left": (0, 0.18, 0.64),
        "compression_hand_right": (0, 0.18, 0.665),
        "airway": (0, 1.52, 0.68),
        "mask_seal": (0, 1.52, 0.68),
        "bag_grip": (0.38, 1.82, 0.76),
        "pad_left": (-0.31, 0.57, 0.60),
        "pad_right": (0.31, -0.10, 0.60),
        "access_right": (0.66, -0.42, 0.30),
        "ultrasound": (0.43, -0.15, 0.58),
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
        "atlas_body_mesh är en webboptimerad kopia av Kropps-atlasens BodyParts3D-hud.\n"
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
    scene["hlr_patient_rig_version"] = 2
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
