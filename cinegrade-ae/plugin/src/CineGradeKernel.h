// CineGradeKernel.h — the full grading pipeline, AE-independent.
//
// This header mirrors reference/cinegrade.py stage for stage (that file is
// the documented ground truth). It deliberately includes no After Effects
// headers so it can be compiled and regression-tested with a plain C++17
// compiler (see tests/kernel_test.cpp). CineGrade.cpp adapts AE worlds
// (8/16/32 bpc) into the float RGBA buffers used here.
//
// Buffers are interleaved RGBA float32, R at index 0. Alpha is preserved
// untouched by every stage. Values are display-referred [0,1] at entry and
// exit; the pipeline linearises internally.

#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace cinegrade {

// ---------------------------------------------------------------- params --

struct GradeParams {
    // linear-domain stages
    float exposure      = 0.0f;   // stops
    float temperature   = 0.0f;   // -100..100
    float tint          = 0.0f;   // -100..100
    float contrast      = 0.0f;   // -100..100
    float pivot         = 0.18f;
    float shadows       = 0.0f;   // -100..100
    float highlights    = 0.0f;
    float whites        = 0.0f;
    float blacks        = 0.0f;
    float filmicAmount  = 0.0f;   // 0..100
    float toe           = 0.0f;   // 0..100
    float shoulder      = 50.0f;  // 0..100
    float whitePoint    = 1.0f;   // 1..4

    // display-domain stages
    float lift[3]  = {0, 0, 0};
    float gamma[3] = {1, 1, 1};
    float gain[3]  = {1, 1, 1};
    float saturation = 100.0f;    // 0..200
    float vibrance   = 0.0f;      // -100..100
    float bandSat[6] = {0, 0, 0, 0, 0, 0};  // R Y G C B M
    float bandLum[6] = {0, 0, 0, 0, 0, 0};
    float splitShadowHue    = 220.0f;
    float splitShadowSat    = 0.0f;
    float splitHighlightHue = 45.0f;
    float splitHighlightSat = 0.0f;
    float splitBalance      = 0.0f;

    float softness          = 0.0f;   // 0..100
    float glowAmount        = 0.0f;   // 0..100
    float glowThreshold     = 75.0f;  // 0..100
    float glowRadius        = 40.0f;  // px at 720p, scaled by height
    float halationAmount    = 0.0f;
    float halationThreshold = 80.0f;
    float halationRadius    = 60.0f;
    float halationHue       = 20.0f;  // degrees
    float caAmount          = 0.0f;   // 0..100
    float vignetteAmount    = 0.0f;
    float vignetteSize      = 70.0f;
    float vignetteFeather   = 50.0f;
    float vignetteRoundness = 0.0f;
    float grainAmount       = 0.0f;   // 0..100
    float grainSize         = 1.0f;   // 0.5..2
    float grainChroma       = 20.0f;  // 0..100
    float grainResponse     = 60.0f;  // 0..100
    float gateWeave         = 0.0f;   // 0..100
    float flicker           = 0.0f;   // 0..100
};

struct AutoExposure {
    bool  enabled          = false;
    float targetEv         = 0.0f;   // -3..3
    float adapt            = 1.0f;   // 0..1
    float highlightProtect = 0.35f;  // 0..1
    float maxStops         = 4.0f;   // 0..4
};

// ---------------------------------------------------------------- helpers -

inline float clampf(float x, float lo, float hi) {
    return x < lo ? lo : (x > hi ? hi : x);
}

inline float srgbToLinear(float x) {
    if (x <= 0.0f) return 0.0f;
    return x <= 0.04045f ? x / 12.92f
                         : std::pow((x + 0.055f) / 1.055f, 2.4f);
}

inline float linearToSrgb(float x) {
    if (x <= 0.0f) return 0.0f;
    return x <= 0.0031308f ? x * 12.92f
                           : 1.055f * std::pow(x, 1.0f / 2.4f) - 0.055f;
}

inline float lumOf(float r, float g, float b) {
    return 0.2126f * r + 0.7152f * g + 0.0722f * b;
}

