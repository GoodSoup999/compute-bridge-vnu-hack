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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=location)
    obj = bpy.context.object
    obj.scale = (radius,) * 3
    obj.data.materials.append(surface)
    bpy.ops.object.shade_smooth()
    return obj


def main():
    args = arguments()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    enable_nvidia_gpu(scene)
    scene.cycles.samples = args.samples
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = args.output
    scene.render.film_transparent = False

    floor = material("Pardoseala", (0.14, 0.18, 0.24), roughness=0.55)
    red = material("Coral", (0.9, 0.12, 0.08), roughness=0.25)
    blue = material("Albastru", (0.05, 0.35, 0.9), roughness=0.2)
    chrome = material("Crom", (0.82, 0.88, 0.96), metallic=1.0, roughness=0.08)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -1))
    bpy.context.object.data.materials.append(floor)
    sphere((-1.4, 0, 0), 1, red)
    sphere((1.4, 0, 0), 1, chrome)
    sphere((0, 1.25, 0.2), 0.75, blue)

    light_data = bpy.data.lights.new("Lumina mare", type="AREA")
    light_data.energy = 800
    light_data.shape = "DISK"
    light_data.size = 5
    light_obj = bpy.data.objects.new("Lumina mare", light_data)
    scene.collection.objects.link(light_obj)
    light_obj.location = (0, -3, 6)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    scene.collection.objects.link(camera)
    angle = 2 * math.pi * args.frame / args.frames
    camera.location = (6 * math.sin(angle), -8 * math.cos(angle), 3.3)
    direction = Vector((0, 0, 0)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 42
    scene.camera = camera

    world = bpy.data.worlds.new("Cer")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.12, 0.15, 0.22, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    scene.world = world

    bpy.ops.render.render(write_still=True)
    print("COMPUTE_BRIDGE_RENDERED=" + args.output, flush=True)


if __name__ == "__main__":
    main()
