"""Render a supplied packed scene; embedded Python never runs automatically."""
import argparse
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_gpu import enable_nvidia_gpu

parser = argparse.ArgumentParser()
parser.add_argument('--frame', type=int, required=True)
parser.add_argument('--frames', type=int, required=True)
parser.add_argument('--source-frame', type=int, required=True)
parser.add_argument('--width', type=int, required=True)
parser.add_argument('--height', type=int, required=True)
parser.add_argument('--samples', type=int, required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if bpy.app.autoexec_fail:
    raise RuntimeError('Proiectul cere scripturi Python automate; acestea nu sunt permise.')
asset_root = os.path.normcase(os.path.realpath(bpy.utils.system_resource('DATAFILES', path='assets')))
external_paths = [value for value in bpy.utils.blend_paths(absolute=True, packed=False)
                  if not os.path.normcase(os.path.realpath(value)).startswith(asset_root + os.sep)]
if external_paths:
    raise RuntimeError('Proiectul are resurse externe. Folosește File > External Data > Pack Resources și elimină bibliotecile/cache-urile externe.')
scene = bpy.context.scene
if not scene.camera:
    raise RuntimeError('Proiectul nu are o cameră activă.')
scene.render.engine = 'CYCLES'
enable_nvidia_gpu(scene)
scene.cycles.samples = args.samples
scene.render.resolution_x = args.width
scene.render.resolution_y = args.height
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = args.output
scene.render.use_compositing = False  # A compositor can write files outside the output folder.
scene.render.use_sequencer = False
scene.frame_set(args.source_frame)
print('COMPUTE_BRIDGE_SOURCE_FRAME=' + str(args.source_frame), flush=True)
bpy.ops.render.render(write_still=True)
