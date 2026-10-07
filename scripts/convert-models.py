"""
Convert licensed 3D model packs into web-ready .glb files (Draco + resized textures).

Run headless with Blender (developed against Blender 5.2 LTS):

    blender -b --python scripts/convert-models.py -- \
        --src /home/smoker/Downloads/envato/extracted \
        --out public/models \
        [--only chair,candle] [--manifest scripts/models.json]

Verification + previews (re-imports every .glb, measures it, renders a 512px preview):

    blender -b --python scripts/convert-models.py -- --verify \
        --out public/models --preview-dir /tmp/previews --report /tmp/report.json \
        [--only chair] [--light neutral|side]

Per model (see scripts/models.json): import -> bake transforms into the mesh -> fix
orientation (Z-up in Blender, exported Y-up) -> uniform scale to real-world metres ->
pivot at bottom-centre -> optional collapse decimation -> rebuild a clean glTF PBR material
from the texture files (resized, roughness/metal/AO packed into one ORM image) ->
export one .glb per "output" with Draco compression.

The output directory is gitignored on purpose: the sources are licensed and must not be
redistributed. Never commit anything it produces.
"""

import argparse
import json
import math
import os
import shutil
import struct
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


# --------------------------------------------------------------------------- args


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default=os.path.join(SCRIPT_DIR, "models.json"))
    p.add_argument("--src", default="/home/smoker/Downloads/envato/extracted",
                   help="root folder holding one extracted folder per slug")
    p.add_argument("--out", default=os.path.join(SCRIPT_DIR, "..", "public", "models"))
    p.add_argument("--only", default="", help="comma separated slugs")
    p.add_argument("--verify", action="store_true", help="measure + preview existing glbs instead of converting")
    p.add_argument("--preview-dir", default="")
    p.add_argument("--light", default="neutral", choices=["neutral", "side"])
    p.add_argument("--report", default="")
    p.add_argument("--no-draco", action="store_true")
    return p.parse_args(argv)