inline float smoothstepf(float e0, float e1, float x) {
    float t = clampf((x - e0) / (e1 - e0), 0.0f, 1.0f);
    return t * t * (3.0f - 2.0f * t);
}

// deterministic integer hash -> [0,1). Stable across platforms/renders.
inline uint32_t hashU32(uint32_t x) {
    x ^= x >> 16; x *= 0x7feb352dU;
    x ^= x >> 15; x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

inline float hash01(uint32_t a, uint32_t b, uint32_t c) {
    uint32_t h = hashU32(a * 0x9E3779B1U ^ hashU32(b * 0x85EBCA77U ^ c));
    return (h & 0xFFFFFF) / 16777216.0f;
}

// approx unit gaussian from 4 uniform hashes (Irwin–Hall, sigma-corrected)
inline float hashGauss(uint32_t x, uint32_t y, uint32_t seed) {
    float s = hash01(x, y, seed) + hash01(x, y, seed + 101)
            + hash01(x, y, seed + 202) + hash01(x, y, seed + 303);
    return (s - 2.0f) * 1.7320508f; // var of sum of 4 U(0,1) = 1/3
}

inline void hueToRgb(float hueDeg, float out[3]) {
    float h = std::fmod(hueDeg < 0 ? hueDeg + 360.0f * 16 : hueDeg, 360.0f) / 60.0f;
    float x = 1.0f - std::fabs(std::fmod(h, 2.0f) - 1.0f);
    int i = static_cast<int>(h) % 6;
    switch (i) {
        case 0: out[0] = 1; out[1] = x; out[2] = 0; break;
        case 1: out[0] = x; out[1] = 1; out[2] = 0; break;
        case 2: out[0] = 0; out[1] = 1; out[2] = x; break;
        case 3: out[0] = 0; out[1] = x; out[2] = 1; break;
        case 4: out[0] = x; out[1] = 0; out[2] = 1; break;
        default: out[0] = 1; out[1] = 0; out[2] = x; break;
    }
}

// ------------------------------------------------------------- box blur ---
// three-pass sliding-window box blur on a single-channel plane; radius in px.
// Matches reference gaussian_blur(): r = round(sigma * 0.8), 3 passes.

inline void boxBlurPass(std::vector<float>& src, std::vector<float>& tmp,
                        int w, int h, int r, bool horizontal) {
    if (r < 1) return;
    const float inv = 1.0f;
    if (horizontal) {
        for (int y = 0; y < h; ++y) {
            const float* row = &src[(size_t)y * w];
            float* out = &tmp[(size_t)y * w];
            float acc = 0.0f;
            int count = 0;
            for (int x = 0; x <= std::min(r, w - 1); ++x) { acc += row[x]; ++count; }
            for (int x = 0; x < w; ++x) {
                out[x] = acc / count;
                int add = x + r + 1, rem = x - r;
                if (add < w) { acc += row[add]; ++count; }
                if (rem >= 0) { acc -= row[rem]; --count; }
            }
        }
    } else {
        for (int x = 0; x < w; ++x) {
            float acc = 0.0f;
            int count = 0;
            for (int y = 0; y <= std::min(r, h - 1); ++y) { acc += src[(size_t)y * w + x]; ++count; }
            for (int y = 0; y < h; ++y) {
                tmp[(size_t)y * w + x] = acc / count;
                int add = y + r + 1, rem = y - r;
                if (add < h) { acc += src[(size_t)add * w + x]; ++count; }
                if (rem >= 0) { acc -= src[(size_t)rem * w + x]; --count; }
            }
        }
    }
    src.swap(tmp);
    (void)inv;
}

inline void gaussianBlurPlane(std::vector<float>& plane, int w, int h,
                              float sigma) {
    if (sigma <= 0.25f) return;
    int r = std::max(1, (int)std::lround(sigma * 0.8));
    std::vector<float> tmp(plane.size());
    for (int pass = 0; pass < 3; ++pass) {
        boxBlurPass(plane, tmp, w, h, r, true);
        boxBlurPass(plane, tmp, w, h, r, false);
    }
}

// --------------------------------------------------------- auto exposure --
// Compute the exposure correction (in stops) for one frame. rgba is the
// *source* frame (display-referred). Mirrors auto_exposure_gain().

inline float computeAutoExposureStops(const float* rgba, int w, int h,
                                      size_t strideFloats,
                                      const AutoExposure& ae) {
    std::vector<float> lums;
    lums.reserve(((size_t)w / 4 + 1) * ((size_t)h / 4 + 1));
    double logSum = 0.0;
    size_t n = 0;
    for (int y = 0; y < h; y += 4) {
        const float* row = rgba + (size_t)y * strideFloats;
        for (int x = 0; x < w; x += 4) {
            const float* px = row + (size_t)x * 4;
            float lum = lumOf(srgbToLinear(px[0]), srgbToLinear(px[1]),
                              srgbToLinear(px[2]));
            lums.push_back(lum);
            logSum += std::log((double)lum + 1e-4);
            ++n;
        }
    }
    if (n == 0) return 0.0f;
    float logAvg = (float)std::exp(logSum / (double)n);
    float target = 0.18f * std::exp2(ae.targetEv);
    float stops = std::log2(target / std::max(logAvg, 1e-6f));
    if (stops > 0.0f && ae.highlightProtect > 0.0f) {
        size_t k = (size_t)((lums.size() - 1) * 0.99);
        std::nth_element(lums.begin(), lums.begin() + k, lums.end());
        float p99 = lums[k];
        float stopsHl = std::log2(0.75f / std::max(p99, 1e-6f));
        float limited = std::min(stops, std::max(stopsHl, 0.0f));
        stops += (limited - stops) * ae.highlightProtect;
    }
    stops = clampf(stops, -ae.maxStops, ae.maxStops) * ae.adapt;
    return stops;
}

// ------------------------------------------------------------- pipeline ---

namespace detail {

inline void bilinearSample(const std::vector<float>& plane, int w, int h,
                           float sx, float sy, float& out) {
    sx = clampf(sx, 0.0f, (float)(w - 1));
    sy = clampf(sy, 0.0f, (float)(h - 1));
    int x0 = (int)sx, y0 = (int)sy;
    int x1 = std::min(x0 + 1, w - 1), y1 = std::min(y0 + 1, h - 1);
    float fx = sx - x0, fy = sy - y0;
    float a = plane[(size_t)y0 * w + x0], b = plane[(size_t)y0 * w + x1];
    float c = plane[(size_t)y1 * w + x0], d = plane[(size_t)y1 * w + x1];
    out = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// downsample an RGB extraction (via functor) to half resolution
template <typename F>
inline void extractHalf(const float* rgba, int w, int h, size_t stride,
                        std::vector<float>& out, int& hw, int& hh, F f) {
    hw = std::max(1, w / 2);
    hh = std::max(1, h / 2);
    out.assign((size_t)hw * hh, 0.0f);
    for (int y = 0; y < hh; ++y) {
        int sy = std::min(y * 2, h - 1), sy1 = std::min(sy + 1, h - 1);
        for (int x = 0; x < hw; ++x) {
            int sx = std::min(x * 2, w - 1), sx1 = std::min(sx + 1, w - 1);
            const float* p00 = rgba + (size_t)sy * stride + (size_t)sx * 4;
            const float* p01 = rgba + (size_t)sy * stride + (size_t)sx1 * 4;
            const float* p10 = rgba + (size_t)sy1 * stride + (size_t)sx * 4;
            const float* p11 = rgba + (size_t)sy1 * stride + (size_t)sx1 * 4;
            out[(size_t)y * hw + x] =
                0.25f * (f(p00) + f(p01) + f(p10) + f(p11));
        }
    }
}

} // namespace detail

// The full grade. rgba: interleaved RGBA float, `strideFloats` floats per
// row. aeStops: precomputed auto-exposure correction (0 when disabled) —
// computed by the caller so it can be temporally smoothed across frames.
// frame: current frame number, drives grain / weave / flicker.
inline void gradeFrame(float* rgba, int w, int h, size_t strideFloats,
                       const GradeParams& p, int frame, float aeStops) {
    const float px = h / 720.0f;  // radii calibrated at 720p

    // per-pixel exposure/colour/tone (linear domain), done in one sweep ----
    const float exposureGain =
        std::exp2(p.exposure + aeStops) *
        (1.0f + (hash01((uint32_t)frame, 77, 0) - 0.5f) * 2.0f *
                    (p.flicker / 100.0f) * 0.06f * (p.flicker > 0 ? 1.f : 0.f));
    const float t = p.temperature / 100.0f, g = p.tint / 100.0f;
    const float wbR = 1.0f + 0.25f * t - 0.05f * g;
    const float wbG = 1.0f + 0.10f * g;
    const float wbB = 1.0f - 0.25f * t - 0.05f * g;
    const float cExp = 1.0f + p.contrast / 100.0f;
    const float shoulderS = std::pow(p.shoulder / 100.0f, 1.5f) * 1.6f;
    const float wp = std::max(p.whitePoint, 1.0f);
    const float toeT = (p.toe / 100.0f) * 0.05f;
    const float filmicA = p.filmicAmount / 100.0f;
    const float satF = p.saturation / 100.0f;
    const float vib = p.vibrance / 100.0f;

    float cSh[3], cHi[3];
    hueToRgb(p.splitShadowHue, cSh);
    hueToRgb(p.splitHighlightHue, cHi);
    for (int i = 0; i < 3; ++i) {
        cSh[i] *= p.splitShadowSat / 100.0f;
        cHi[i] *= p.splitHighlightSat / 100.0f;
    }
    const float bal = p.splitBalance / 100.0f * 0.25f;

    bool anyBand = false;
    for (int i = 0; i < 6; ++i)
        if (p.bandSat[i] != 0.0f || p.bandLum[i] != 0.0f) anyBand = true;

    for (int y = 0; y < h; ++y) {
        float* row = rgba + (size_t)y * strideFloats;
        for (int x = 0; x < w; ++x) {
            float* q = row + (size_t)x * 4;
            float r = srgbToLinear(q[0]);
            float gg = srgbToLinear(q[1]);
            float b = srgbToLinear(q[2]);

            // exposure + white balance
            r *= exposureGain * wbR;
            gg *= exposureGain * wbG;
            b *= exposureGain * wbB;

            // contrast about pivot (log-domain power, per channel)
            if (p.contrast != 0.0f) {
                r = p.pivot * std::pow(std::max(r, 1e-6f) / p.pivot, cExp);
                gg = p.pivot * std::pow(std::max(gg, 1e-6f) / p.pivot, cExp);
                b = p.pivot * std::pow(std::max(b, 1e-6f) / p.pivot, cExp);
            }

            // tonal ranges, masked in display space
            if (p.shadows != 0 || p.highlights != 0 || p.whites != 0 ||
                p.blacks != 0) {
                float d = linearToSrgb(lumOf(r, gg, b));
                float wSh = 1.0f - smoothstepf(0.0f, 0.55f, d);
                float wHi = smoothstepf(0.45f, 1.0f, d);
                float wWh = smoothstepf(0.75f, 1.0f, d);
                float wBl = 1.0f - smoothstepf(0.0f, 0.25f, d);
                float stops = (p.shadows / 100.0f) * 0.9f * wSh +
                              (p.highlights / 100.0f) * 0.9f * wHi +
                              (p.whites / 100.0f) * 0.6f * wWh +
                              (p.blacks / 100.0f) * 0.6f * wBl;
                float m = std::exp2(stops);
                r *= m; gg *= m; b *= m;
            }

            // filmic tone map
            if (filmicA > 0.0f) {
                float ch[3] = {r, gg, b};
                for (int i = 0; i < 3; ++i) {
                    float xx = std::max(ch[i], 0.0f);
                    float curved = xx * (1.0f + shoulderS * xx / (wp * wp)) /
                                   (1.0f + shoulderS * xx);
                    if (toeT > 0) curved *= xx / (xx + toeT);
                    ch[i] = ch[i] + (curved - ch[i]) * filmicA;
                }
                r = ch[0]; gg = ch[1]; b = ch[2];
            }

            // to display space
            r = linearToSrgb(r); gg = linearToSrgb(gg); b = linearToSrgb(b);

            // lift / gamma / gain
            {
                float ch[3] = {r, gg, b};
                for (int i = 0; i < 3; ++i) {
                    float xx = p.gain[i] * (ch[i] + p.lift[i] * (1.0f - ch[i]));
                    ch[i] = std::pow(std::max(xx, 0.0f),
                                     1.0f / std::max(p.gamma[i], 1e-3f));
                }
                r = ch[0]; gg = ch[1]; b = ch[2];
            }

            // saturation + vibrance
            {
                float lum = lumOf(r, gg, b);
                r = lum + (r - lum) * satF;
                gg = lum + (gg - lum) * satF;
                b = lum + (b - lum) * satF;
                if (vib != 0.0f) {
                    float mx = std::max(r, std::max(gg, b));
                    float mn = std::min(r, std::min(gg, b));
                    float cs = mx > 1e-4f ? (mx - mn) / mx : 0.0f;
                    float wv = vib > 0 ? (1.0f - cs) : 1.0f;
                    float f = 1.0f + vib * wv;
                    float l2 = lumOf(r, gg, b);
                    r = l2 + (r - l2) * f;
                    gg = l2 + (gg - l2) * f;
                    b = l2 + (b - l2) * f;
                }
            }

            // six-band colour mixer
            if (anyBand) {
                float mx = std::max(r, std::max(gg, b));
                float mn = std::min(r, std::min(gg, b));
                float c = mx - mn;
                float hue = 0.0f;
                if (c > 1e-6f) {
                    if (mx == r) hue = std::fmod(60.0f * ((gg - b) / c) + 360.0f, 360.0f);
                    else if (mx == gg) hue = 60.0f * ((b - r) / c) + 120.0f;
                    else hue = 60.0f * ((r - gg) / c) + 240.0f;
                }
                float sat = mx > 1e-6f ? c / mx : 0.0f;
                float satAdj = 0.0f, lumAdj = 0.0f;
                for (int i = 0; i < 6; ++i) {
                    float d = std::fabs(std::fmod(hue - i * 60.0f + 540.0f,
                                                  360.0f) - 180.0f);
                    float wgt = clampf(1.0f - d / 60.0f, 0.0f, 1.0f);
                    wgt = wgt * wgt * (3.0f - 2.0f * wgt);
                    satAdj += wgt * (p.bandSat[i] / 100.0f);
                    lumAdj += wgt * (p.bandLum[i] / 100.0f);
                }
                satAdj *= sat; lumAdj *= sat;
                float lum = lumOf(r, gg, b);
                r = lum + (r - lum) * (1.0f + satAdj);
                gg = lum + (gg - lum) * (1.0f + satAdj);
                b = lum + (b - lum) * (1.0f + satAdj);
                float m = std::exp2(lumAdj * 0.8f);
                r *= m; gg *= m; b *= m;
            }

            // split toning (luminance preserving)
            if (p.splitShadowSat > 0 || p.splitHighlightSat > 0) {
                float lum = lumOf(r, gg, b);
                float wHi2 = smoothstepf(0.35f - bal, 0.95f - bal, lum);
                float wSh2 = 1.0f - smoothstepf(0.05f - bal, 0.65f - bal, lum);
                float ch[3] = {r, gg, b};
                for (int i = 0; i < 3; ++i) {
                    float add = wSh2 * cSh[i] * 0.35f + wHi2 * cHi[i] * 0.35f;
                    ch[i] = ch[i] + add * (1.0f - ch[i]);
                }
                float l1 = std::max(lumOf(ch[0], ch[1], ch[2]), 1e-4f);
                float scale = std::max(lum, 1e-4f) / l1;
                r = ch[0] * scale; gg = ch[1] * scale; b = ch[2] * scale;
            }

            q[0] = r; q[1] = gg; q[2] = b;
        }
    }

    // ------------------------------------------------------ spatial FX ----
    // Diffusion, glow and halation share half-res blurred planes.
    auto clamp01 = [](float v) { return clampf(v, 0.0f, 1.0f); };

    int hw = 0, hh = 0;
    std::vector<float> halfR, halfG, halfB;
    if (p.softness > 0 || p.glowAmount > 0 || p.halationAmount > 0) {
        detail::extractHalf(rgba, w, h, strideFloats, halfR, hw, hh,
                            [](const float* q) { return q[0]; });
        {
            std::vector<float> tmp;
            detail::extractHalf(rgba, w, h, strideFloats, tmp, hw, hh,
                                [](const float* q) { return q[1]; });
            halfG.swap(tmp);
        }
        {
            std::vector<float> tmp;
            detail::extractHalf(rgba, w, h, strideFloats, tmp, hw, hh,
                                [](const float* q) { return q[2]; });
            halfB.swap(tmp);
        }
    }

    // diffusion ("softness")
    if (p.softness > 0.0f) {
        float s = p.softness / 100.0f;
        float sigma = std::max(2.0f, h * 0.02f * (0.5f + s)) * 0.5f; // half-res
        std::vector<float> dr = halfR, dg = halfG, db = halfB;
        gaussianBlurPlane(dr, hw, hh, sigma);
        gaussianBlurPlane(dg, hw, hh, sigma);
        gaussianBlurPlane(db, hw, hh, sigma);
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            for (int x = 0; x < w; ++x) {
                float* q = row + (size_t)x * 4;
                float bl[3];
                detail::bilinearSample(dr, hw, hh, x * 0.5f, y * 0.5f, bl[0]);
                detail::bilinearSample(dg, hw, hh, x * 0.5f, y * 0.5f, bl[1]);
                detail::bilinearSample(db, hw, hh, x * 0.5f, y * 0.5f, bl[2]);
                for (int i = 0; i < 3; ++i) {
                    float d0 = q[i];
                    float screened = 1.0f - (1.0f - clamp01(d0)) *
                                     (1.0f - clamp01(bl[i]) * 0.7f * s);
                    float out = d0 + (screened - d0) * 0.6f;
                    // slight overall softening toward the blur
                    q[i] = out + (bl[i] - out) * (0.25f * s) * 0.35f;
                }
            }
        }
    }

    // glow
    if (p.glowAmount > 0.0f) {
        float a = p.glowAmount / 100.0f;
        float thr = p.glowThreshold / 100.0f, knee = 0.1f;
        std::vector<float> gr((size_t)hw * hh), gg2((size_t)hw * hh),
            gb((size_t)hw * hh);
        for (size_t i = 0; i < gr.size(); ++i) {
            float lum = lumOf(std::max(halfR[i], 0.0f), std::max(halfG[i], 0.0f),
                              std::max(halfB[i], 0.0f));
            float wgt = smoothstepf(thr - knee, thr + knee, lum);
            gr[i] = halfR[i] * wgt; gg2[i] = halfG[i] * wgt; gb[i] = halfB[i] * wgt;
        }
        float rad = p.glowRadius * px * 0.5f; // half-res
        std::vector<float> nr = gr, ng = gg2, nb = gb;
        gaussianBlurPlane(nr, hw, hh, rad * 0.25f);
        gaussianBlurPlane(ng, hw, hh, rad * 0.25f);
        gaussianBlurPlane(nb, hw, hh, rad * 0.25f);
        gaussianBlurPlane(gr, hw, hh, rad * 0.6f);
        gaussianBlurPlane(gg2, hw, hh, rad * 0.6f);
        gaussianBlurPlane(gb, hw, hh, rad * 0.6f);
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            for (int x = 0; x < w; ++x) {
                float* q = row + (size_t)x * 4;
                float add[3];
                float v1, v2;
                detail::bilinearSample(nr, hw, hh, x * 0.5f, y * 0.5f, v1);
                detail::bilinearSample(gr, hw, hh, x * 0.5f, y * 0.5f, v2);
                add[0] = v1 + v2 * 0.6f;
                detail::bilinearSample(ng, hw, hh, x * 0.5f, y * 0.5f, v1);
                detail::bilinearSample(gg2, hw, hh, x * 0.5f, y * 0.5f, v2);
                add[1] = v1 + v2 * 0.6f;
                detail::bilinearSample(nb, hw, hh, x * 0.5f, y * 0.5f, v1);
                detail::bilinearSample(gb, hw, hh, x * 0.5f, y * 0.5f, v2);
                add[2] = v1 + v2 * 0.6f;
                for (int i = 0; i < 3; ++i) {
                    float av = clamp01(add[i] * a * 0.9f);
                    q[i] = 1.0f - (1.0f - clamp01(q[i])) * (1.0f - av);
                }
            }
        }
    }

    // halation
    if (p.halationAmount > 0.0f) {
        float a = p.halationAmount / 100.0f;
        float thr = p.halationThreshold / 100.0f, knee = 0.15f;
        float tintC[3];
        hueToRgb(p.halationHue, tintC);
        float mxT = std::max(tintC[0], std::max(tintC[1], tintC[2]));
        for (int i = 0; i < 3; ++i) tintC[i] /= std::max(mxT, 1e-6f);
        tintC[0] *= 1.0f; tintC[1] = tintC[1] * 0.55f + 0.05f; tintC[2] *= 0.25f;
        std::vector<float> bp((size_t)hw * hh);
        for (size_t i = 0; i < bp.size(); ++i) {
            float lum = lumOf(std::max(halfR[i], 0.0f), std::max(halfG[i], 0.0f),
                              std::max(halfB[i], 0.0f));
            float wgt = smoothstepf(thr - knee, thr + knee, lum);
            bp[i] = lum * wgt;
        }
        float rad = p.halationRadius * px * 0.5f;
        std::vector<float> b1 = bp, b2 = bp;
        gaussianBlurPlane(b1, hw, hh, rad * 0.5f);
        gaussianBlurPlane(b2, hw, hh, rad * 1.1f);
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            for (int x = 0; x < w; ++x) {
                float* q = row + (size_t)x * 4;
                float v1, v2;
                detail::bilinearSample(b1, hw, hh, x * 0.5f, y * 0.5f, v1);
                detail::bilinearSample(b2, hw, hh, x * 0.5f, y * 0.5f, v2);
                float blur = v1 + v2 * 0.5f;
                for (int i = 0; i < 3; ++i) {
                    float av = clamp01(blur * tintC[i] * a * 0.55f);
                    q[i] = 1.0f - (1.0f - clamp01(q[i])) * (1.0f - av);
                }
            }
        }
    }

    // chromatic aberration (radial R/B scale, weighted by r^2)
    if (p.caAmount > 0.0f) {
        float cx = (w - 1) * 0.5f, cy = (h - 1) * 0.5f;
        float diag = std::sqrt(cx * cx + cy * cy);
        float maxShift = p.caAmount / 100.0f * 3.0f * px;
        float sR = 1.0f - maxShift / diag, sB = 1.0f + maxShift / diag;
        std::vector<float> rp((size_t)w * h), bpn((size_t)w * h);
        for (int y = 0; y < h; ++y) {
            const float* row = rgba + (size_t)y * strideFloats;
            for (int x = 0; x < w; ++x) {
                rp[(size_t)y * w + x] = row[(size_t)x * 4 + 0];
                bpn[(size_t)y * w + x] = row[(size_t)x * 4 + 2];
            }
        }
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            float ny = (y - cy) / std::max(cy, 1.0f);
            for (int x = 0; x < w; ++x) {
                float nx = (x - cx) / std::max(cx, 1.0f);
                float r2 = clampf(nx * nx + ny * ny, 0.0f, 1.0f);
                float* q = row + (size_t)x * 4;
                float vr, vb;
                detail::bilinearSample(rp, w, h, cx + (x - cx) * sR,
                                       cy + (y - cy) * sR, vr);
                detail::bilinearSample(bpn, w, h, cx + (x - cx) * sB,
                                       cy + (y - cy) * sB, vb);
                q[0] = vr * r2 + q[0] * (1.0f - r2);
                q[2] = vb * r2 + q[2] * (1.0f - r2);
            }
        }
    }

    // vignette
    if (p.vignetteAmount != 0.0f) {
        float inner = p.vignetteSize / 100.0f * 1.2f;
        float feath = std::max(p.vignetteFeather / 100.0f, 0.01f) * 1.2f;
        float rnd = p.vignetteRoundness / 100.0f;
        float amt = p.vignetteAmount / 100.0f;
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            float ny = ((float)y / (h - 1) - 0.5f) * 2.0f;
            for (int x = 0; x < w; ++x) {
                float nx = ((float)x / (w - 1) - 0.5f) * 2.0f *
                           (1.0f + (1.0f - rnd) * 0.15f);
                float r = std::sqrt(nx * nx + ny * ny);
                float mask = smoothstepf(inner, inner + feath, r);
                float gmul = 1.0f - mask * amt;
                float* q = row + (size_t)x * 4;
                q[0] *= gmul; q[1] *= gmul; q[2] *= gmul;
            }
        }
    }

    // gate weave (sub-pixel wobble)
    if (p.gateWeave > 0.0f) {
        float amp = p.gateWeave / 100.0f * 1.5f * px;
        float fdx = (std::sin(frame * 0.61f + hash01(frame, 11, 0) * 6.28f) * 0.7f +
                     (hash01(frame, 12, 0) - 0.5f) * 0.6f) * amp;
        float fdy = (std::sin(frame * 0.83f + hash01(frame, 13, 0) * 6.28f) * 0.7f +
                     (hash01(frame, 14, 0) - 0.5f) * 0.6f) * amp;
        std::vector<float> plane((size_t)w * h);
        for (int c = 0; c < 3; ++c) {
            for (int y = 0; y < h; ++y) {
                const float* row = rgba + (size_t)y * strideFloats;
                for (int x = 0; x < w; ++x)
                    plane[(size_t)y * w + x] = row[(size_t)x * 4 + c];
            }
            for (int y = 0; y < h; ++y) {
                float* row = rgba + (size_t)y * strideFloats;
                for (int x = 0; x < w; ++x) {
                    float v;
                    detail::bilinearSample(plane, w, h, x - fdx, y - fdy, v);
                    row[(size_t)x * 4 + c] = v;
                }
            }
        }
    }

    // film grain
    if (p.grainAmount > 0.0f) {
        float a = p.grainAmount / 100.0f * 0.14f;
        float resp = p.grainResponse / 100.0f;
        float chroma = p.grainChroma / 100.0f;
        uint32_t seed = (uint32_t)(frame * 7919 + 13);
        // grain size: sample the hash field at reduced frequency
        float freq = 1.0f / std::max(p.grainSize * px, 0.5f);
        for (int y = 0; y < h; ++y) {
            float* row = rgba + (size_t)y * strideFloats;
            uint32_t gy = (uint32_t)(y * freq);
            for (int x = 0; x < w; ++x) {
                float* q = row + (size_t)x * 4;
                uint32_t gx = (uint32_t)(x * freq);
                float lum = clampf(lumOf(q[0], q[1], q[2]), 0.0f, 1.0f);
                float weight =
                    std::pow(std::max(4.0f * lum * (1.0f - lum), 0.0f),
                             0.5f + resp);
                float nL = hashGauss(gx, gy, seed);
                for (int c = 0; c < 3; ++c) {
                    float nC = hashGauss(gx, gy, seed + 977u * (c + 1));
                    float n = nL * (1.0f - chroma) + nC * chroma;
                    q[c] += n * a * weight;
                }
            }
        }
    }

    // final clamp to display range (output stays [0,1]; 32bpc AE comps may
    // prefer unclamped — the AE glue only clamps for integer depths)
    for (int y = 0; y < h; ++y) {
        float* row = rgba + (size_t)y * strideFloats;
        for (int x = 0; x < w; ++x) {
            float* q = row + (size_t)x * 4;
            q[0] = std::max(q[0], 0.0f);
            q[1] = std::max(q[1], 0.0f);
            q[2] = std::max(q[2], 0.0f);
        }
    }
}

} // namespace cinegrade
