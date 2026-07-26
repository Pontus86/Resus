"""Bygg den redigerbara standardscenen för HLR-rummet i Blender."""

from math import atan2, radians
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-room.blend"
MODEL_SCALE = 1.08
ROOM_PROP_ROLES = {
    "monitor_wall",
    "gas_panel",
    "sign",
    "ceiling_light_left",
    "ceiling_light_right",
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    base.name = "ROOM"
    return base


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to(obj, destination):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    destination.objects.link(obj)


def material(name, color, metallic=0.0, roughness=0.55, emission=None):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.5
    return result


def assign(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def root(role, location, controls):
    obj = bpy.data.objects.new(role, None)
    controls.objects.link(obj)
    obj.empty_display_type = "CIRCLE"
    obj.empty_display_size = 0.65
    obj.color = (1.0, 0.24, 0.03, 1.0)
    obj.show_in_front = True
    obj.location = location
    if role not in ROOM_PROP_ROLES:
        obj.scale = (MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
    obj["hlr_role"] = role
    return obj


def cube(parent, name, location, dimensions, mat, proxies, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Mjuka kanter", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 2
    assign(obj, mat)
    if parent:
        obj.parent = parent
    move_to(obj, proxies)
    return obj


def sphere(parent, name, location, scale, mat, proxies, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, mat)
    if parent:
        obj.parent = parent
    move_to(obj, proxies)
    return obj


def cylinder(parent, name, start, end, radius, mat, proxies, vertices=14):
    start, end = Vector(start), Vector(end)
    direction = end - start
    midpoint = (start + end) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    assign(obj, mat)
    if parent:
        obj.parent = parent
    move_to(obj, proxies)
    return obj


def cone(parent, name, location, depth, bottom, top, mat, proxies):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=bottom, radius2=top, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    if parent:
        obj.parent = parent
    move_to(obj, proxies)
    return obj


def torus(parent, name, location, major, minor, mat, proxies, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=20,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    if parent:
        obj.parent = parent
    move_to(obj, proxies)
    return obj


def add_staff(role, location, color, controls, proxies, mats, cap=False):
    person = root(role, location, controls)
    if abs(location[0]) + abs(location[1]) > 0.001:
        person.rotation_euler.z = atan2(-location[0], location[1])
    skin, dark = mats["skin"], mats["dark"]
    scrub = material(f"Scrub_{role}", color, roughness=0.62)
    cube(person, f"{role}_shoe_L", (-0.18, -0.03, 0.08), (0.22, 0.42, 0.13), dark, proxies)
    cube(person, f"{role}_shoe_R", (0.18, -0.03, 0.08), (0.22, 0.42, 0.13), dark, proxies)
    for side, x in (("L", -0.18), ("R", 0.18)):
        cylinder(person, f"{role}_shin_{side}", (x, 0, 0.16), (x, 0, 0.72), 0.105, scrub, proxies)
        sphere(person, f"{role}_knee_{side}", (x, 0, 0.75), (0.12, 0.12, 0.13), scrub, proxies)
        cylinder(person, f"{role}_thigh_{side}", (x, 0, 0.78), (x * 0.82, 0, 1.17), 0.14, scrub, proxies)
    sphere(person, f"{role}_pelvis", (0, 0, 1.18), (0.39, 0.27, 0.28), scrub, proxies)
    cone(person, f"{role}_torso", (0, 0, 1.55), 0.72, 0.32, 0.46, scrub, proxies)
    cylinder(person, f"{role}_neck", (0, 0, 1.9), (0, 0, 2.02), 0.115, skin, proxies)
    sphere(person, f"{role}_head", (0, 0, 2.19), (0.27, 0.24, 0.34), skin, proxies)
    sphere(person, f"{role}_jaw", (0, -0.015, 2.08), (0.22, 0.21, 0.2), skin, proxies)
    sphere(person, f"{role}_nose", (0, -0.245, 2.2), (0.045, 0.065, 0.07), skin, proxies, 1)
    hair_mat = scrub if cap else mats["hair"]
    sphere(person, f"{role}_hair", (0, 0.025, 2.36), (0.275, 0.245, 0.13), hair_mat, proxies)
    for side, sign in (("L", -1), ("R", 1)):
        shoulder = (sign * 0.43, 0, 1.75)
        elbow = (sign * 0.57, -0.02, 1.39)
        wrist = (sign * 0.48, -0.04, 1.08)
        cylinder(person, f"{role}_upper_arm_{side}", shoulder, elbow, 0.12, scrub, proxies)
        sphere(person, f"{role}_elbow_{side}", elbow, (0.125, 0.125, 0.125), skin, proxies, 1)
        cylinder(person, f"{role}_forearm_{side}", elbow, wrist, 0.095, skin, proxies)
        sphere(person, f"{role}_hand_{side}", wrist, (0.11, 0.085, 0.14), skin, proxies, 1)
    return person


def add_bed(controls, proxies, mats):
    bed = root("bed", (0, 0, 0), controls)
    cube(bed, "bed_frame", (0, 0, 0.55), (2.7, 4.5, 0.18), mats["metal"], proxies)
    cube(bed, "bed_mattress", (0, 0, 0.78), (2.45, 4.15, 0.25), mats["white"], proxies, 0.1)
    cube(bed, "bed_pillow", (0, 1.55, 0.99), (1.55, 0.75, 0.22), mats["pillow"], proxies, 0.12)
    for x in (-1.42, 1.42):
        cube(bed, "bed_rail", (x, -0.1, 1.08), (0.08, 2.5, 0.48), mats["metal"], proxies, 0.02)
    for x in (-1.12, 1.12):
        for y in (-1.85, 1.85):
            cylinder(bed, "bed_leg", (x, y, 0.08), (x, y, 0.58), 0.065, mats["metal"], proxies)
            torus(bed, "bed_wheel", (x, y, 0.08), 0.11, 0.04, mats["dark"], proxies, (radians(90), 0, 0))
    return bed


def add_patient(controls, proxies, mats):
    patient = root("patient", (0, 0, 0.98), controls)
    sphere(patient, "patient_torso", (0, 0.18, 0.15), (0.62, 0.84, 0.23), mats["gown"], proxies)
    sphere(patient, "patient_pelvis", (0, -0.93, 0.1), (0.5, 0.45, 0.2), mats["gown"], proxies)
    cylinder(patient, "patient_neck", (0, 1.03, 0.1), (0, 1.2, 0.1), 0.16, mats["skin"], proxies)
    sphere(patient, "patient_head", (0, 1.5, 0.15), (0.34, 0.41, 0.29), mats["skin"], proxies)
    sphere(patient, "patient_hair", (0, 1.57, 0.34), (0.35, 0.38, 0.13), mats["hair"], proxies)
    for side, sign in (("L", -1), ("R", 1)):
        cylinder(patient, f"patient_arm_{side}", (sign * 0.48, 0.55, 0.11), (sign * 1.03, -0.48, 0.07), 0.13, mats["skin"], proxies)
        cylinder(patient, f"patient_leg_{side}", (sign * 0.28, -1.18, 0.08), (sign * 0.38, -1.92, 0.06), 0.14, mats["skin"], proxies)
    return patient


def add_lucas(controls, proxies, mats):
    lucas = root("lucas", (0, 0, 0), controls)
    cube(lucas, "lucas_backplate", (0, 0.18, 1.01), (1.72, 1.08, 0.09), mats["dark"], proxies)
    for sign in (-1, 1):
        cylinder(lucas, "lucas_lower", (sign * 0.73, 0.18, 1.04), (sign * 0.99, 0.18, 1.47), 0.085, mats["white"], proxies)
        cylinder(lucas, "lucas_upper", (sign * 0.99, 0.18, 1.47), (sign * 0.76, 0.18, 1.96), 0.085, mats["white"], proxies)
    cube(lucas, "lucas_housing", (0, 0.18, 1.97), (1.48, 0.48, 0.3), mats["white"], proxies)
    cylinder(lucas, "lucas_piston", (0, 0.18, 1.16), (0, 0.18, 1.78), 0.17, mats["dark"], proxies)
    return lucas


def wheeled_box(role, location, size, color, controls, proxies, mats):
    obj = root(role, location, controls)
    body = material(f"{role}_body", color, roughness=0.45)
    cube(obj, f"{role}_base", (0, 0, 0.23), (size[0], size[1], 0.14), mats["dark"], proxies)
    cube(obj, f"{role}_body", (0, 0, size[2] / 2 + 0.3), size, body, proxies)
    for x in (-size[0] * 0.36, size[0] * 0.36):
        for y in (-size[1] * 0.28, size[1] * 0.28):
            torus(obj, f"{role}_wheel", (x, y, 0.08), 0.085, 0.03, mats["dark"], proxies, (radians(90), 0, 0))
    return obj


def add_equipment(controls, proxies, mats):
    cart = wheeled_box("crash_cart", (-5.47, 2.7, 0), (1.35, 0.82, 1.35), (0.65, 0.035, 0.025), controls, proxies, mats)
    for z in (0.55, 0.85, 1.15, 1.45):
        cube(cart, "drawer_line", (0, -0.416, z), (1.12, 0.02, 0.025), mats["dark"], proxies, 0)

    defib = wheeled_box("defib", (5.365, 2.52, 0), (1.08, 0.68, 0.72), (0.62, 0.03, 0.025), controls, proxies, mats)
    cube(defib, "defib_monitor", (0, 0, 1.72), (1.2, 0.58, 0.84), mats["white"], proxies)
    cube(defib, "defib_screen", (-0.08, -0.305, 1.8), (0.82, 0.035, 0.47), mats["screen"], proxies, 0.02)
    cube(defib, "defib_handle", (0, 0.08, 2.24), (1.48, 0.1, 0.09), mats["dark"], proxies)

    ultrasound = wheeled_box("ultrasound", (6.61, -0.6, 0), (0.86, 0.62, 0.58), (0.63, 0.7, 0.67), controls, proxies, mats)
    cylinder(ultrasound, "ultrasound_column", (0, 0, 0.8), (0, 0, 1.55), 0.08, mats["metal"], proxies)
    cube(ultrasound, "ultrasound_monitor", (0, 0, 1.72), (1.05, 0.16, 0.72), mats["dark"], proxies)
    cube(ultrasound, "ultrasound_screen", (0, -0.1, 1.72), (0.86, 0.035, 0.54), mats["screen"], proxies)
    cube(ultrasound, "ultrasound_keyboard", (0, -0.18, 1.2), (0.9, 0.45, 0.08), mats["dark"], proxies)

    vent = wheeled_box("ventilator", (3.74, 0.78, 0), (0.95, 0.62, 0.95), (0.6, 0.68, 0.64), controls, proxies, mats)
    cube(vent, "ventilator_screen", (0, -0.335, 1.48), (0.68, 0.035, 0.36), mats["screen"], proxies)
    cylinder(vent, "humidifier", (-0.38, 0.05, 0.72), (-0.38, 0.05, 1.05), 0.14, mats["glass"], proxies)

    pole = root("iv_pole", (-2.49, 0.78, 0), controls)
    cylinder(pole, "iv_stem", (0, 0, 0.08), (0, 0, 2.5), 0.045, mats["metal"], proxies)
    cube(pole, "iv_hook", (0, 0, 2.48), (0.7, 0.05, 0.05), mats["metal"], proxies)
    cube(pole, "iv_bag", (-0.22, 0, 2.08), (0.42, 0.12, 0.65), mats["glass"], proxies)

    oxygen = root("o2_cyl", (-6.67, 0.78, 0), controls)
    cylinder(oxygen, "oxygen_bottle", (0, 0, 0.12), (0, 0, 1.47), 0.27, mats["oxygen"], proxies, 18)
    cube(oxygen, "oxygen_valve", (0, 0, 1.56), (0.25, 0.25, 0.18), mats["metal"], proxies)

    sink = root("sink", (-3.31, 3.48, 0), controls)
    cube(sink, "sink_basin", (0, 0, 0.9), (1.45, 0.8, 0.35), mats["white"], proxies)
    torus(sink, "sink_bowl", (0, 0, 1.09), 0.32, 0.09, mats["metal"], proxies)
    cylinder(sink, "sink_tap", (0, 0.22, 1.12), (0, 0.22, 1.62), 0.05, mats["metal"], proxies)

    computer = wheeled_box("computer", (6.94, -2.58, 0), (0.9, 0.7, 0.65), (0.62, 0.68, 0.65), controls, proxies, mats)
    cube(computer, "computer_screen", (0, -0.365, 1.13), (0.72, 0.035, 0.48), mats["screen"], proxies)

    stool = root("stool", (5.36, -2.22, 0), controls)
    cylinder(stool, "stool_leg", (0, 0, 0.08), (0, 0, 0.58), 0.08, mats["metal"], proxies)
    cylinder(stool, "stool_seat", (0, 0, 0.55), (0, 0, 0.73), 0.42, mats["stool"], proxies, 20)


def add_room_props(room, controls, proxies, mats):
    cube(None, "floor", (0, 0, -0.06), (17.4, 10.8, 0.12), mats["floor"], room, 0)
    cube(None, "back_wall", (0, 5.3, 2.1), (17.4, 0.18, 4.2), mats["wall"], room, 0)
    cube(None, "left_wall", (-8.7, 0, 2.1), (0.18, 10.6, 4.2), mats["wall"], room, 0)

    gas = root("gas_panel", (-3.4, 5.06, 2.1), controls)
    cube(gas, "gas_panel_body", (0, 0, 0), (2, 0.18, 0.65), mats["white"], proxies)
    for x, color in ((-0.45, mats["oxygen"]), (0.1, mats["metal"]), (0.65, mats["yellow"])):
        cylinder(gas, "gas_port", (x, -0.14, 0), (x, -0.02, 0), 0.13, color, proxies)

    monitor = root("monitor_wall", (2.3, 5.0, 2.7), controls)
    cube(monitor, "monitor_frame", (0, 0, 0), (2.3, 0.25, 1.25), mats["dark"], proxies)
    cube(monitor, "monitor_screen", (0, -0.17, 0), (1.95, 0.08, 0.92), mats["screen"], proxies)

    sign = root("sign", (-6.2, 5.08, 3.15), controls)
    cube(sign, "room_sign", (0, 0, 0), (1.9, 0.12, 0.5), mats["sign"], proxies)

    for role, location in (
        ("ceiling_light_left", (-3.3, 3.0, 4.15)),
        ("ceiling_light_right", (2.6, 3.4, 4.15)),
    ):
        light = root(role, location, controls)
        cube(light, role + "_panel", (0, 0, 0), (2.4, 0.8, 0.08), mats["light"], proxies)


def add_camera_and_lights(lights, mats):
    bpy.ops.object.camera_add(location=(10.5, -12.5, 14.5))
    camera = bpy.context.object
    camera.name = "HLR_CAMERA"
    move_to(camera, lights)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 11.2
    camera["hlr_camera"] = True
    camera["hlr_target"] = "TARGET_CAMERA"
    target = bpy.data.objects.new("TARGET_CAMERA", None)
    lights.objects.link(target)
    target.location = (0, 0, 0.8)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = camera

    specs = (
        ("bed", (0.2, -0.8, 6.8), (0, 0.1, 1), (1.0, 0.9, 0.72), 1.2, 0.86, True),
        ("airway", (-2.8, 2.6, 5.7), (0, 1.55, 1), (0.72, 0.86, 1.0), 0.78, 0.72, False),
        ("equipment", (4.8, 2.2, 5.5), (4.2, 1.2, 0.9), (1.0, 0.8, 0.55), 0.7, 1.0, False),
    )
    for role, location, target_location, color, intensity, spot_size, shadow in specs:
        data = bpy.data.lights.new(f"SPOT_{role}", "SPOT")
        data.color = color
        data.energy = intensity * 1000
        data.spot_size = spot_size
        data.spot_blend = 0.72
        obj = bpy.data.objects.new(f"spotlight_{role}", data)
        lights.objects.link(obj)
        obj.location = location
        obj["hlr_light_role"] = role
        obj["hlr_intensity"] = intensity
        obj["hlr_distance"] = 15.0
        obj["hlr_decay"] = 1.35
        obj["hlr_shadow"] = shadow
        target_obj = bpy.data.objects.new(f"TARGET_{role}", None)
        lights.objects.link(target_obj)
        target_obj.location = target_location
        target_obj.empty_display_type = "SPHERE"
        target_obj.empty_display_size = 0.22
        obj["hlr_target"] = target_obj.name
        constraint = obj.constraints.new("TRACK_TO")
        constraint.target = target_obj
        constraint.track_axis = "TRACK_NEGATIVE_Z"
        constraint.up_axis = "UP_Y"


def add_instructions():
    text = bpy.data.texts.new("READ_ME_FIRST")
    text.write(
        "HLR ROOM LAYOUT\n\n"
        "1. Flytta, rotera eller skala endast de orange rotkontrollerna i LAYOUT_CONTROLS.\n"
        "2. Ändra inte kontrollernas namn eller hlr_role.\n"
        "3. Spotlights och mål finns i LIGHTS.\n"
        "4. Spara .blend och kör export_hlr_layout.py från reporoten.\n"
        "5. Blender-proxyerna visar komposition; runtime-animationerna ligger i room3d.js.\n"
    )


def main():
    room = clear_scene()
    controls = collection("LAYOUT_CONTROLS")
    proxies = collection("MODEL_PROXIES")
    lights = collection("LIGHTS")
    mats = {
        "floor": material("Floor", (0.48, 0.58, 0.52), roughness=0.82),
        "wall": material("Wall", (0.79, 0.84, 0.81), roughness=0.8),
        "white": material("Clinical white", (0.82, 0.86, 0.83), roughness=0.42),
        "pillow": material("Pillow", (0.82, 0.86, 0.84), roughness=0.9),
        "metal": material("Metal", (0.42, 0.48, 0.45), metallic=0.62, roughness=0.3),
        "dark": material("Dark polymer", (0.055, 0.075, 0.065), roughness=0.48),
        "screen": material("Screen", (0.008, 0.025, 0.018), roughness=0.18, emission=(0.02, 0.16, 0.08)),
        "skin": material("Skin", (0.69, 0.43, 0.27), roughness=0.68),
        "hair": material("Hair", (0.09, 0.06, 0.045), roughness=0.9),
        "gown": material("Patient gown", (0.48, 0.68, 0.58), roughness=0.78),
        "glass": material("Glass", (0.32, 0.7, 0.78), roughness=0.22),
        "oxygen": material("Oxygen green", (0.03, 0.48, 0.18), roughness=0.4),
        "yellow": material("Gas yellow", (0.76, 0.61, 0.12), roughness=0.5),
        "stool": material("Stool", (0.16, 0.37, 0.32), roughness=0.65),
        "sign": material("Sign", (0.03, 0.32, 0.25), roughness=0.5),
        "light": material("Ceiling light", (1.0, 0.87, 0.58), roughness=0.2, emission=(1.0, 0.73, 0.35)),
    }

    add_room_props(room, controls, proxies, mats)
    add_bed(controls, proxies, mats)
    add_patient(controls, proxies, mats)
    add_lucas(controls, proxies, mats)
    add_equipment(controls, proxies, mats)
    staff_specs = (
        ("airway_staff", (0, 2.1, 0), (0.08, 0.32, 0.58), True),
        ("compressor", (-1.19, 0.18, 0), (0.3, 0.58, 0.75), False),
        ("doctor", (1.19, -0.06, 0), (0.03, 0.17, 0.38), False),
        ("nurse_ssk", (-0.16, -1.89, 0), (0.12, 0.38, 0.66), False),
        ("ambulance", (1.41, -2.07, 0), (0.62, 0.72, 0.08), False),
        ("narkos_ssk", (4.28, 2.34, 0), (0.08, 0.29, 0.52), True),
        ("surgeon", (2.8, -2.35, 0), (0.07, 0.38, 0.3), True),
    )
    for role, location, color, cap in staff_specs:
        add_staff(role, location, color, controls, proxies, mats, cap)
    add_camera_and_lights(lights, mats)
    add_instructions()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1120
    scene.render.resolution_y = 660
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.045, 0.04)
    scene["hlr_layout_version"] = 1

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), check_existing=False)
    print(f"HLR Blender-scen skapad: {OUTPUT}")


if __name__ == "__main__":
    main()
