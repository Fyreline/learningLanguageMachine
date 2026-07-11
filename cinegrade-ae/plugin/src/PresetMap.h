// PresetMap.h — map a generated PresetDef onto kernel GradeParams,
// optionally blended toward neutral by `strength` (simple-mode Strength).
// Shared by the AE glue (CineGrade.cpp) and the offline kernel test.

#pragma once

#include "CineGradeKernel.h"
#include "Presets.h"

namespace cinegrade {

inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }

// strength in [0,1]: 0 = neutral (kPresets[0]), 1 = full preset.
inline GradeParams presetToParams(const PresetDef& p, float strength = 1.0f) {
    const PresetDef& n = kPresets[0];
    GradeParams o;
    const float s = clampf(strength, 0.0f, 1.0f);
    o.exposure = lerpf(n.exposure, p.exposure, s);
    o.temperature = lerpf(n.temperature, p.temperature, s);
    o.tint = lerpf(n.tint, p.tint, s);
    o.contrast = lerpf(n.contrast, p.contrast, s);
    o.pivot = lerpf(n.pivot, p.pivot, s);
    o.shadows = lerpf(n.shadows, p.shadows, s);
    o.highlights = lerpf(n.highlights, p.highlights, s);
    o.whites = lerpf(n.whites, p.whites, s);
    o.blacks = lerpf(n.blacks, p.blacks, s);
    o.filmicAmount = lerpf(n.filmic_amount, p.filmic_amount, s);
    o.toe = lerpf(n.toe, p.toe, s);
    o.shoulder = lerpf(n.shoulder, p.shoulder, s);
    o.whitePoint = lerpf(n.white_point, p.white_point, s);
    o.saturation = lerpf(n.saturation, p.saturation, s);
    o.vibrance = lerpf(n.vibrance, p.vibrance, s);
    for (int i = 0; i < 6; ++i) {
        o.bandSat[i] = lerpf(n.band_sat[i], p.band_sat[i], s);
        o.bandLum[i] = lerpf(n.band_lum[i], p.band_lum[i], s);
    }
    o.splitShadowHue = p.split_shadow_hue;   // hues are not blended
    o.splitShadowSat = lerpf(n.split_shadow_sat, p.split_shadow_sat, s);
    o.splitHighlightHue = p.split_highlight_hue;
    o.splitHighlightSat = lerpf(n.split_highlight_sat, p.split_highlight_sat, s);
    o.splitBalance = lerpf(n.split_balance, p.split_balance, s);
    for (int i = 0; i < 3; ++i) {
        o.lift[i] = lerpf(n.lift[i], p.lift[i], s);
        o.gamma[i] = lerpf(n.gamma[i], p.gamma[i], s);
        o.gain[i] = lerpf(n.gain[i], p.gain[i], s);
    }
    o.softness = lerpf(n.softness, p.softness, s);
    o.glowAmount = lerpf(n.glow_amount, p.glow_amount, s);
    o.glowThreshold = lerpf(n.glow_threshold, p.glow_threshold, s);
    o.glowRadius = lerpf(n.glow_radius, p.glow_radius, s);
    o.halationAmount = lerpf(n.halation_amount, p.halation_amount, s);
    o.halationThreshold = lerpf(n.halation_threshold, p.halation_threshold, s);
    o.halationRadius = lerpf(n.halation_radius, p.halation_radius, s);
    o.halationHue = p.halation_hue;
    o.caAmount = lerpf(n.ca_amount, p.ca_amount, s);
    o.vignetteAmount = lerpf(n.vignette_amount, p.vignette_amount, s);
    o.vignetteSize = lerpf(n.vignette_size, p.vignette_size, s);
    o.vignetteFeather = lerpf(n.vignette_feather, p.vignette_feather, s);
    o.vignetteRoundness = lerpf(n.vignette_roundness, p.vignette_roundness, s);
    o.grainAmount = lerpf(n.grain_amount, p.grain_amount, s);
    o.grainSize = lerpf(n.grain_size, p.grain_size, s);
    o.grainChroma = lerpf(n.grain_chroma, p.grain_chroma, s);
    o.grainResponse = lerpf(n.grain_response, p.grain_response, s);
    o.gateWeave = lerpf(n.gate_weave, p.gate_weave, s);
    o.flicker = lerpf(n.flicker, p.flicker, s);
    return o;
}

} // namespace cinegrade
