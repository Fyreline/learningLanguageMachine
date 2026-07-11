# CineGrade — parameters

Every parameter is a standard After Effects parameter: **all keyframable**.

## Global

| Parameter | Range (default) | Notes |
|---|---|---|
| Mode | Simple / Advanced | Simple uses the preset + the Simple Controls group. Advanced applies the trim groups below on top of the preset. The unused group is greyed out. |
| Film Preset | popup ('80s Analog) | See docs/PRESETS.md. `None (Custom)` = neutral start for building from scratch in Advanced. |
| Strength | 0–100 % (100) | Lerps *every* preset value toward neutral — behaves like a printer light, not an opacity fade. |

## Auto Exposure

| Parameter | Range (default) | Notes |
|---|---|---|
| Enable (match shots) | off | Full-frame log-average luminance pulled to the target. |
| Target (EV) | −3…+3 (0) | 0 = mid grey 0.18. Positive brightens. |
| Adaptation | 0–100 % (100) | How much of the computed correction is applied. 60–80 % keeps some natural scene variation. |
| Highlight Protection | 0–100 % (35) | Restrains *lifts* when the frame already has bright sources (p99 anchor). Keeps night maps dark. 0 = pure matching. |
| Max Correction | 0–4 stops (4) | Hard clamp either direction. |
| Temporal Smoothing | 0–6 frames (2) | Triangular-weighted average of neighbour-frame stats. Stops pumping from muzzle flashes / flashbangs. Costs extra frame fetches. |

## Simple Controls (Simple mode)

Warmth (temperature trim, −100…100), then Grain / Halation / Glow /
Softness / Vignette as **percentages of the preset's own value** (0–200 %,
default 100 %). Turning a preset's character up or down without touching
its colour.

## Advanced trims

All advanced sliders default to neutral and are applied **on top of** the
strength-blended preset — deltas for additive quantities, multipliers for
gamma/gain. Keyframing a preset change therefore still animates smoothly.

### Exposure & Tone
Exposure (stops ±4) · Contrast (±100) · Contrast Pivot (0.05–0.5, 0.18) ·
Shadows / Highlights / Whites / Blacks (±100, Lightroom-style masked EV
adjustments in linear light).

### White Balance
Temperature (±100, + warms) · Tint (±100, + magenta→green axis).

### Filmic Curve
Curve Amount (± vs preset) · Toe (black density) · Shoulder (rolloff
strength) · White Point (where the shoulder lands, +/− vs preset). The
curve is per-channel in linear light: extended-Reinhard shoulder toward the
white point with a multiplicative flare toe.

### Colour
Saturation (±100 delta) · Vibrance (±100, boosts unsaturated pixels first)
· six-band mixer: Reds/Yellows/Greens/Cyans/Blues/Magentas × Sat and Lum
(±100 each, cosine-weighted 60° bands, grey-protected).

### Lift Gamma Gain
Per-channel Lift (±0.25), Gamma (0.5–2, multiplies preset), Gain (0–2,
multiplies preset). Classic display-space wheels as sliders.

### Split Toning
Shadow Hue/Tint, Highlight Hue/Tint, Balance. Luminance-preserving screen
tints. Setting a Tint above 0 overrides the preset's corresponding tone.

### Optics & Diffusion
Diffusion (pro-mist softness) · Glow Amount/Threshold/Radius (bright-pass
two-scale screen bloom) · Halation Amount/Threshold/Radius/Hue (red-biased
emulsion bleed around highlights — the single most "film" thing you can do
to game footage) · Chromatic Aberration (radial R/B, edges only, r²
weighted). Radii are calibrated at 720p and scale with resolution.

### Vignette
Amount (± darken/lighten) · Size · Feather · Roundness.

### Grain & Movement
Grain Amount · Grain Size (0.3–3, 1 ≈ 35 mm at 720p; scales with
resolution) · Grain Chroma (colour vs mono grain) · Grain Response (how
strongly grain concentrates in midtones — film's characteristic) · Gate
Weave (deterministic sub-pixel frame wobble) · Flicker (per-frame exposure
jitter, ±3 % at 50). Grain is seeded by frame number: deterministic renders,
different every frame.

## Working notes

- **Order of operations** is fixed (see DESIGN.md); trims slot into the
  pipeline at their stage, they don't stack a second pass.
- For shot-matched edits: enable Auto Exposure with Adaptation ~70 %,
  Smoothing 2–3, and leave it keyframed once for the whole timeline.
- 32-bpc comps: input above 1.0 is tone-mapped by the filmic curve rather
  than clipped — feed it HDR captures if you have them.
