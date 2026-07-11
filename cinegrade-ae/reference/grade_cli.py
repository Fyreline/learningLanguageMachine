"""Grade any image with a CineGrade preset — same math as the AE plugin.

Usage:
  python3 grade_cli.py INPUT [-p PRESET] [-s STRENGTH] [--auto-exposure]
                       [--target-ev EV] [--frame N] [-o OUTPUT]
  python3 grade_cli.py INPUT --all          # one output per preset
  python3 grade_cli.py --list               # list presets

Drop your own CS2 screenshots in and compare looks before committing to a
grade in After Effects.
"""

from __future__ import annotations

import argparse
import os

import numpy as np
from PIL import Image

import cinegrade as cg


def run(path, preset_id, strength, auto_exp, target_ev, frame, out_path):
    presets, order, _ = cg.load_presets()
    if preset_id not in presets:
        raise SystemExit(f"unknown preset {preset_id!r}; use --list")
    img = np.asarray(Image.open(path).convert("RGB"), np.float32) / 255.0
    params = cg.blend_with_neutral(presets[preset_id], strength)
    graded = cg.grade(img, params, frame=frame, auto_exposure=auto_exp,
                      ae_target_ev=target_ev)
    out = Image.fromarray((graded * 255).astype(np.uint8))
    out.save(out_path)
    print("wrote", out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?")
    ap.add_argument("-p", "--preset", default="eterna_soft")
    ap.add_argument("-s", "--strength", type=float, default=100.0)
    ap.add_argument("--auto-exposure", action="store_true")
    ap.add_argument("--target-ev", type=float, default=0.0)
    ap.add_argument("--frame", type=int, default=0)
    ap.add_argument("-o", "--output")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    presets, order, data = cg.load_presets()
    if args.list:
        for pid in order:
            print(pid)
        return
    if not args.input:
        raise SystemExit("input image required (or --list)")

    base, _ = os.path.splitext(args.input)
    if args.all:
        for pid in order:
            if pid == "none":
                continue
            run(args.input, pid, args.strength / 100.0, args.auto_exposure,
                args.target_ev, args.frame, f"{base}__{pid}.png")
    else:
        out = args.output or f"{base}__{args.preset}.png"
        run(args.input, args.preset, args.strength / 100.0,
            args.auto_exposure, args.target_ev, args.frame, out)


if __name__ == "__main__":
    main()
