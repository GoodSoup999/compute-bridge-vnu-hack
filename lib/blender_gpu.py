"""Render one deterministic animation frame with Cycles on an NVIDIA GPU."""
import argparse
import math
import sys

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame", type=int, required=True)
    parser.add_argument("--frames", type=int, required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--samples", type=int, required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def enable_nvidia_gpu(scene):
    preferences = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            preferences.compute_device_type = backend
            preferences.get_devices()
            devices = [device for device in preferences.devices if device.type == backend]
            if devices:
                for device in preferences.devices:
                    device.use = device.type == backend
                scene.cycles.device = "GPU"
                print("COMPUTE_BRIDGE_GPU=" + backend + ":" + ",".join(device.name for device in devices), flush=True)
                return
        except Exception as error:
            print("GPU backend unavailable:", backend, error, flush=True)
    raise RuntimeError("Blender Cycles nu a detectat un GPU NVIDIA OptiX/CUDA")


def material(name, color, metallic=0.0, roughness=0.35):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value


def sphere(location, radius, surface):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, location=location)
    obj = bpy.context.object
    obj.scale = (radius,) * 3
    obj.data.materials.append(surface)
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(location, radius, depth, surface):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.data.materials.append(surface)
    bevel = obj.modifiers.new("Margini rotunjite", "BEVEL")
    bevel.width = min(radius * 0.15, 0.13)
    bevel.segments = 3
    obj.modifiers.new("Normale", "WEIGHTED_NORMAL")
    return obj


def ring(location, major_radius, minor_radius, surface, tilt=0):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=96, minor_segments=12,
        location=location, major_radius=major_radius, minor_radius=minor_radius
    )
    obj = bpy.context.object
    obj.rotation_euler = (0.36 + tilt, 0.28, tilt)
    obj.data.materials.append(surface)
    bpy.ops.object.shade_smooth()
    return obj


def area_light(name, location, color, energy, size):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location


def glowing_material(name, color, strength):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    nodes = value.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*color, 1)
    emission.inputs["Strength"].default_value = strength
    output = nodes.new("ShaderNodeOutputMaterial")
    value.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return value


def main():
    args = arguments()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    enable_nvidia_gpu(scene)
    scene.cycles.samples = args.samples
    scene.cycles.max_bounces = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = args.output
    scene.render.film_transparent = False

    phase = 2 * math.pi * args.frame / args.frames
    floor = material("Pardoseala", (0.035, 0.045, 0.08), metallic=0.25, roughness=0.3)
    coral = material("Coral", (0.8, 0.07, 0.08), metallic=0.2, roughness=0.22)
    blue = material("Albastru", (0.02, 0.25, 0.9), metallic=0.35, roughness=0.17)
    gold = material("Aur", (0.9, 0.5, 0.06), metallic=0.9, roughness=0.2)
    chrome = material("Crom", (0.82, 0.88, 0.96), metallic=1.0, roughness=0.08)
    glass = material("Sticla", (0.85, 0.96, 1.0), roughness=0.04)
    glass.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.85
    glass.node_tree.nodes["Principled BSDF"].inputs["IOR"].default_value = 1.45
    cyan_light = glowing_material("Neon cyan", (0.01, 0.7, 1.0), 5)
    orange_light = glowing_material("Neon portocaliu", (1.0, 0.22, 0.03), 4)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -1.2))
    bpy.context.object.data.materials.append(floor)
    cylinder((0, 0, -0.75), 2.35, 0.9, chrome)
    cylinder((0, 0, -0.25), 2.15, 0.12, blue)
    sphere((0, 0, 1.0 + 0.25 * math.sin(phase * 2)), 1.0, glass)
    sphere((0, 0, 1.0 + 0.25 * math.sin(phase * 2)), 0.43, coral)
    ring((0, 0, 1.0), 1.6, 0.055, gold, phase)
    ring((0, 0, 1.0), 1.9, 0.035, cyan_light, -phase * 0.6)
    ring((0, 0, -1.12), 2.7, 0.04, orange_light)

    for index in range(20):
        angle = 2 * math.pi * index / 20
        radius = 4.7 + 0.25 * math.sin(index * 2)
        height = 0.9 + (index % 5) * 0.35
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        cylinder((x, y, -1.2 + height / 2), 0.31, height, chrome if index % 2 else blue)
        sphere((x, y, -1.2 + height + 0.13), 0.15, cyan_light if index % 2 else orange_light)

    for index in range(18):
        angle = 2 * math.pi * index / 18 + phase * (1 if index % 2 else -1)
        radius = 3.2 + 0.25 * math.sin(index * 3)
        height = 0.2 + 0.65 * math.sin(phase * 2 + index)
        sphere((radius * math.cos(angle), radius * math.sin(angle), height),
               0.18 + 0.05 * (index % 3), [coral, gold, blue][index % 3])

    area_light("Lumina principala", (2, -4, 8), (0.65, 0.8, 1), 1100, 5)
    area_light("Lumina rosie", (-5, 3, 4), (1, 0.15, 0.08), 700, 4)
    area_light("Lumina albastra", (5, 4, 5), (0.1, 0.35, 1), 750, 4)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (10 * math.sin(phase), -10 * math.cos(phase), 4.7 + 0.5 * math.sin(phase * 2))
    direction = Vector((0, 0, 0.4)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 38
    camera_data.dof.use_dof = True
    camera_data.dof.focus_distance = direction.length
    camera_data.dof.aperture_fstop = 5.6
    scene.camera = camera

    world = bpy.data.worlds.new("Cer")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.06, 0.09, 0.17, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.world = world

    bpy.ops.render.render(write_still=True)
    print("COMPUTE_BRIDGE_RENDERED=" + args.output, flush=True)


if __name__ == "__main__":
    main()
