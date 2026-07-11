"""CineGrade reference test suite.

1. Neutral identity   — the 'none' preset must be a near-no-op.
2. Auto exposure      — the same scene shot at -1.5 EV / 0 / +1 EV must grade
                        to near-identical mean luminance (shot matching).
3. Range safety       — every preset on every frame stays in [0,1], no NaNs.
4. Contact sheets     — original + every preset, one sheet per map, written
                        to tests/output/ for eyeballing.

Exits non-zero on failure.
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

import cinegrade as cg
from make_test_frames import FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
FRAME_DIR = os.path.join(HERE, "..", "tests", "frames")
OUT_DIR = os.path.join(HERE, "..", "tests", "output")

failures = []


def check(name, cond, detail=""):
    status = "ok " if cond else "FAIL"
    print(f"[{status}] {name} {detail}")
    if not cond:
        failures.append(name)


def load(name):
    return np.asarray(Image.open(os.path.join(FRAME_DIR, name + ".png"))
                      .convert("RGB"), np.float32) / 255.0


def main():
    presets, order, _ = cg.load_presets()
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. neutral identity ---------------------------------------------------
    img = load("mirage")
    out = cg.grade(img, presets["none"], frame=0)
    err = float(np.abs(out - img).max())
    check("neutral-identity", err < 5e-3, f"max err {err:.4f}")

    # 2. auto-exposure shot matching ---------------------------------------
    p = presets["eterna_soft"]
    means = {}
    for name in ("dust2_under", "dust2", "dust2_over"):
        g = cg.grade(load(name), p, frame=0, auto_exposure=True, ae_adapt=1.0,
                     ae_highlight_protect=0.0)
        means[name] = float(cg.luminance(g).mean())
    spread = max(means.values()) - min(means.values())
    check("auto-exposure-consistency", spread < 0.035,
          f"means {[f'{k}={v:.3f}' for k, v in means.items()]} spread {spread:.3f}")

    # night mood: with default highlight protection a night scene must be
    # lifted a little, but never washed toward mid grey
    night = load("vertigo_night")
    raw_mean = float(cg.luminance(cg.grade(night, presets["none"], frame=0)).mean())
    g = cg.grade(night, p, frame=0, auto_exposure=True)
    night_mean = float(cg.luminance(g).mean())
    check("auto-exposure-night-mood", raw_mean < night_mean < 0.30,
          f"raw {raw_mean:.3f} graded {night_mean:.3f}")

    # without AE the same trio must differ a lot (sanity that the test bites)
    means_raw = {}
    for name in ("dust2_under", "dust2", "dust2_over"):
        g = cg.grade(load(name), p, frame=0, auto_exposure=False)
        means_raw[name] = float(cg.luminance(g).mean())
    spread_raw = max(means_raw.values()) - min(means_raw.values())
    check("auto-exposure-test-bites", spread_raw > 3 * spread,
          f"raw spread {spread_raw:.3f}")

    # 3 + 4. all presets x all frames, range safety + contact sheets --------
    for fname in FRAMES:
        src = load(fname)
        tiles = [("original", src)]
        for pid in order:
            if pid == "none":
                continue
            g = cg.grade(src, presets[pid], frame=7, auto_exposure=True)
            ok = np.isfinite(g).all() and g.min() >= 0.0 and g.max() <= 1.0
            if not ok:
                check(f"range-{fname}-{pid}", False)
            tiles.append((pid, g))

        cols = 4
        rows = (len(tiles) + cols - 1) // cols
        th, tw = 180, 320
        sheet = np.zeros((rows * (th + 22), cols * tw, 3), np.float32)
        from PIL import ImageDraw
        canvas = Image.new("RGB", (cols * tw, rows * (th + 22)), (12, 12, 12))
        draw = ImageDraw.Draw(canvas)
        for i, (label, tile) in enumerate(tiles):
            r, c = divmod(i, cols)
            im = Image.fromarray((np.clip(tile, 0, 1) * 255).astype(np.uint8))
            im = im.resize((tw, th), Image.LANCZOS)
            canvas.paste(im, (c * tw, r * (th + 22)))
            draw.text((c * tw + 6, r * (th + 22) + th + 4), label,
                      fill=(220, 220, 220))
        path = os.path.join(OUT_DIR, f"sheet_{fname}.png")
        canvas.save(path)
        print("      sheet ->", os.path.relpath(path, HERE))
    check("range-safety-all", all(not f.startswith("range-") for f in failures))

    print()
    if failures:
        print("FAILED:", ", ".join(failures))
        sys.exit(1)
    print("all tests passed")


if __name__ == "__main__":
    main()
