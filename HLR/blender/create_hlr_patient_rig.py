"""Bygg en liggande, riggad patient från Kropps-atlasens anatomiska hudyta."""

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "hlr-patient-rig.blend"
ATLAS_SKIN = HERE.parent.parent / "Kroppsatlas" / "models" / "body" / "skin.js"
ATLAS_SCALE = 0.0023
ATLAS_CENTER = Vector((-0.647, -100.7677, 781.6244))
ATLAS_FACE_PARTS = {
    "atlas_sclera_left": ("FMA59713", "eye_white", 0.025),
    "atlas_sclera_right": ("FMA59712", "eye_white", 0.025),
    "atlas_iris_left": ("FMA58237", "iris", 0.018),
    "atlas_iris_right": ("FMA58236", "iris", 0.018),
    "atlas_cornea_left": ("FMA58240", "cornea", 0.08),
    "atlas_cornea_right": ("FMA58239", "cornea", 0.08),
    "atlas_eyebrows": ("FMA54237", "eyebrow", 0.04),
}
SHELL_REFERENCES = {}


def clear_scene():
    SHELL_REFERENCES.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    bpy.data.collections["Collection"].name = "PREVIEW"
    for datablocks in (bpy.data.armatures, bpy.data.meshes, bpy.data.materials):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name, color, roughness=0.65, alpha=1.0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, alpha)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1 and hasattr(result, "surface_render_method"):
        result.surface_render_method = "DITHERED"
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


def transform_atlas_vertex(raw):
    return (
        (raw.x - ATLAS_CENTER.x) * ATLAS_SCALE,
        (raw.z - ATLAS_CENTER.z) * ATLAS_SCALE - 0.12,
        (45.2476 - raw.y) * ATLAS_SCALE,
    )


def atlas_source_root():
    configured = os.environ.get("RESUS_BODY_PARTS_ROOT")
    candidates = [
        Path(configured).expanduser() if configured else None,
        HERE.parent.parent / "Models" / "BodyParts3D_20181210i412_full",
        HERE.parent.parent.parent / "Resus" / "Models" / "BodyParts3D_20181210i412_full",
    ]
    for candidate in candidates:
        if candidate and candidate.is_dir():
            return candidate
    raise RuntimeError(
        "Saknar uppackad BodyParts3D 20181210i412-källa. "
        "Sätt RESUS_BODY_PARTS_ROOT till BodyParts3D_20181210i412_full."
    )


def find_atlas_part(root, fma_id):
    matches = sorted(root.rglob(f"*_{fma_id}_*.obj"))
    if len(matches) != 1:
        raise RuntimeError(f"Förväntade exakt en {fma_id}-modell, hittade {len(matches)}")
    return matches[0]


def load_obj(path):
    vertices = []
    faces = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("v "):
            raw = Vector(tuple(float(value) for value in line.split()[1:4]))
            vertices.append(transform_atlas_vertex(raw))
        elif line.startswith("f "):
            faces.append(tuple(int(part.split("/")[0]) - 1 for part in line.split()[1:]))
    if not vertices or not faces:
        raise RuntimeError(f"Tom Atlas-modell: {path}")
    return vertices, faces