# --------------------------------------------------------------------------- scene helpers


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_source(path, opts):
    ext = path.lower().rsplit(".", 1)[-1]
    if ext == "blend":
        bpy.ops.wm.open_mainfile(filepath=path)
    elif ext == "obj":
        kw = {"filepath": path}
        if "forward_axis" in opts:
            kw["forward_axis"] = opts["forward_axis"]
        if "up_axis" in opts:
            kw["up_axis"] = opts["up_axis"]
        bpy.ops.wm.obj_import(**kw)
    elif ext in ("glb", "gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == "fbx":
        kw = {"filepath": path}
        bpy.ops.import_scene.fbx(**kw)
    else:
        raise RuntimeError("unsupported source format: " + path)


def bake_transforms():
    """Drop non-mesh objects, unparent and bake every world matrix into its mesh."""
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    for o in bpy.data.objects:
        o.hide_set(False) if o.name in bpy.context.view_layer.objects else None
        o.hide_viewport = False
        o.hide_render = False
        for m in list(o.modifiers):
            o.modifiers.remove(m)
        # make sure every object owns its mesh
        if o.data.users > 1:
            o.data = o.data.copy()
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        if mw.determinant() < 0:
            o.data.flip_normals()
        o.matrix_world = Matrix.Identity(4)
        o.data.update()


def verts_np(obj):
    n = len(obj.data.vertices)
    a = np.empty(n * 3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", a)
    return a.reshape(n, 3)


def bounds(objs):
    mn = np.array([1e30] * 3)
    mx = np.array([-1e30] * 3)
    for o in objs:
        v = verts_np(o)
        mn = np.minimum(mn, v.min(axis=0))
        mx = np.maximum(mx, v.max(axis=0))
    return mn, mx


def transform_objs(objs, mat):
    for o in objs:
        o.data.transform(mat)
        o.data.update()


def tri_count(objs):
    t = 0
    for o in objs:
        o.data.calc_loop_triangles()
        t += len(o.data.loop_triangles)
    return t


def copy_objects(objs, suffix):
    out = []
    for o in objs:
        c = o.copy()
        c.data = o.data.copy()
        c.name = o.name + suffix
        bpy.context.scene.collection.objects.link(c)
        out.append(c)
    return out


def apply_decimate(objs, ratio):
    for o in objs:
        mod = o.modifiers.new("Decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def axis_index(a):
    return {"x": 0, "y": 1, "z": 2}[a]


# --------------------------------------------------------------------------- textures


class TexCache:
    """Loads source images as raw (non-colour-managed) float arrays, box-downsampled to `size`."""

    def __init__(self, src_root, size, workdir):
        self.src_root = src_root
        self.size = size
        self.workdir = workdir
        self.arrays = {}
        self.n = 0

    def load(self, rel):
        if rel in self.arrays:
            return self.arrays[rel]
        path = os.path.join(self.src_root, rel)
        img = bpy.data.images.load(path, check_existing=False)
        img.colorspace_settings.name = "Non-Color"
        w, h = img.size
        if max(w, h) > self.size:
            f = self.size / max(w, h)
            nw, nh = max(1, round(w * f)), max(1, round(h * f))
            if w % nw == 0 and h % nh == 0:
                a = np.empty(w * h * 4, dtype=np.float32)
                img.pixels.foreach_get(a)
                a = a.reshape(nh, h // nh, nw, w // nw, 4).mean(axis=(1, 3))
                bpy.data.images.remove(img)
                self.arrays[rel] = a
                return a
            img.scale(nw, nh)
            w, h = nw, nh
        a = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        bpy.data.images.remove(img)
        a = a.reshape(h, w, 4)
        self.arrays[rel] = a
        return a

    def channel(self, spec):
        """spec: number | {file, channel: r|g|b|a|luma, invert, gain, bias}. Returns 2D array or float."""
        if isinstance(spec, (int, float)):
            return float(spec)
        a = self.load(spec["file"])
        ch = spec.get("channel", "r")
        if ch == "luma":
            c = a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722
        else:
            c = a[..., "rgba".index(ch)]
        if spec.get("invert"):
            c = 1.0 - c
        c = c * spec.get("gain", 1.0) + spec.get("bias", 0.0)
        return np.clip(c, 0.0, 1.0)

    def save_png(self, name, rgba):
        path = os.path.join(self.workdir, name + ".png")
        h, w = rgba.shape[:2]
        img = bpy.data.images.new("tmp_" + name, w, h, alpha=True)
        img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.ascontiguousarray(rgba, dtype=np.float32).ravel())
        img.file_format = "PNG"
        img.filepath_raw = path
        img.save()
        bpy.data.images.remove(img)
        return path

    def bump_to_normal(self, rel, strength):
        a = self.load(rel)
        height = a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722
        dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
        dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
        nx, ny = -dx * strength, -dy * strength  # rows are bottom-up == +v, OpenGL (+Y) convention
        nz = np.ones_like(nx)
        ln = np.sqrt(nx * nx + ny * ny + nz * nz)
        out = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5,
                        np.ones_like(nx)], axis=-1)
        return out

    def next_name(self, prefix):
        self.n += 1
        return "%s_%d" % (prefix, self.n)


def get_gltf_output_group():
    name = "glTF Material Output"
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    g.interface.new_socket("Occlusion", socket_type="NodeSocketFloat")
    g.nodes.new("NodeGroupOutput")
    return g


def load_node_image(nodes, path, srgb):
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    n = nodes.new("ShaderNodeTexImage")
    n.image = img
    return n


def build_material(mat_name, spec, cache, prefix):
    mat = bpy.data.materials.new(mat_name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    nodes, links = nt.nodes, nt.links
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    out.location = (400, 0)

    # ORM inputs are resolved first: metallic can drive the base colour (spec/gloss style packs)
    ao = cache.channel(spec["ao"]) if spec.get("ao") is not None else None
    rough = cache.channel(spec.get("roughness", 0.6))
    metal = cache.channel(spec.get("metallic", 0.0))
    mm = spec.get("metallic_mask_by_base")
    if mm and spec.get("base") and not isinstance(metal, float):
        b = cache.load(spec["base"])
        luma = b[..., 0] * 0.2126 + b[..., 1] * 0.7152 + b[..., 2] * 0.0722
        t = np.clip((luma - mm[0]) / (mm[1] - mm[0]), 0, 1)
        metal = metal * (1.0 - t * t * (3 - 2 * t))

    # base colour
    if spec.get("base"):
        rgba = cache.load(spec["base"]).copy()
        if spec.get("metal_tint_file") and not isinstance(metal, float):
            # metals take their colour from the specular/reflect map: lerp(diffuse, reflect, metallic)
            tint = cache.load(spec["metal_tint_file"])
            m = metal[..., None]
            rgba[..., :3] = rgba[..., :3] * (1 - m) + tint[..., :3] * m
        rgba[..., 3] = 1.0
        p = cache.save_png(cache.next_name(prefix + "_base"), rgba)
        n = load_node_image(nodes, p, True)
        n.location = (-700, 300)
        links.new(n.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        c = spec.get("base_color", [0.8, 0.8, 0.8])
        bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)

    # normal
    nrm = None
    if spec.get("normal"):
        nrm = cache.load(spec["normal"]).copy()
        if spec.get("normal_flip_y"):
            nrm[..., 1] = 1.0 - nrm[..., 1]
    elif spec.get("bump"):
        nrm = cache.bump_to_normal(spec["bump"], spec.get("bump_strength", 4.0))
    if nrm is not None:
        nrm[..., 3] = 1.0
        p = cache.save_png(cache.next_name(prefix + "_normal"), nrm)
        n = load_node_image(nodes, p, False)
        n.location = (-700, -100)
        nm = nodes.new("ShaderNodeNormalMap")
        nm.location = (-350, -100)
        links.new(n.outputs["Color"], nm.inputs["Color"])
        links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    # ORM: R = occlusion, G = roughness, B = metallic
    arrays = [x for x in (ao, rough, metal) if x is not None and not isinstance(x, float)]
    if arrays:
        h, w = arrays[0].shape
        orm = np.ones((h, w, 4), dtype=np.float32)
        orm[..., 0] = 1.0 if ao is None else ao
        orm[..., 1] = rough
        orm[..., 2] = metal
        p = cache.save_png(cache.next_name(prefix + "_orm"), orm)
        n = load_node_image(nodes, p, False)
        n.location = (-700, -500)
        sep = nodes.new("ShaderNodeSeparateColor")
        sep.location = (-350, -500)
        links.new(n.outputs["Color"], sep.inputs["Color"])
        links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        if ao is not None:
            grp = nodes.new("ShaderNodeGroup")
            grp.node_tree = get_gltf_output_group()
            grp.location = (400, -300)
            links.new(sep.outputs["Red"], grp.inputs["Occlusion"])
    else:
        bsdf.inputs["Roughness"].default_value = float(rough)
        bsdf.inputs["Metallic"].default_value = float(metal)
    return mat


# --------------------------------------------------------------------------- per-model convert


def fit_scale(objs, fit):
    mn, mx = bounds(objs)
    size = mx - mn
    if "scale" in fit:
        return float(fit["scale"])
    ax = fit["axis"]
    if ax == "max":
        cur = float(size.max())
    elif ax == "max_xy":
        cur = float(max(size[0], size[1]))
    else:
        cur = float(size[axis_index(ax)])
    return float(fit["metres"]) / cur


def stack_objects(objs, spec):
    """Rest each object on top of the previous one, centred, with optional z-rotation (degrees)."""
    rots = spec.get("rot_deg", [])
    offs = spec.get("offset", [])
    top = 0.0
    prev_c = None
    for i, o in enumerate(objs):
        if i < len(rots):
            transform_objs([o], Matrix.Rotation(math.radians(rots[i]), 4, "Z"))
        mn, mx = bounds([o])
        c = (mn + mx) / 2
        d = Vector((-c[0], -c[1], top - mn[2]))
        if i < len(offs):
            d += Vector((offs[i][0], offs[i][1], 0.0))
        transform_objs([o], Matrix.Translation(d))
        top = float(bounds([o])[1][2])


def convert_model(slug, cfg, args, defaults):
    reset_scene()
    src_root = args.src
    src = os.path.join(src_root, slug, cfg["source"])
    print("== %s <- %s" % (slug, src))
    import_source(src, cfg.get("import", {}))
    bake_transforms()

    base_objs = {o.name: o for o in bpy.data.objects}
    if "rotate_deg" in cfg:
        rx, ry, rz = cfg["rotate_deg"]
        m = (Matrix.Rotation(math.radians(rz), 4, "Z") @ Matrix.Rotation(math.radians(ry), 4, "Y")
             @ Matrix.Rotation(math.radians(rx), 4, "X"))
        transform_objs(list(base_objs.values()), m)

    size = cfg.get("texture_size", defaults["texture_size"])
    workdir = tempfile.mkdtemp(prefix="convert-models-")
    cache = TexCache(os.path.join(src_root, slug), size, workdir)

    # materials: keyed by source material name, "*" is the fallback
    mats = {}

    def material_for(src_name):
        specs = cfg["materials"]
        spec = specs.get(src_name, specs.get("*"))
        if spec is None:
            raise RuntimeError("no material spec for '%s' in %s" % (src_name, slug))
        key = json.dumps(spec, sort_keys=True)
        if key not in mats:
            mats[key] = build_material(slug + "_" + src_name, spec, cache, slug + "_" + src_name)
        return mats[key]

    for o in base_objs.values():
        for i, slot in enumerate(o.material_slots):
            o.material_slots[i].material = material_for(slot.material.name if slot.material else "*")
        if not o.material_slots:
            o.data.materials.append(material_for("*"))

    results = []
    outdir = os.path.join(args.out, slug)
    os.makedirs(outdir, exist_ok=True)
    img_fmt = cfg.get("image_format", defaults["image_format"])
    quality = cfg.get("jpeg_quality", defaults["jpeg_quality"])

    for out in cfg["outputs"]:
        names = out["objects"]
        objs = copy_objects([base_objs[n] for n in names], "_out")
        if out.get("stack"):
            stack_objects(objs, out["stack"])
        if "rotate_deg" in out:
            rx, ry, rz = out["rotate_deg"]
            transform_objs(objs, Matrix.Rotation(math.radians(rz), 4, "Z") @ Matrix.Rotation(math.radians(ry), 4, "Y") @ Matrix.Rotation(math.radians(rx), 4, "X"))
        fit = out.get("fit", cfg["fit"])
        s = fit_scale(objs, fit)
        transform_objs(objs, Matrix.Diagonal((s, s, s, 1.0)))
        mn, mx = bounds(objs)
        # pivot: bottom-centre of the bounding box
        transform_objs(objs, Matrix.Translation(Vector((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]))))

        tris_before = tri_count(objs)
        max_tris = out.get("max_tris", cfg.get("max_tris", defaults["max_tris"]))
        ratio = out.get("decimate_ratio", cfg.get("decimate_ratio"))
        if ratio is None:
            ratio = min(1.0, max_tris / tris_before * 0.97) if tris_before > max_tris else 1.0
        if ratio < 1.0:
            apply_decimate(objs, ratio)
        tris = tri_count(objs)

        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        # name nodes after the output so the scene graph is readable in three.js
        for o, n in zip(objs, names):
            o.name = (out["name"] if len(objs) == 1 else out["name"] + "-" + n)
            o.data.name = o.name

        path = os.path.join(outdir, out["name"] + ".glb")
        kw = dict(
            filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
            export_image_format=img_fmt, export_image_quality=quality,
            export_materials="EXPORT", export_normals=True, export_tangents=False,
            export_vertex_color="NONE", export_attributes=False,
            export_cameras=False, export_lights=False, export_animations=False,
            export_skins=False, export_morph=False,
        )
        if not args.no_draco:
            kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                      export_draco_position_quantization=14, export_draco_normal_quantization=10,
                      export_draco_texcoord_quantization=12)
        bpy.ops.export_scene.gltf(**kw)
        info = dict(slug=slug, name=out["name"], path=path, scale=s, tris_before=tris_before, tris=tris,
                    decimate_ratio=ratio, size_kb=round(os.path.getsize(path) / 1024, 1))
        print("   exported", info)
        results.append(info)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)

    shutil.rmtree(workdir, ignore_errors=True)
    return results


