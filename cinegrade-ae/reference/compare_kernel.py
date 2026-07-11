"""Cross-check the C++ kernel against the Python reference.

Builds tests/kernel_test.cpp with g++, grades every test frame with every
preset in both implementations (stochastic stages disabled for exactness;
the C++ spatial FX run at half resolution so a small tolerance applies),
and compares:

  - auto-exposure stops (must agree within 0.05 stop)
  - graded image (mean abs diff < 0.01, p99 abs diff < 0.06)

Also sanity-checks C++ grain statistics against the requested amount.
Exits non-zero on failure.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

import cinegrade as cg
from make_test_frames import FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FRAME_DIR = os.path.join(ROOT, "tests", "frames")

failures = []


def check(name, cond, detail=""):
    print(f"[{'ok ' if cond else 'FAIL'}] {name} {detail}")
    if not cond:
        failures.append(name)


def main():
    build_dir = tempfile.mkdtemp(prefix="cinegrade_")
    exe = os.path.join(build_dir, "kernel_test")
    subprocess.run(
        ["g++", "-O2", "-std=c++17",
         os.path.join(ROOT, "tests", "kernel_test.cpp"), "-o", exe],
        check=True)
    print("built kernel_test")

    presets, order, _ = cg.load_presets()

    for fname in ("mirage", "vertigo_night", "dust2_under"):
        img = np.asarray(Image.open(os.path.join(FRAME_DIR, fname + ".png"))
                         .convert("RGB"), np.float32) / 255.0
        h, w = img.shape[:2]
        rgba = np.concatenate([img, np.ones((h, w, 1), np.float32)], -1)
        in_raw = os.path.join(build_dir, "in.raw")
        rgba.tofile(in_raw)

        for idx, pid in enumerate(order):
            out_raw = os.path.join(build_dir, "out.raw")
            r = subprocess.run(
                [exe, in_raw, str(w), str(h), str(idx), "1", "0", out_raw],
                capture_output=True, text=True, check=True)
            cpp_stops = float(r.stdout.strip().split("=")[1])

            lin = cg.srgb_to_linear(img)
            py_gain = cg.auto_exposure_gain(lin)
            py_stops = float(np.log2(py_gain))
            stops_ok = abs(cpp_stops - py_stops) < 0.05

            params = dict(presets[pid])
            params.update(grain_amount=0.0, gate_weave=0.0, flicker=0.0)
            py = cg.grade(img, params, frame=7, auto_exposure=True,
                          ae_precomputed_gain=2.0 ** cpp_stops)
            cpp = np.fromfile(out_raw, np.float32).reshape(h, w, 4)[..., :3]
            cpp = np.clip(cpp, 0, 1)
            diff = np.abs(py - cpp)
            mean_d = float(diff.mean())
            p99_d = float(np.percentile(diff, 99))
            check(f"{fname}/{pid}",
                  stops_ok and mean_d < 0.01 and p99_d < 0.06,
                  f"stops {cpp_stops:+.3f}/{py_stops:+.3f} "
                  f"mean {mean_d:.4f} p99 {p99_d:.4f}")

    # grain statistics: graded twice with/without noise, residual std should
    # scale with the preset's grain amount
    img = np.asarray(Image.open(os.path.join(FRAME_DIR, "mirage.png"))
                     .convert("RGB"), np.float32) / 255.0
    h, w = img.shape[:2]
    rgba = np.concatenate([img, np.ones((h, w, 1), np.float32)], -1)
    in_raw = os.path.join(build_dir, "in.raw")
    rgba.tofile(in_raw)
    idx80 = order.index("eighties_analog")
    outs = {}
    for tag, noise in (("clean", "0"), ("noisy", "1")):
        out_raw = os.path.join(build_dir, f"{tag}.raw")
        subprocess.run([exe, in_raw, str(w), str(h), str(idx80), "0", noise,
                        out_raw], capture_output=True, check=True)
        outs[tag] = np.fromfile(out_raw, np.float32).reshape(h, w, 4)[..., :3]
    resid = float((outs["noisy"] - outs["clean"]).std())
    check("grain-statistics", 0.005 < resid < 0.08, f"residual std {resid:.4f}")

    print()
    if failures:
        print("FAILED:", ", ".join(failures))
        sys.exit(1)
    print("kernel matches reference")


if __name__ == "__main__":
    main()