def decimate(obj, ratio):
    modifier = obj.modifiers.new("Webboptimerad yta", "DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    source = obj.data
    used = sorted({index for polygon in source.polygons for index in polygon.vertices})
    if len(used) == len(source.vertices):
        return
    remap = {old: new for new, old in enumerate(used)}
    vertices = [source.vertices[index].co.copy() for index in used]
    faces = [tuple(remap[index] for index in polygon.vertices) for polygon in source.polygons]
    compact = bpy.data.meshes.new(source.name + "_Compact")
    compact.from_pydata(vertices, [], faces)
    for assigned_material in source.materials:
        compact.materials.append(assigned_material)
    compact.update()
    obj.data = compact
    bpy.data.meshes.remove(source)


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
    decimate(obj, 0.07)
    return obj


def clothing_mesh(name, vertices, faces, mat, material_role):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    obj["hlr_material"] = material_role
    obj["hlr_skinned"] = True
    return obj


def grid_faces(columns, rows, skip=None):
    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            if skip and skip(row, column):
                continue
            lower_left = row * columns + column
            faces.append((
                lower_left,
                lower_left + 1,
                lower_left + columns + 1,
                lower_left + columns,
            ))
    return faces


def ring_faces(columns, rows):
    faces = []
    for row in range(rows - 1):
        for column in range(columns):
            next_column = (column + 1) % columns
            lower = row * columns + column
            faces.append((
                lower,
                row * columns + next_column,
                (row + 1) * columns + next_column,
                lower + columns,
            ))
    return faces


def ellipse_tube_mesh(name, rings, segments, mat, material_role):
    vertices = []
    for y, center_x, center_z, radius_x, radius_z in rings:
        for segment in range(segments):
            angle = segment / segments * math.pi * 2
            vertices.append((
                center_x + math.cos(angle) * radius_x,
                y,
                center_z + math.sin(angle) * radius_z,
            ))
    return clothing_mesh(
        name,
        vertices,
        ring_faces(segments, len(rings)),
        mat,
        material_role,
    )


def interpolated_ring(rings, y):
    if y <= rings[0][0]:
        lower, upper = rings[0], rings[1]
    elif y >= rings[-1][0]:
        lower, upper = rings[-2], rings[-1]
    else:
        lower, upper = next(
            (rings[index], rings[index + 1])
            for index in range(len(rings) - 1)
            if rings[index][0] <= y <= rings[index + 1][0]
        )
    factor = (y - lower[0]) / (upper[0] - lower[0])
    return tuple(
        lower[index] + (upper[index] - lower[index]) * factor
        for index in range(1, 5)
    )


def validate_enclosing_tube(body, garment, rings, predicate):
    checked = 0
    largest = 0.0
    largest_point = None
    for vertex in body.data.vertices:
        point = vertex.co
        if not predicate(point):
            continue
        center_x, center_z, radius_x, radius_z = interpolated_ring(rings, point.y)
        normalized_radius = math.sqrt(
            ((point.x - center_x) / radius_x) ** 2
            + ((point.z - center_z) / radius_z) ** 2
        )
        if normalized_radius > largest:
            largest = normalized_radius
            largest_point = point.copy()
        checked += 1
    if not checked or largest >= 0.94:
        raise RuntimeError(
            f"{garment.name} omsluter inte huden: största normaliserade radie "
            f"{largest:.3f} vid {tuple(round(value, 3) for value in largest_point)}"
        )
    garment["hlr_skin_clearance"] = round(1.0 - largest, 5)
    garment["hlr_skin_intersections"] = 0
    garment["hlr_clearance_mode"] = "enclosing_tube"
    print(
        f"Omslutningskontroll {garment.name}: {checked} hudvertices, "
        f"{(1.0 - largest) * 100:.1f}% radiell reserv"
    )


def top_skin_point(body_bvh, point):
    hit = body_bvh.ray_cast(Vector((point.x, point.y, 2.0)), Vector((0, 0, -1)), 4.0)
    return hit[0] if hit and hit[0] else None


def surface_clothing_mesh(body, name, predicate, margin, mat, material_role):
    source = body.data
    body_bvh = mesh_bvh(body)
    selected = []
    used = set()
    for polygon in source.polygons:
        center = sum((source.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        top = top_skin_point(body_bvh, center)
        if predicate(center, polygon.normal) and top and center.z >= top.z - 0.045:
            face = tuple(polygon.vertices)
            selected.append(face)
            used.update(face)
    if not selected:
        raise RuntimeError(f"Klädregionen {name} saknar polygoner")
    remap = {old: new for new, old in enumerate(sorted(used))}
    vertices = []
    for old in sorted(used):
        source_vertex = source.vertices[old]
        top = top_skin_point(body_bvh, source_vertex.co)
        if not top:
            raise RuntimeError(f"Saknar hudyta under vertex i {name}")
        # Vertikal projektion är robust för den ryggliggande patientens synliga klädlager.
        fold = 0.0025 * (1.0 + math.sin(source_vertex.co.y * 19 + source_vertex.co.x * 13))
        vertices.append(Vector((source_vertex.co.x, source_vertex.co.y, top.z + margin + fold)))
    faces = [tuple(remap[index] for index in face) for face in selected]
    return clothing_mesh(name, vertices, faces, mat, material_role)


def shell_clothing_mesh(body, name, predicate, outward, margin, mat, material_role):
    source = body.data
    selected = []
    used = set()
    for polygon in source.polygons:
        center = sum((source.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        if predicate(center):
            face = tuple(polygon.vertices)
            selected.append(face)
            used.update(face)
    if not selected:
        raise RuntimeError(f"Klädskalet {name} saknar polygoner")
    remap = {old: new for new, old in enumerate(sorted(used))}
    vertices = []
    for old in sorted(used):
        source_vertex = source.vertices[old]
        direction = outward(source_vertex.co)
        if direction.length < 0.0001:
            direction = Vector((0, 0, 1))
        fold = 0.002 * (1.0 + math.sin(source_vertex.co.y * 17 + source_vertex.co.x * 11))
        vertices.append(source_vertex.co + direction.normalized() * (margin + fold))
    faces = [tuple(remap[index] for index in face) for face in selected]
    SHELL_REFERENCES[name] = {
        "vertices": [source.vertices[old].co.copy() for old in sorted(used)],
        "faces": faces,
    }
    return clothing_mesh(name, vertices, faces, mat, material_role)


def mesh_bvh(obj):
    return BVHTree.FromPolygons(
        [vertex.co.copy() for vertex in obj.data.vertices],
        [tuple(polygon.vertices) for polygon in obj.data.polygons],
        all_triangles=False,
    )


def shell_face_sample_pairs(garment, reference, face_index):
    polygon = garment.data.polygons[face_index]
    indices = tuple(polygon.vertices)
    points = [garment.data.vertices[index].co for index in indices]
    source_points = [reference["vertices"][index] for index in indices]
    return [(point, source_point) for point, source_point in zip(points, source_points)]


def shell_reference_clearance(sample, source_sample, outward):
    direction = outward(source_sample)
    if direction.length < 0.0001:
        direction = sample - source_sample
    return (sample - source_sample).dot(direction.normalized())


def raise_shell_outside_body(garment, outward, minimum):
    reference = SHELL_REFERENCES[garment.name]
    for _iteration in range(20):
        corrections = {}
        for face_index, polygon in enumerate(garment.data.polygons):
            deficit = max(
                (
                    minimum - shell_reference_clearance(sample, source_sample, outward)
                    for sample, source_sample in shell_face_sample_pairs(
                        garment,
                        reference,
                        face_index,
                    )
                ),
                default=0.0,
            )
            if deficit > 0:
                for index in polygon.vertices:
                    corrections[index] = max(corrections.get(index, 0.0), deficit + 0.001)
        if not corrections:
            return
        for index, correction in corrections.items():
            vertex = garment.data.vertices[index]
            direction = outward(reference["vertices"][index])
            if direction.length < 0.0001:
                direction = Vector((0, 0, 1))
            vertex.co += direction.normalized() * correction
        garment.data.update()
    raise RuntimeError(f"{garment.name} kunde inte flyttas helt utanför kroppen")


def validate_shell_clearance(body, garments):
    for garment, outward, minimum in garments:
        raise_shell_outside_body(garment, outward, minimum)
        reference = SHELL_REFERENCES[garment.name]
        sample_pairs = [
            pair
            for face_index in range(len(garment.data.polygons))
            for pair in shell_face_sample_pairs(
                garment,
                reference,
                face_index,
            )
        ]
        clearances = [
            shell_reference_clearance(sample, source_sample, outward)
            for sample, source_sample in sample_pairs
        ]
        smallest = min(clearances)
        wrong_side = sum(clearance <= 0 for clearance in clearances)
        if wrong_side or smallest < minimum:
            raise RuntimeError(
                f"{garment.name} skär kroppen runtom: {wrong_side} prover på insidan, "
                f"minsta radiella marginal {smallest:.4f} m"
            )
        garment["hlr_skin_clearance"] = round(smallest, 5)
        garment["hlr_skin_intersections"] = 0
        garment["hlr_clearance_mode"] = "radial_360"
        print(
            f"360-kontroll {garment.name}: {len(sample_pairs)} ytprover, "
            f"{smallest:.4f} m, alla utanför kroppen"
        )


def raise_clothing_above_skin(body_bvh, garment, minimum):
    for _iteration in range(20):
        corrections = {}
        for polygon in garment.data.polygons:
            points = [garment.data.vertices[index].co for index in polygon.vertices]
            samples = [*points, sum(points, Vector()) / len(points)]
            samples.extend(
                (points[index] + points[(index + 1) % len(points)]) / 2
                for index in range(len(points))
            )
            deficit = 0.0
            for sample in samples:
                top = top_skin_point(body_bvh, sample)
                if top:
                    deficit = max(deficit, minimum - (sample.z - top.z))
            if deficit > 0:
                for index in polygon.vertices:
                    corrections[index] = max(corrections.get(index, 0.0), deficit + 0.001)
        if not corrections:
            return
        for index, correction in corrections.items():
            garment.data.vertices[index].co.z += correction
        garment.data.update()
    raise RuntimeError(f"{garment.name} kunde inte lyftas helt utanför huden")


def validate_clothing_clearance(body, garments):
    body_bvh = mesh_bvh(body)
    for garment, minimum in garments:
        raise_clothing_above_skin(body_bvh, garment, minimum)
        samples = [vertex.co for vertex in garment.data.vertices]
        for polygon in garment.data.polygons:
            points = [garment.data.vertices[index].co for index in polygon.vertices]
            samples.append(sum(points, Vector()) / len(points))
            samples.extend(
                (points[index] + points[(index + 1) % len(points)]) / 2
                for index in range(len(points))
            )
        clearances = []
        for sample in samples:
            top = top_skin_point(body_bvh, sample)
            if top:
                clearances.append(sample.z - top.z)
        smallest = min(clearances)
        wrong_side = sum(clearance <= 0 for clearance in clearances)
        if wrong_side or smallest < minimum:
            raise RuntimeError(
                f"{garment.name} skär huden: {wrong_side} prover på insidan, "
                f"minsta samplade avstånd {smallest:.4f} m"
            )
        garment["hlr_skin_clearance"] = round(smallest, 5)
        garment["hlr_skin_intersections"] = 0
        print(
            f"Klädkontroll {garment.name}: {len(samples)} ytprover, "
            f"{smallest:.4f} m, alla utanför huden"
        )


def create_patient_clothing(body, armature, gown_mat, sheet_mat, pants_mat):
    torso_outward = lambda point: Vector((point.x, 0, point.z - 0.14))
    closed = surface_clothing_mesh(
        body,
        "gown_closed_panel",
        lambda center, normal: (
            -0.58 <= center.y <= 0.80
            and abs(center.x) <= 0.43
            and center.z >= 0.20
        ),
        0.016,
        gown_mat,
        "gown",
    )
    assign_torso_cloth_weights(closed, armature)

    panels = []
    yokes = []
    sleeves = []
    shell_checks = []
    for side, sign in (("L", -1), ("R", 1)):
        side_panel = shell_clothing_mesh(
            body,
            f"gown_open_panel_{side}",
            lambda center, sign=sign: (
                -0.74 <= center.y <= 0.80
                and abs(center.x) <= 0.72
                and (
                    0.26 <= sign * center.x
                    or (center.z <= 0.34 and -0.08 <= sign * center.x)
                )
            ),
            torso_outward,
            0.035,
            gown_mat,
            "gown",
        )
        assign_torso_cloth_weights(side_panel, armature)
        panels.append(side_panel)
        shell_checks.append((side_panel, torso_outward, 0.012))

        yoke = shell_clothing_mesh(
            body,
            f"gown_shoulder_yoke_{side}",
            lambda center, sign=sign: (
                0.42 <= center.y <= 1.20
                and -0.02 <= sign * center.x <= 0.78
                and (0.12 <= sign * center.x or center.z <= 0.34)
            ),
            torso_outward,
            0.030,
            gown_mat,
            "gown",
        )
        assign_torso_cloth_weights(yoke, armature)
        yokes.append(yoke)
        shell_checks.append((yoke, torso_outward, 0.012))

        arm_outward = lambda point, sign=sign: Vector((
            point.x - sign * 0.58,
            0,
            point.z - 0.16,
        ))
        sleeve = shell_clothing_mesh(
            body,
            f"gown_sleeve_{side}",
            lambda center, sign=sign: (
                -0.02 <= center.y <= 0.68
                and 0.38 <= sign * center.x <= 0.86
            ),
            arm_outward,
            0.030,
            gown_mat,
            "gown",
        )
        assign_skin_weights(sleeve, armature)
        sleeves.append(sleeve)
        shell_checks.append((sleeve, arm_outward, 0.012))

    pelvis_rings = (
        (-0.98, 0.0, 0.13, 0.50, 0.40),
        (-0.82, 0.0, 0.13, 0.54, 0.42),
        (-0.60, 0.0, 0.14, 0.62, 0.48),
        (-0.35, 0.0, 0.14, 0.62, 0.48),
        (-0.10, 0.0, 0.14, 0.62, 0.48),
    )
    pants_pelvis = ellipse_tube_mesh(
        "patient_pants_pelvis",
        pelvis_rings,
        28,
        pants_mat,
        "pants",
    )
    assign_rigid_skin(pants_pelvis, armature, "root")
    validate_enclosing_tube(
        body,
        pants_pelvis,
        pelvis_rings,
        lambda point: (
            -0.98 <= point.y <= -0.10
            and abs(point.x) <= 0.45
            and point.z <= 0.50
        ),
    )
    pants_legs = []
    for side, sign in (("L", -1), ("R", 1)):
        leg_rings = (
            (-1.85, sign * 0.20, 0.11, 0.17, 0.27),
            (-1.62, sign * 0.20, 0.12, 0.18, 0.26),
            (-1.38, sign * 0.20, 0.12, 0.20, 0.32),
            (-1.14, sign * 0.20, 0.13, 0.22, 0.32),
            (-0.90, sign * 0.20, 0.13, 0.24, 0.33),
            (-0.68, sign * 0.20, 0.13, 0.27, 0.36),
        )
        leg = ellipse_tube_mesh(
            f"patient_pants_leg_{side}",
            leg_rings,
            24,
            pants_mat,
            "pants",
        )
        assign_skin_weights(leg, armature)
        pants_legs.append(leg)
        validate_enclosing_tube(
            body,
            leg,
            leg_rings,
            lambda point, sign=sign: (
                -1.85 <= point.y <= -0.68
                and 0.0 <= sign * point.x <= 0.55
                and point.z <= 0.40
            ),
        )

    sheet_ys = (-1.98, -1.82, -1.62, -1.42, -1.22, -1.02, -0.82, -0.57, -0.38, -0.22)
    sheet_widths = (0.45, 0.47, 0.50, 0.54, 0.58, 0.62, 0.65, 0.68, 0.69, 0.67)
    sheet_heights = (0.25, 0.28, 0.32, 0.39, 0.46, 0.52, 0.56, 0.59, 0.61, 0.60)
    fractions = (-1.18, -1.0, -0.75, -0.50, -0.25, 0.0, 0.25, 0.50, 0.75, 1.0, 1.18)
    sheet_vertices = []
    for row, y in enumerate(sheet_ys):
        for fraction in fractions:
            edge_drop = max(0.0, abs(fraction) - 1.0) / 0.18 * 0.16
            fold = (
                0.022
                * math.cos(fraction * math.pi * 3 + row * 0.55)
                * (1 - min(1, abs(fraction)))
            )
            sheet_vertices.append((
                fraction * sheet_widths[row],
                y,
                sheet_heights[row] - edge_drop + fold,
            ))
    sheet = clothing_mesh(
        "patient_leg_sheet",
        sheet_vertices,
        grid_faces(len(fractions), len(sheet_ys)),
        sheet_mat,
        "sheet",
    )
    assign_rigid_object(sheet, armature, "root")
    for pants_part in (pants_pelvis, *pants_legs):
        raise_clothing_above_skin(mesh_bvh(pants_part), sheet, 0.018)
    sheet["hlr_pants_clearance"] = 0.018
    validate_shell_clearance(body, shell_checks)
    validate_clothing_clearance(
        body,
        [
            (closed, 0.004),
            (sheet, 0.004),
        ],
    )
    return closed, panels, sheet


def create_hair_shell(body, mat):
    source = body.data
    selected = []
    used = set()
    for polygon in source.polygons:
        center = sum((source.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        # Atlasen saknar frisyr; ett skal av bakre/övre skalpen ger en redigerbar lågpolybas.
        if center.y >= 1.48 and (center.z <= 0.44 or center.y >= 1.72):
            face = tuple(polygon.vertices)
            selected.append(face)
            used.update(face)
    remap = {old: new for new, old in enumerate(sorted(used))}
    vertices = [source.vertices[old].co.copy() for old in sorted(used)]
    faces = [tuple(remap[index] for index in face) for face in selected]
    mesh = bpy.data.meshes.new("AtlasPatientHair")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for vertex in mesh.vertices:
        vertex.co += vertex.normal * 0.018
    mesh.update()
    obj = bpy.data.objects.new("atlas_hair_shell", mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    obj["hlr_material"] = "hair"
    obj["hlr_skinned"] = True
    return obj


def create_atlas_face_parts(armature, materials):
    root = atlas_source_root()
    result = []
    for name, (fma_id, material_role, ratio) in ATLAS_FACE_PARTS.items():
        vertices, faces = load_obj(find_atlas_part(root, fma_id))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        assign(obj, materials[material_role])
        obj["hlr_material"] = material_role
        obj["hlr_skinned"] = True
        decimate(obj, ratio)
        assign_rigid_skin(obj, armature, "head")
        result.append(obj)
    return result


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


def attach_armature_modifier(obj, armature):
    modifier = obj.modifiers.new("Patientarmatur", "ARMATURE")
    modifier.object = armature
    modifier.use_vertex_groups = True
    obj["hlr_armature"] = armature.name


def assign_skin_weights(obj, armature):
    segments = {
        bone.name: (bone.head_local.copy(), bone.tail_local.copy())
        for bone in armature.data.bones
        if bone.use_deform
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
    attach_armature_modifier(obj, armature)


def assign_rigid_skin(obj, armature, bone_name):
    group = obj.vertex_groups.new(name=bone_name)
    group.add(tuple(vertex.index for vertex in obj.data.vertices), 1.0, "REPLACE")
    obj.parent = armature
    attach_armature_modifier(obj, armature)


def assign_rigid_object(obj, armature, bone_name):
    obj["hlr_skinned"] = False
    obj.pop("hlr_armature", None)
    parent_to_bone(obj, armature, bone_name)


def assign_torso_cloth_weights(obj, armature):
    root = obj.vertex_groups.new(name="root")
    chest = obj.vertex_groups.new(name="chest")
    for vertex in obj.data.vertices:
        chest_weight = max(0.0, min(1.0, (vertex.co.y + 0.52) / 0.62))
        root.add((vertex.index,), 1.0 - chest_weight, "REPLACE")
        chest.add((vertex.index,), chest_weight, "REPLACE")
    obj.parent = armature
    attach_armature_modifier(obj, armature)


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
    armature["hlr_rest_pose"] = "anatomical_neutral_supinated"
    armature["hlr_support_pose"] = "Patient_SupineGravity"
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
        # Samma vertikala rullreferens ger speglade lemmar förutsägbara poseaxlar.
        bone.align_roll(Vector((0, 0, 1)))
        if parent:
            bone.parent = created[parent]
        created[name] = bone
    controls = (
        ("hand_ik.L", (-0.68, -0.50, 0.15), (-0.68, -0.50, 0.30)),
        ("hand_ik.R", (0.68, -0.50, 0.15), (0.68, -0.50, 0.30)),
        ("elbow_pole.L", (-1.00, 0.02, 0.35), (-1.00, 0.02, 0.50)),
        ("elbow_pole.R", (1.00, 0.02, 0.35), (1.00, 0.02, 0.50)),
        ("foot_ik.L", (-0.21, -1.90, 0.10), (-0.21, -1.90, 0.25)),
        ("foot_ik.R", (0.21, -1.90, 0.10), (0.21, -1.90, 0.25)),
        ("knee_pole.L", (-0.55, -1.28, 0.45), (-0.55, -1.28, 0.60)),
        ("knee_pole.R", (0.55, -1.28, 0.45), (0.55, -1.28, 0.60)),
    )
    for name, head, tail in controls:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.parent = created["root"]
        bone.use_deform = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for name, _head, _tail in controls:
        data.bones[name]["hlr_control"] = True
    return armature


def reset_pose(armature):
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)


def create_pose_action(armature, name, rotations=None):
    reset_pose(armature)
    for bone_name, rotation in (rotations or {}).items():
        armature.pose.bones[bone_name].rotation_euler = rotation
    armature.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action["hlr_pose_asset"] = True
    armature.animation_data.action = action
    for bone in armature.pose.bones:
        if not bone.bone.use_deform:
            continue
        bone.keyframe_insert("location", frame=1, group=bone.name)
        bone.keyframe_insert("rotation_euler", frame=1, group=bone.name)
        bone.keyframe_insert("scale", frame=1, group=bone.name)
    armature.animation_data.action = None
    return action


def create_pose_library(armature):
    degrees = math.radians
    create_pose_action(armature, "Patient_Neutral")
    gravity = create_pose_action(armature, "Patient_SupineGravity")
    gravity["hlr_support_contacts"] = "hand_back.L,hand_back.R,heel.L,heel.R"
    create_pose_action(
        armature,
        "Patient_ArmsAbducted",
        {
            "upper_arm.L": (0, 0, degrees(-25)),
            "upper_arm.R": (0, 0, degrees(25)),
        },
    )
    create_pose_action(
        armature,
        "Patient_IVAccess",
        {
            "upper_arm.R": (0, 0, degrees(18)),
        },
    )
    create_pose_action(
        armature,
        "Patient_HeadTiltChinLift",
        {"head": (degrees(-10), 0, 0)},
    )
    create_pose_action(
        armature,
        "Patient_HipKneeFlexion",
        {
            "thigh.L": (degrees(32), 0, 0),
            "shin.L": (degrees(-48), 0, 0),
        },
    )
    reset_pose(armature)
    armature.animation_data.action = None


def create_support_contacts():
    collection = bpy.data.collections.new("SUPPORT_CONTACTS")
    bpy.context.scene.collection.children.link(collection)
    contacts = {
        "hand_back.L": (-0.69, -0.62, -0.02),
        "hand_back.R": (0.69, -0.62, -0.02),
        "wrist_support.L": (-0.67, -0.48, -0.02),
        "wrist_support.R": (0.67, -0.48, -0.02),
        "heel.L": (-0.21, -1.91, -0.02),
        "heel.R": (0.21, -1.91, -0.02),
        "calf_support.L": (-0.20, -1.55, -0.02),
        "calf_support.R": (0.20, -1.55, -0.02),
    }
    for name, location in contacts.items():
        obj = bpy.data.objects.new("SUPPORT_" + name, None)
        collection.objects.link(obj)
        obj.location = location
        obj.empty_display_type = "CIRCLE"
        obj.empty_display_size = 0.055
        obj.show_in_front = True
        obj["hlr_support_contact"] = name


def create_meshes(armature):
    mats = {
        "skin": material("Skin", (0.67, 0.42, 0.27)),
        "gown": material("Patient gown", (0.43, 0.67, 0.57)),
        "sheet": material("Patient sheet", (0.78, 0.84, 0.81), roughness=0.82),
        "pants": material("Patient pants", (0.20, 0.31, 0.38), roughness=0.78),
        "hair": material("Hair", (0.08, 0.055, 0.04)),
        "dark": material("Eyes", (0.025, 0.035, 0.03)),
        "lips": material("Lips", (0.38, 0.16, 0.18)),
        "eye_white": material("Eye whites", (0.86, 0.84, 0.78)),
        "iris": material("Iris", (0.24, 0.36, 0.28), roughness=0.35),
        "cornea": material("Cornea", (0.64, 0.82, 0.86), roughness=0.12, alpha=0.22),
        "eyebrow": material("Eyebrows", (0.07, 0.048, 0.035)),
        "wristband": material("Patient wristband", (0.84, 0.88, 0.82)),
    }
    body = create_atlas_body(mats["skin"])
    hair = create_hair_shell(body, mats["hair"])
    assign_skin_weights(body, armature)
    assign_rigid_skin(hair, armature, "head")
    create_patient_clothing(body, armature, mats["gown"], mats["sheet"], mats["pants"])
    create_atlas_face_parts(armature, mats)
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
        "Rest pose är anatomisk neutralposition med supinerade underarmar och uppåtvända handflator.\n"
        "atlas_body_mesh är en webboptimerad kopia av Kropps-atlasens BodyParts3D-hud.\n"
        "Posera HLR_PATIENT_RIG i Pose Mode. Ändra inte bennamn eller ankarnamn.\n"
        "Posebiblioteket innehåller neutral-, gravitations- och kliniska testposer.\n"
        "SUPPORT_CONTACTS markerar handryggarnas, handledernas, vadernas och hälarnas underlag.\n"
        "patient_leg_sheet är rigid mot root och saknar Armature-modifier.\n"
        "CLINICAL_ANCHORS styr sternum, luftväg, plattor, infart och ultraljud i webben.\n"
        "Kör export_hlr_patient_rig.py efter en avsiktlig modelländring.\n"
    )


def main():
    clear_scene()
    armature = create_armature()
    create_meshes(armature)
    create_pose_library(armature)
    create_support_contacts()
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