# --------------------------------------------------------------------------- verify + preview


def read_glb_json(path):
    with open(path, "rb") as f:
        _magic, _ver, _len = struct.unpack("<4sII", f.read(12))
        clen, ctype = struct.unpack("<II", f.read(8))
        return json.loads(f.read(clen))


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render_preview(png, light):
    scn = bpy.context.scene
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    mn, mx = bounds(objs)
    centre = (mn + mx) / 2
    radius = float(np.linalg.norm(mx - mn)) / 2
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    fov = 2 * math.atan(18 / 50)  # 36mm sensor
    dist = radius / math.sin(fov / 2) * 1.05
    # 3/4 view from the glTF front (+Z gltf == -Y blender), right and above
    d = Vector((0.7, -1.0, 0.55)).normalized()
    cam.location = Vector(centre) + d * dist
    look_at(cam, centre)
    scn.camera = cam

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.55, 0.55, 0.58, 1)
    bg.inputs["Strength"].default_value = 0.9 if light == "neutral" else 0.15
    scn.world = world

    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    scn.collection.objects.link(sun)
    sun.data.energy = 3.0 if light == "neutral" else 5.0
    if light == "neutral":
        sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    else:  # grazing light from the left, to judge normal map direction
        sun.rotation_euler = (math.radians(80), 0, math.radians(-70))

    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = 48
    scn.cycles.use_denoising = False
    scn.render.resolution_x = scn.render.resolution_y = 512
    scn.render.film_transparent = False
    scn.view_settings.view_transform = "Standard"
    scn.render.filepath = png
    scn.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def verify(args, manifest):
    only = [s for s in args.only.split(",") if s]
    rows = []
    for slug, cfg in manifest["models"].items():
        if only and slug not in only:
            continue
        for out in cfg["outputs"]:
            path = os.path.join(args.out, slug, out["name"] + ".glb")
            if not os.path.exists(path):
                rows.append(dict(name=out["name"], error="missing"))
                continue
            gj = read_glb_json(path)
            reset_scene()
            bpy.ops.import_scene.gltf(filepath=path)
            meshes = [o for o in bpy.data.objects if o.type == "MESH"]
            mn, mx = bounds(meshes)
            dims = mx - mn
            imgs = []
            for i, im in enumerate(gj.get("images", [])):
                bv = gj["bufferViews"][im["bufferView"]] if "bufferView" in im else {}
                imgs.append(dict(mime=im.get("mimeType"), bytes=bv.get("byteLength")))
            bl_imgs = [(i.name, tuple(i.size)) for i in bpy.data.images if i.size[0] > 0]
            for k, (nm, sz) in enumerate(bl_imgs):
                if k < len(imgs):
                    imgs[k]["px"] = "%dx%d" % sz
            row = dict(
                slug=slug, name=out["name"], size_kb=round(os.path.getsize(path) / 1024, 1),
                tris=tri_count(meshes), textures=imgs,
                bbox_m=dict(w=round(float(dims[0]), 3), h=round(float(dims[2]), 3), d=round(float(dims[1]), 3)),
                pivot_min=[round(float(mn[0]), 3), round(float(mn[1]), 3), round(float(mn[2]), 3)],
                pivot_centre_xy=[round(float((mn[0] + mx[0]) / 2), 3), round(float((mn[1] + mx[1]) / 2), 3)],
                extensions=gj.get("extensionsUsed", []),
                materials=len(gj.get("materials", [])),
                nodes=len(gj.get("nodes", [])),
            )
            if args.preview_dir:
                os.makedirs(args.preview_dir, exist_ok=True)
                png = os.path.join(args.preview_dir, out["name"] + ("" if args.light == "neutral" else "-" + args.light) + ".png")
                render_preview(png, args.light)
                row["preview"] = png
            print("VERIFY", json.dumps(row))
            rows.append(row)
    total = sum(r.get("size_kb", 0) for r in rows)
    print("TOTAL_KB", round(total, 1))
    if args.report:
        with open(args.report, "w") as f:
            json.dump(dict(total_kb=round(total, 1), rows=rows), f, indent=2)


# --------------------------------------------------------------------------- main


def main():
    args = parse_args()
    with open(args.manifest) as f:
        manifest = json.load(f)
    args.out = os.path.abspath(args.out)
    if args.verify:
        verify(args, manifest)
        return
    only = [s for s in args.only.split(",") if s]
    all_results = []
    for slug, cfg in manifest["models"].items():
        if only and slug not in only:
            continue
        all_results += convert_model(slug, cfg, args, manifest["defaults"])
    total = sum(r["size_kb"] for r in all_results)
    print("CONVERTED %d files, %.1f KB total" % (len(all_results), total))
    if args.report:
        with open(args.report, "w") as f:
            json.dump(all_results, f, indent=2)


main()
