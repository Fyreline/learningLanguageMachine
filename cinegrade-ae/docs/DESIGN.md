# CineGrade — design

## Why this shape

CS2 footage has three problems for filmic grading:

1. **Wild scene-to-scene variance.** Dust2 midday is 3+ stops hotter than a
   Vertigo night round; Nuke's overcast sky sits near clip while its
   interiors are murky. A static grade that flatters one map breaks on the
   next. → **Auto exposure** with temporal smoothing and highlight
   protection, so a single keyframed effect holds up across a whole frag
   movie.
2. **Video-game tonality.** The engine outputs display-referred sRGB with
   hard-clipped highlights and saturated primaries. Film differs mostly at
   the ends of the curve: soft toe, long shoulder, halation where highlights
   bleed, grain that lives in the midtones. → **Filmic curve + optics stack**.
3. **Editors need both speed and control.** → **Simple mode** (preset +
   strength + six trims) and **Advanced mode** (~60 trims over the whole
   pipeline), same engine underneath.

## Pipeline order

Fixed, deliberately: colour decisions happen scene-linear, "look" decisions
happen display-referred, optics happen on the displayed image (that is
where lenses and print stocks live), and grain goes last because real grain
is a property of the print, sitting on top of everything including the
vignette.

```
decode sRGB → linear
  1  flicker            exposure jitter (linear gain)
  2  auto exposure      log-avg luminance → gain toward target EV
  3  manual exposure    stops
  4  white balance      temperature / tint channel gains
  5  contrast           power about pivot (log-domain)
  6  tonal ranges       shadows / highlights / whites / blacks (masked EV)
  7  filmic tone map    adjustable toe / shoulder / white point
encode linear → display
  8  lift / gamma / gain
  9  saturation + vibrance
 10  six-band mixer     R Y G C B M saturation + luminance
 11  split toning       shadow/highlight tints, luminance-preserving
 12  diffusion          pro-mist: screened wide blur + slight softening
 13  glow               bright-pass → two-scale blur → screen
 14  halation           bright-pass → wide blur → red-orange screen
 15  chromatic aberration  radial R/B scale, r² weighted (edges only)
 16  vignette
 17  gate weave         sub-pixel deterministic frame wobble
 18  film grain         luminance-response-weighted value noise
```

## Auto exposure

- Statistics: geometric mean (log-average) of linear luminance on a 4×
  subsampled grid — the film-industry "key" measure, stable against
  outliers.
- Correction: `stops = log2(0.18·2^targetEV / logAvg)`, clamped to ±Max
  Correction, scaled by Adaptation.
- **Highlight protection** (the part that makes it usable on CS2): when the
  correction is positive (lifting), the 99th-percentile luminance anchors a
  second candidate `log2(0.75 / p99)`; the final lift blends toward the
  smaller of the two by the protection amount. Night maps with floodlights
  keep their darkness; genuinely underexposed daylight still lifts fully.
- **Temporal smoothing**: the correction is a triangular-weighted average
  of the stats of up to ±6 neighbouring frames (extra SmartFX layer
  checkouts), so the gain glides through explosions and flashbangs instead
  of pumping. Frames beyond the layer bounds are detected via alpha and
  skipped.

## Presets as data

`presets/presets.json` holds every look as a full parameter set against a
documented `neutral` baseline. The Python reference reads it directly; the
C++ table (`plugin/src/Presets.h`) is generated from it. "Strength" lerps
every parameter toward neutral, which is why it behaves like a printer
light rather than an opacity crossfade. Advanced sliders are *trims* (deltas)
on top of the blended preset, so keyframing a preset switch mid-shot still
animates smoothly.

## Bit depths and colour

SmartFX with `PF_OutFlag2_FLOAT_COLOR_AWARE`: 8-bpc (255), 16-bpc (32768)
and 32-bpc float worlds are converted to interleaved float RGBA, processed
identically, and written back (integer depths are clamped; float output is
non-negative and ≤1 by construction of the screen-based optics). The
pipeline assumes display-referred sRGB/Rec.709-ish input — which is what
CS2 captures are. Alpha passes through untouched.

## Performance

The per-pixel colour stages are a single fused sweep. Diffusion, glow and
halation share half-resolution planes (three-pass sliding-window box blur ≈
gaussian, O(1) per radius); results are bilinearly upsampled. Grain, CA,
vignette and weave are full-res single passes. `PF_OutFlag2_SUPPORTS_THREADED_RENDERING`
is set — the render path touches no mutable globals, so AE's multi-frame
rendering can run frames in parallel.

## Testing strategy

The kernel is a header with no AE dependencies, compiled by
`reference/compare_kernel.py` with the host compiler and diffed against the
Python reference on every preset × frame — auto-exposure stops must agree
within 0.05 stop, images within 0.01 mean / 0.06 p99 (spatial FX run at
half res in C++). `reference/run_tests.py` checks pipeline invariants (see
README). What cannot be tested without After Effects itself — PiPL
registration, param plumbing, world formats — is kept as thin and as close
to the SDK samples as possible, and the PiPL/outflags coupling gets its own
checker (`tools/check_pipl_flags.py`).
