# CineGrade

**Filmic colour correction & grading plugin for Adobe After Effects, built
for CS:GO / CS2 footage.**

One effect that takes raw, clippy, video-game footage and makes it read as
film: auto exposure that matches shots across wildly different maps, a
tunable filmic tone curve, film presets ('80s analog street photography, Wes
Anderson pastels, Dune-style Technicolor 65mm, and more), plus the full
post stack — halation, glow, diffusion, gate weave, flicker, chromatic
aberration, vignette and proper luminance-weighted film grain.

- **8 / 16 / 32-bpc (float)** via SmartFX — drop it on any comp.
- **Every parameter is keyframable** (they're all standard AE params).
- **Simple mode**: pick a preset, set Strength, enable Auto Exposure, trim
  Warmth / Grain / Halation / Glow / Softness / Vignette. Done.
- **Advanced mode**: ~60 parameters covering the entire pipeline, applied as
  trims on top of the preset so you can start from a look and bend it.
- **Auto exposure shot matching**: log-average luminance is pulled toward a
  target EV with clamping, temporal smoothing across neighbouring frames,
  and highlight protection so night maps stay night instead of being washed
  to mid grey. Verified: the same scene rendered at −1.5 EV / 0 / +1 EV
  grades to within 0.4 % mean luminance.

## Layout

| Path | What |
|---|---|
| `plugin/` | After Effects plugin source (C++17, AE SDK, CMake) |
| `plugin/src/CineGradeKernel.h` | The entire pixel pipeline — AE-independent, testable |
| `presets/presets.json` | **Single source of truth** for the looks |
| `reference/` | Python reference implementation + test suite + CLI |
| `tests/` | Procedural CS2-palette test frames, C++/Python cross-check, rendered contact sheets |
| `docs/` | Design, parameters, presets, build instructions |

## Try the looks before building anything

The Python reference is the same math as the plugin (the C++ kernel is
regression-tested against it). Grade your own CS2 screenshots right now:

```bash
pip install numpy pillow
cd reference
python3 grade_cli.py mydust2clip_frame.png --all          # every preset
python3 grade_cli.py shot.png -p eighties_analog -s 85 --auto-exposure
python3 grade_cli.py --list                               # preset ids
```

## Building the plugin

See [docs/BUILDING.md](docs/BUILDING.md). Short version: install the Adobe
After Effects SDK, then

```bash
cmake -B build -DAE_SDK_ROOT=/path/to/AfterEffectsSDK plugin/
cmake --build build --config Release
```

Works with After Effects 2021 (18.0) and newer on Windows (`.aex`) and
macOS (`.plugin`, Intel + Apple Silicon).

## The presets

See [docs/PRESETS.md](docs/PRESETS.md) for full notes and contact sheets
rendered on CS2-palette test frames.

| Preset | Look |
|---|---|
| `'80s Analog` | Muted late-70s/80s street film: lifted soft blacks, rolled-off highlights, heavy fine grain, halation, diffusion. Calibrated against a real film frame. |
| `Wes Pastel` | Wes Anderson: flat-ish contrast, storybook pastels, rich golden yellows, crisp detail, tidy vignette. |
| `Blockbuster` | Modern teal & orange, punchy protected contrast. |
| `Kodachrome 64` | Dense reversal-stock blacks, saturated primaries, warm cast. |
| `Bleach Noir` | Bleach bypass: desaturated, silver highlights, hard gritty contrast. |
| `Neon Night` | Night maps: lifted cool shadows, cyan/magenta split, heavy bloom + halation. |
| `Arrakis 65` | Dune: Part Three inspired — Technicolor-style rich separation, golden ambers, dense blacks, very fine 65mm grain. |
| `Eterna Soft` | Fuji Eterna documentary baseline — the safe default that makes raw CS2 immediately filmic. |

All presets live in `presets/presets.json`; edit values there and run
`python3 tools/gen_presets_header.py` to regenerate the C++ table.

## Verification

```bash
cd reference
python3 make_test_frames.py   # regenerate CS2-palette test frames
python3 run_tests.py          # pipeline invariants + contact sheets
python3 compare_kernel.py     # compiles the C++ kernel, diffs it vs Python
```

`run_tests.py` checks: neutral preset is a no-op, auto exposure matches a
2.5-stop exposure swing to <0.035 mean-luminance spread, night scenes stay
below 0.30 mean luminance with default highlight protection, and every
preset × frame render stays finite and in range.

`compare_kernel.py` builds `tests/kernel_test.cpp` with your host compiler
and verifies the C++ kernel matches the Python reference within tolerance
on every preset (the plugin runs its spatial FX at half resolution, so tiny
differences around bright edges are expected and bounded).

## Note on test imagery

This repository was built in a sandbox whose network policy blocks image
hosts, so the committed test frames are procedural stand-ins that reproduce
each map's palette, dynamic range and lighting (including clipped
highlights and a night-map stress case) rather than real captures. The
grading math doesn't care, but do run `grade_cli.py` on real captures —
that's what it's for.

## Licence

MIT — see [LICENSE](LICENSE).
