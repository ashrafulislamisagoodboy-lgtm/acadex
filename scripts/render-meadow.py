"""Bake a seamless wind loop from public/meadow.jpg (offline: numpy, Pillow, imageio-ffmpeg)."""
from pathlib import Path
import subprocess

import imageio_ffmpeg
import numpy as np
from PIL import Image

public = Path(__file__).resolve().parents[1] / 'public'
w, h, fps, seconds = 1032, 288, 24, 5
photo = np.asarray(Image.open(public / 'meadow.jpg').resize((w, 2*h), Image.Resampling.LANCZOS))[h:]
y, x = np.mgrid[:h, :w].astype('float32')
depth = (y / h)**0.85
# Slowly travelling pressure fronts, broken up at tuft scale. Perspective
# makes a gust broader and the blades' deflection larger close to the camera.
front = x / w * 12 + np.sin(y / 47) + y / 76
patch = np.sin(x / 29 + y / 11) + .6 * np.sin(x / 13 - y / 27)
encoder = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-',
    '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '33', '-b:v', '0',
    '-row-mt', '1', '-threads', '4', '-deadline', 'good', '-cpu-used', '5', str(public / 'meadow-wind.webm')], stdin=subprocess.PIPE)
for frame in range(fps * seconds):
    t = 2 * np.pi * frame / (fps * seconds)
    gust = np.sin(front - t * 2 + .34 * patch)
    sway = depth * (gust * (5.2 + 1.6 * patch) + 2.4 * np.sin(front * .65 + patch - t * 3))
    sx = np.clip(x - sway, 0, w - 1.001)
    sy = np.clip(y + depth * (.8 * gust + .65 * np.sin(patch - t * 2)), 0, h - 1.001)
    ix, iy = sx.astype('int32'), sy.astype('int32')
    fx, fy = (sx - ix)[..., None], (sy - iy)[..., None]
    rgb = ((1-fy) * ((1-fx)*photo[iy,ix] + fx*photo[iy,ix+1]) +
           fy * ((1-fx)*photo[iy+1,ix] + fx*photo[iy+1,ix+1]))
    # Catch sunlight on leaning blades rather than moving the hills or camera.
    light = (depth**.55 * (.10 * gust + .025 * np.sin(front + patch - t)))[..., None]
    encoder.stdin.write(np.clip(rgb * (1 + light), 0, 255).astype('uint8').tobytes())
encoder.stdin.close()
if encoder.wait():
    raise SystemExit('Could not encode meadow-wind.webm')
