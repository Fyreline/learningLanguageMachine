"""Generate procedural CS2-palette test frames.

The sandboxed build environment cannot download real screenshots, so these
frames reproduce the *statistics* that matter to a grade: each map's
characteristic palette, dynamic range, and lighting (harsh sun + blue sky on
Dust2, overcast steel on Nuke, near-black night with clipped floodlights on
Vertigo-at-night, etc.), including CS2's typical clipped highlights and
saturated video-game primaries.

Run reference/grade_cli.py on your own screenshots for the real thing.
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

H, W = 720, 1280
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                   "tests", "frames")


def _rng(seed):
    return np.random.default_rng(seed)


def canvas():
    return np.zeros((H, W, 3), np.float32)


def vgrad(img, y0, y1, top, bottom):
    y0, y1 = int(y0 * H), int(y1 * H)
    t = np.linspace(0, 1, max(y1 - y0, 1), dtype=np.float32)[:, None, None]
    img[y0:y1] = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    return img


def box(img, x0, y0, x1, y1, color, shade=0.15, seed=1, tex=0.05):
    x0, x1 = int(x0 * W), int(x1 * W)
    y0, y1 = int(y0 * H), int(y1 * H)
    h, w = y1 - y0, x1 - x0
    if h <= 0 or w <= 0:
        return img
    c = np.array(color, np.float32)
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    block = c * (1.0 + shade * (0.5 - t))
    noise = _rng(seed).standard_normal((h, w, 1)).astype(np.float32)
    # coarse texture: smooth the noise a bit
    k = np.ones((3,), np.float32) / 3
    for ax in (0, 1):
        noise = np.apply_along_axis(lambda m: np.convolve(m, k, "same"), ax,
                                    noise[..., 0])[..., None]
    block = block * (1.0 + noise * tex)
    img[y0:y1, x0:x1] = block
    return img


def sun_patch(img, cx, cy, radius, color, intensity=1.0):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d2 = ((xx - cx * W) ** 2 + (yy - cy * H) ** 2) / (radius * H) ** 2
    glow = np.exp(-d2) * intensity
    img += glow[..., None] * np.array(color, np.float32)
    return img


def ao_strip(img, y, strength=0.4, height=0.04):
    y0 = int((y - height) * H)
    y1 = int(y * H)
    t = np.linspace(1, 0, max(y1 - y0, 1), dtype=np.float32)[:, None, None]
    img[y0:y1] *= (1.0 - strength * (1 - t))
    return img


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    arr = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(OUT, name + ".png"))
    print("wrote", name)


def dust2(ev=0.0):
    img = canvas()
    vgrad(img, 0.0, 0.45, (0.45, 0.62, 0.88), (0.66, 0.76, 0.90))   # zenith->horizon
    vgrad(img, 0.45, 1.0, (0.72, 0.62, 0.44), (0.55, 0.47, 0.33))   # sand ground
    box(img, 0.00, 0.18, 0.22, 0.62, (0.78, 0.66, 0.45), 0.2, 2)    # sunlit wall
    box(img, 0.22, 0.26, 0.34, 0.62, (0.47, 0.38, 0.26), 0.1, 3)    # shaded wall
    box(img, 0.62, 0.12, 0.95, 0.60, (0.83, 0.71, 0.50), 0.25, 4)   # far sunlit block
    box(img, 0.70, 0.30, 0.80, 0.60, (0.30, 0.42, 0.55), 0.1, 5)    # blue door
    box(img, 0.40, 0.40, 0.48, 0.60, (0.16, 0.12, 0.09), 0.05, 6)   # dark doorway
    box(img, 0.50, 0.52, 0.60, 0.62, (0.55, 0.30, 0.16), 0.2, 7)    # crates
    sun_patch(img, 0.85, 0.08, 0.16, (1.4, 1.32, 1.1), 1.0)         # blown sun
    ao_strip(img, 0.63, 0.45)
    return img * (2.0 ** ev)


def mirage():
    img = canvas()
    vgrad(img, 0.0, 0.40, (0.52, 0.68, 0.90), (0.72, 0.80, 0.90))
    vgrad(img, 0.40, 1.0, (0.71, 0.60, 0.42), (0.52, 0.44, 0.31))
    box(img, 0.04, 0.10, 0.40, 0.66, (0.80, 0.67, 0.46), 0.22, 11)
    box(img, 0.12, 0.28, 0.22, 0.55, (0.24, 0.55, 0.55), 0.1, 12)   # teal shutters
    box(img, 0.46, 0.20, 0.72, 0.66, (0.74, 0.60, 0.40), 0.18, 13)
    box(img, 0.55, 0.34, 0.63, 0.60, (0.58, 0.20, 0.14), 0.1, 14)   # red rug/awning
    box(img, 0.78, 0.32, 0.99, 0.66, (0.42, 0.35, 0.25), 0.12, 15)  # shaded arch
    box(img, 0.84, 0.42, 0.92, 0.66, (0.12, 0.10, 0.08), 0.05, 16)  # dark interior
    sun_patch(img, 0.30, 0.05, 0.20, (1.2, 1.15, 0.95), 0.9)
    ao_strip(img, 0.67, 0.4)
    return img


def nuke():
    img = canvas()
    vgrad(img, 0.0, 0.42, (0.78, 0.82, 0.86), (0.88, 0.90, 0.92))   # overcast, near-clip
    vgrad(img, 0.42, 1.0, (0.38, 0.40, 0.42), (0.24, 0.26, 0.28))   # asphalt
    box(img, 0.02, 0.16, 0.42, 0.64, (0.55, 0.58, 0.60), 0.18, 21)  # steel shed
    box(img, 0.08, 0.24, 0.36, 0.40, (0.72, 0.30, 0.16), 0.15, 22)  # red container/crane
    box(img, 0.52, 0.10, 0.66, 0.64, (0.44, 0.47, 0.50), 0.12, 23)  # silo
    box(img, 0.72, 0.28, 0.98, 0.64, (0.50, 0.52, 0.50), 0.15, 24)
    box(img, 0.78, 0.40, 0.88, 0.64, (0.85, 0.75, 0.30), 0.1, 25)   # hazard yellow
    box(img, 0.44, 0.44, 0.52, 0.64, (0.10, 0.11, 0.12), 0.05, 26)  # dark doorway
    ao_strip(img, 0.65, 0.5)
    return img


def inferno():
    img = canvas()
    vgrad(img, 0.0, 0.38, (0.60, 0.72, 0.88), (0.80, 0.82, 0.84))
    vgrad(img, 0.38, 1.0, (0.48, 0.42, 0.34), (0.34, 0.30, 0.24))   # cobblestone
    box(img, 0.02, 0.12, 0.34, 0.66, (0.66, 0.46, 0.32), 0.2, 31)   # brick
    box(img, 0.10, 0.20, 0.20, 0.40, (0.30, 0.42, 0.20), 0.15, 32)  # ivy
    box(img, 0.44, 0.18, 0.70, 0.66, (0.78, 0.70, 0.56), 0.22, 33)  # plaster in sun
    box(img, 0.50, 0.30, 0.58, 0.55, (0.36, 0.26, 0.18), 0.1, 34)   # wood balcony
    box(img, 0.78, 0.26, 0.99, 0.66, (0.42, 0.48, 0.28), 0.15, 35)  # foliage
    box(img, 0.36, 0.46, 0.44, 0.66, (0.13, 0.10, 0.07), 0.05, 36)
    sun_patch(img, 0.60, 0.06, 0.18, (1.3, 1.2, 0.95), 1.0)         # golden sun
    ao_strip(img, 0.67, 0.45)
    return img


def ancient():
    img = canvas()
    vgrad(img, 0.0, 0.30, (0.40, 0.52, 0.55), (0.55, 0.62, 0.58))   # canopy light
    vgrad(img, 0.30, 1.0, (0.20, 0.24, 0.18), (0.10, 0.12, 0.09))   # jungle floor
    box(img, 0.04, 0.14, 0.30, 0.70, (0.32, 0.36, 0.30), 0.2, 41)   # mossy stone
    box(img, 0.10, 0.22, 0.24, 0.44, (0.16, 0.26, 0.14), 0.15, 42)  # vines
    box(img, 0.42, 0.10, 0.64, 0.70, (0.38, 0.40, 0.34), 0.22, 43)  # temple wall
    box(img, 0.48, 0.28, 0.58, 0.52, (0.55, 0.42, 0.20), 0.1, 44)   # gold mural
    box(img, 0.74, 0.24, 0.98, 0.70, (0.22, 0.28, 0.20), 0.15, 45)
    box(img, 0.32, 0.48, 0.42, 0.70, (0.05, 0.06, 0.05), 0.05, 46)  # cave dark
    sun_patch(img, 0.55, 0.02, 0.10, (0.9, 1.0, 0.8), 0.8)          # canopy shaft
    ao_strip(img, 0.71, 0.5)
    return img


def vertigo_night():
    img = canvas()
    vgrad(img, 0.0, 0.5, (0.02, 0.03, 0.07), (0.05, 0.06, 0.11))    # night sky
    vgrad(img, 0.5, 1.0, (0.08, 0.08, 0.10), (0.04, 0.04, 0.05))    # concrete
    box(img, 0.05, 0.20, 0.35, 0.68, (0.10, 0.10, 0.13), 0.15, 51)  # dark structure
    box(img, 0.42, 0.14, 0.60, 0.68, (0.12, 0.12, 0.14), 0.15, 52)
    box(img, 0.66, 0.30, 0.96, 0.68, (0.09, 0.09, 0.12), 0.12, 53)
    box(img, 0.46, 0.34, 0.50, 0.44, (1.0, 0.85, 0.55), 0.0, 54)    # sodium window
    box(img, 0.14, 0.30, 0.17, 0.38, (0.55, 0.85, 1.0), 0.0, 55)    # cool window
    sun_patch(img, 0.52, 0.18, 0.05, (1.6, 1.5, 1.2), 1.2)          # floodlight
    sun_patch(img, 0.80, 0.36, 0.03, (1.2, 0.7, 0.3), 1.0)          # sodium lamp
    sun_patch(img, 0.15, 0.33, 0.03, (0.5, 0.9, 1.3), 0.9)          # cold lamp
    ao_strip(img, 0.69, 0.3)
    return img


FRAMES = {
    "dust2": lambda: dust2(0.0),
    "dust2_under": lambda: dust2(-1.5),   # auto-exposure stress: dark shot
    "dust2_over": lambda: dust2(+1.0),    # auto-exposure stress: hot shot
    "mirage": mirage,
    "nuke": nuke,
    "inferno": inferno,
    "ancient": ancient,
    "vertigo_night": vertigo_night,
}


if __name__ == "__main__":
    for name, fn in FRAMES.items():
        save(fn(), name)
