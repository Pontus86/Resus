"""Bygg redigerbara detaljmeshar för HLR-rummets fyra viktigaste apparater."""

from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-equipment-details.blend"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    bpy.data.collections["Collection"].name = "PREVIEW"
    for datablocks in (bpy.data.meshes, bpy.data.materials):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name, color, metallic=0.0, roughness=0.55):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def three_position(values):
    x, y, z = values
    return x, -z, y


def three_dimensions(values):
    x, y, z = values
    return x, z, y


def tag(obj, role, part, material_role):
    obj["hlr_equipment_role"] = role
    obj["hlr_part"] = part
    obj["hlr_material"] = material_role


def move_to(obj, collection):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)


def cube(root, role, part, position, dimensions, mat, material_role, rotation_z=0.0, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.name = part
    obj.parent = root
    obj.location = three_position(position)
    obj.dimensions = three_dimensions(dimensions)
    obj.rotation_euler[1] = -rotation_z
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Mjuka kanter", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    tag(obj, role, part, material_role)
    move_to(obj, root.users_collection[0])
    return obj


def sphere(root, role, part, position, scale, mat, material_role, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1)
    obj = bpy.context.object
    obj.name = part
    obj.parent = root
    obj.location = three_position(position)
    obj.scale = three_dimensions(scale)
    obj.data.materials.append(mat)
    tag(obj, role, part, material_role)
    move_to(obj, root.users_collection[0])
    return obj


def cylinder(root, role, part, position, radius, height, mat, material_role, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height)
    obj = bpy.context.object
    obj.name = part
    obj.parent = root
    obj.location = three_position(position)
    obj.data.materials.append(mat)
    tag(obj, role, part, material_role)
    move_to(obj, root.users_collection[0])
    return obj


def role_root(collection, role, x):
    root = bpy.data.objects.new(role.upper() + "_DETAILS", None)
    collection.objects.link(root)
    root.location.x = x
    root["hlr_equipment_root"] = role
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.22
    return root


def add_defibrillator(root, mats):
    role = "defib"
    cube(root, role, "defib_printer_slot", (-0.28, 1.48, 0.394), (0.42, 0.08, 0.045), mats["dark"], "dark")
    cube(root, role, "defib_paper", (-0.28, 1.35, 0.425), (0.36, 0.25, 0.018), mats["paper"], "paper", rotation_z=-0.04)
    for index in range(5):
        cube(root, role, f"defib_paper_trace_{index}", (-0.28, 1.39-index*0.035, 0.438),
             (0.24, 0.008, 0.008), mats["green"], "green", rotation_z=(index % 2-.5)*0.16, bevel=0)
    for side in (-1, 1):
        cylinder(root, role, f"defib_cable_port_{side:+d}", (side*0.36, 1.43, 0.40), 0.055, 0.04, mats["metal"], "metal")
    cube(root, role, "defib_brand_plate", (0, 2.13, 0.32), (0.48, 0.09, 0.025), mats["red"], "red")


def add_ultrasound(root, mats):
    role = "ultrasound"
    sphere(root, role, "ultrasound_trackball", (0, 1.205, 0.48), (0.082, 0.045, 0.082), mats["blue"], "blue", 2)
    for index in range(5):
        cylinder(root, role, f"ultrasound_softkey_{index}", (-0.32+index*0.16, 1.30, 0.19), 0.025, 0.025, mats["amber"], "amber", 10)
    cylinder(root, role, "ultrasound_gel_bottle", (-0.52, 1.15, 0.08), 0.07, 0.24, mats["glass"], "glass", 14)
    cylinder(root, role, "ultrasound_gel_cap", (-0.52, 1.29, 0.08), 0.045, 0.05, mats["blue"], "blue", 12)
    cube(root, role, "ultrasound_probe_label", (-0.66, 0.94, 0.13), (0.12, 0.22, 0.025), mats["paper"], "paper")


def add_ventilator(root, mats):
    role = "ventilator"
    cylinder(root, role, "ventilator_pressure_gauge", (0.24, 1.28, 0.38), 0.12, 0.035, mats["paper"], "paper", 24)
    cube(root, role, "ventilator_pressure_needle", (0.24, 1.28, 0.405), (0.012, 0.16, 0.012),
         mats["red"], "red", rotation_z=-0.55, bevel=0)
    for index, color in enumerate(("green", "blue")):
        cylinder(root, role, f"ventilator_gas_port_{color}", (-0.23+index*0.18, 1.08, 0.38),
                 0.055, 0.045, mats[color], color, 14)
    cylinder(root, role, "ventilator_water_level", (-0.38, 0.86, 0.055), 0.105, 0.22, mats["water"], "water", 16)
    sphere(root, role, "ventilator_alarm_beacon", (0.38, 1.82, 0.08), (0.07, 0.06, 0.07), mats["amber"], "amber", 2)


def add_lucas(root, mats):
    role = "lucas"
    cylinder(root, role, "lucas_emergency_stop", (-0.34, 2.09, 0.105), 0.085, 0.055, mats["red"], "red", 18)
    for index in range(3):
        cube(root, role, f"lucas_battery_rib_{index}", (0.40+index*0.10, 2.17, 0.01),
             (0.035, 0.27, 0.38), mats["dark"], "dark", bevel=0.012)
    for side in (-1, 1):
        cube(root, role, f"lucas_strap_buckle_{side:+d}", (side*0.56, 1.10, 0.28),
             (0.20, 0.08, 0.16), mats["metal"], "metal")
    for index in range(4):
        cube(root, role, f"lucas_depth_mark_{index}", (0.245, 1.58+index*0.08, -0.18),
             (0.025, 0.008, 0.12), mats["paper"], "paper", bevel=0)


def add_preview_proxy(preview, root, role, mats):
    dimensions = {
        "defib": (1.25, 2.05, 0.65),
        "ultrasound": (1.05, 1.85, 0.70),
        "ventilator": (1.0, 1.9, 0.68),
        "lucas": (1.8, 2.0, 1.1),
    }[role]
    bpy.ops.mesh.primitive_cube_add()
    proxy = bpy.context.object
    proxy.name = "PREVIEW_" + role
    proxy.location = root.location + Vector(three_position((0, dimensions[1]/2, 0)))
    proxy.dimensions = three_dimensions(dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    proxy.data.materials.append(mats["proxy"])
    for collection in list(proxy.users_collection):
        collection.objects.unlink(proxy)
    preview.objects.link(proxy)


def create_scene():
    details = bpy.data.collections.new("EQUIPMENT_DETAILS")
    bpy.context.scene.collection.children.link(details)
    mats = {
        "dark": material("Dark", (0.035, 0.05, 0.045)),
        "paper": material("Paper", (0.92, 0.92, 0.86)),
        "metal": material("Metal", (0.45, 0.52, 0.49), metallic=0.7, roughness=0.3),
        "red": material("Red", (0.72, 0.08, 0.05)),
        "green": material("Green", (0.12, 0.75, 0.42)),
        "blue": material("Blue", (0.15, 0.46, 0.72)),
        "amber": material("Amber", (0.92, 0.58, 0.08)),
        "glass": material("Gel", (0.58, 0.82, 0.85), roughness=0.18),
        "water": material("Water", (0.35, 0.72, 0.82), roughness=0.12),
        "proxy": material("Preview proxy", (0.17, 0.22, 0.20), metallic=0.1, roughness=0.8),
    }
    roots = {
        role: role_root(details, role, x)
        for role, x in (("defib", -3.3), ("ultrasound", -1.1), ("ventilator", 1.1), ("lucas", 3.3))
    }
    add_defibrillator(roots["defib"], mats)
    add_ultrasound(roots["ultrasound"], mats)
    add_ventilator(roots["ventilator"], mats)
    add_lucas(roots["lucas"], mats)
    preview = bpy.data.collections["PREVIEW"]
    for role, root in roots.items():
        add_preview_proxy(preview, root, role, mats)

    bpy.ops.object.camera_add(location=(7.8, -11.5, 6.4))
    camera = bpy.context.object
    camera.name = "PREVIEW_CAMERA"
    camera.data.lens = 58
    move_to(camera, preview)
    bpy.context.scene.camera = camera
    target = bpy.data.objects.new("PREVIEW_TARGET", None)
    preview.objects.link(target)
    target.location = (0, 0, 1.0)
    track = camera.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    for name, location, energy in (("KEY", (-4, -5, 7), 1200), ("FILL", (5, -2, 5), 850)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = 4
        light = bpy.data.objects.new(name, data)
        preview.objects.link(light)
        light.location = location


def main():
    clear_scene()
    create_scene()
    scene = bpy.context.scene
    scene["hlr_equipment_detail_version"] = 1
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 650
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.045, 0.04)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), check_existing=False)
    print(f"HLR-utrustningsdetaljer skapade: {OUTPUT}")


if __name__ == "__main__":
    main()
