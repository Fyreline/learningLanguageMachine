// CineGrade.cpp — After Effects SmartFX glue around CineGradeKernel.h.
//
// Supports 8/16/32 bpc via SmartRender. All parameters are keyframable.
// Auto exposure computes frame statistics on the checked-out source and can
// temporally smooth the correction across neighbouring frames (extra layer
// checkouts) so cuts adapt without pumping.
//
// The pixel math lives in CineGradeKernel.h, which is regression-tested
// outside AE against reference/cinegrade.py — keep changes there.

#include "AEConfig.h"
#include "entry.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_EffectCBSuites.h"
#include "AE_Macros.h"
#include "Param_Utils.h"
#include "Smart_Utils.h"
#include "AEGP_SuiteHandler.h"

#include <cmath>
#include <cstring>
#include <new>
#include <vector>

#include "CineGrade.h"
#include "CineGradeKernel.h"
#include "PresetMap.h"

using namespace cinegrade;

namespace {

// ------------------------------------------------------------ checkout ----

constexpr int kMaxSmooth = 6;              // frames each side
constexpr int kCheckoutBase = 100;         // checkout ids for offset frames

struct PreRenderData {
    int   smoothFrames = 0;                // frames each side actually asked
};

// ------------------------------------------------------- param helpers ----

PF_Err CheckoutF(PF_InData* in_data, int idx, PF_ParamDef* def) {
    AEFX_CLR_STRUCT(*def);
    return PF_CHECKOUT_PARAM(in_data, idx, in_data->current_time,
                             in_data->time_step, in_data->time_scale, def);
}

struct ParamReader {
    PF_InData* in_data;
    PF_Err err = PF_Err_NONE;

    double F(int idx) {
        PF_ParamDef def;
        PF_Err e = CheckoutF(in_data, idx, &def);
        if (e) { err = e; return 0.0; }
        double v = def.u.fs_d.value;
        PF_CHECKIN_PARAM(in_data, &def);
        return v;
    }
    int Popup(int idx) {
        PF_ParamDef def;
        PF_Err e = CheckoutF(in_data, idx, &def);
        if (e) { err = e; return 1; }
        int v = def.u.pd.value;
        PF_CHECKIN_PARAM(in_data, &def);
        return v;
    }
    bool Bool(int idx) {
        PF_ParamDef def;
        PF_Err e = CheckoutF(in_data, idx, &def);
        if (e) { err = e; return false; }
        bool v = def.u.bd.value != 0;
        PF_CHECKIN_PARAM(in_data, &def);
        return v;
    }
    double Angle(int idx) {  // degrees
        PF_ParamDef def;
        PF_Err e = CheckoutF(in_data, idx, &def);
        if (e) { err = e; return 0.0; }
        double v = FIX_2_FLOAT(def.u.ad.value);
        PF_CHECKIN_PARAM(in_data, &def);
        return v;
    }
};

// Build effective GradeParams from preset + strength + UI trims.
GradeParams BuildParams(PF_InData* in_data, PF_Err* errOut) {
    ParamReader rd{in_data};

    const int mode = rd.Popup(CG_MODE);
    int presetIdx = rd.Popup(CG_PRESET) - 1;  // popups are 1-based
    if (presetIdx < 0 || presetIdx >= kNumPresets) presetIdx = 0;
    const float strength = (float)(rd.F(CG_STRENGTH) / 100.0);

    GradeParams p = presetToParams(kPresets[presetIdx], strength);

    if (mode == CG_MODE_SIMPLE) {
        p.temperature += (float)rd.F(CG_S_WARMTH);
        p.grainAmount *= (float)(rd.F(CG_S_GRAIN) / 100.0);
        p.halationAmount *= (float)(rd.F(CG_S_HALATION) / 100.0);
        p.glowAmount *= (float)(rd.F(CG_S_GLOW) / 100.0);
        p.softness *= (float)(rd.F(CG_S_SOFTNESS) / 100.0);
        p.vignetteAmount *= (float)(rd.F(CG_S_VIGNETTE) / 100.0);
    } else {
        // Advanced trims: deltas on top of the blended preset
        p.exposure += (float)rd.F(CG_EXPOSURE);
        p.contrast += (float)rd.F(CG_CONTRAST);
        p.pivot = (float)rd.F(CG_PIVOT);
        p.shadows += (float)rd.F(CG_SHADOWS);
        p.highlights += (float)rd.F(CG_HIGHLIGHTS);
        p.whites += (float)rd.F(CG_WHITES);
        p.blacks += (float)rd.F(CG_BLACKS);
        p.temperature += (float)rd.F(CG_TEMP);
        p.tint += (float)rd.F(CG_TINT);
        p.filmicAmount = clampf(p.filmicAmount + (float)rd.F(CG_FILMIC), 0, 100);
        p.toe = clampf(p.toe + (float)rd.F(CG_TOE), 0, 100);
        p.shoulder = clampf(p.shoulder + (float)rd.F(CG_SHOULDER), 0, 100);
        p.whitePoint = clampf(p.whitePoint + (float)rd.F(CG_WHITEPOINT), 1, 4);
        p.saturation = clampf(p.saturation + (float)rd.F(CG_SAT), 0, 200);
        p.vibrance = clampf(p.vibrance + (float)rd.F(CG_VIB), -100, 100);
        static const int bandSatIdx[6] = {CG_BAND_R_SAT, CG_BAND_Y_SAT,
            CG_BAND_G_SAT, CG_BAND_C_SAT, CG_BAND_B_SAT, CG_BAND_M_SAT};
        static const int bandLumIdx[6] = {CG_BAND_R_LUM, CG_BAND_Y_LUM,
            CG_BAND_G_LUM, CG_BAND_C_LUM, CG_BAND_B_LUM, CG_BAND_M_LUM};
        for (int i = 0; i < 6; ++i) {
            p.bandSat[i] += (float)rd.F(bandSatIdx[i]);
            p.bandLum[i] += (float)rd.F(bandLumIdx[i]);
        }
        static const int liftIdx[3] = {CG_LIFT_R, CG_LIFT_G, CG_LIFT_B};
        static const int gammaIdx[3] = {CG_GAMMA_R, CG_GAMMA_G, CG_GAMMA_B};
        static const int gainIdx[3] = {CG_GAIN_R, CG_GAIN_G, CG_GAIN_B};
        for (int i = 0; i < 3; ++i) {
            p.lift[i] += (float)rd.F(liftIdx[i]);
            p.gamma[i] *= (float)rd.F(gammaIdx[i]);
            p.gain[i] *= (float)rd.F(gainIdx[i]);
        }
        double shSat = rd.F(CG_SPLIT_SH_SAT), hiSat = rd.F(CG_SPLIT_HI_SAT);
        if (shSat > 0.0) {  // engaging the trim overrides the preset tint
            p.splitShadowHue = (float)rd.Angle(CG_SPLIT_SH_HUE);
            p.splitShadowSat = (float)shSat;
        }
        if (hiSat > 0.0) {
            p.splitHighlightHue = (float)rd.Angle(CG_SPLIT_HI_HUE);
            p.splitHighlightSat = (float)hiSat;
        }
        p.splitBalance = clampf(p.splitBalance + (float)rd.F(CG_SPLIT_BAL),
                                -100, 100);
        p.softness = clampf(p.softness + (float)rd.F(CG_SOFTNESS), 0, 100);
        p.glowAmount = clampf(p.glowAmount + (float)rd.F(CG_GLOW_AMT), 0, 100);
        p.glowThreshold = clampf(p.glowThreshold + (float)rd.F(CG_GLOW_THR), 0, 100);
        p.glowRadius = clampf(p.glowRadius + (float)rd.F(CG_GLOW_RAD), 0, 300);
        p.halationAmount = clampf(p.halationAmount + (float)rd.F(CG_HAL_AMT), 0, 100);
        p.halationThreshold = clampf(p.halationThreshold + (float)rd.F(CG_HAL_THR), 0, 100);
        p.halationRadius = clampf(p.halationRadius + (float)rd.F(CG_HAL_RAD), 0, 300);
        if (rd.F(CG_HAL_AMT) != 0.0)
            p.halationHue = (float)rd.Angle(CG_HAL_HUE);
        p.caAmount = clampf(p.caAmount + (float)rd.F(CG_CA), 0, 100);
        p.vignetteAmount = clampf(p.vignetteAmount + (float)rd.F(CG_VIG_AMT), -100, 100);
        p.vignetteSize = clampf(p.vignetteSize + (float)rd.F(CG_VIG_SIZE), 0, 150);
        p.vignetteFeather = clampf(p.vignetteFeather + (float)rd.F(CG_VIG_FEATHER), 1, 100);
        p.vignetteRoundness = clampf(p.vignetteRoundness + (float)rd.F(CG_VIG_ROUND), 0, 100);
        p.grainAmount = clampf(p.grainAmount + (float)rd.F(CG_GRAIN_AMT), 0, 100);
        p.grainSize = clampf(p.grainSize + (float)rd.F(CG_GRAIN_SIZE), 0.3f, 3.0f);
        p.grainChroma = clampf(p.grainChroma + (float)rd.F(CG_GRAIN_CHROMA), 0, 100);
        p.grainResponse = clampf(p.grainResponse + (float)rd.F(CG_GRAIN_RESP), 0, 100);
        p.gateWeave = clampf(p.gateWeave + (float)rd.F(CG_GATE_WEAVE), 0, 100);
        p.flicker = clampf(p.flicker + (float)rd.F(CG_FLICKER), 0, 100);
    }
    if (errOut) *errOut = rd.err;
    return p;
}

AutoExposure BuildAE(PF_InData* in_data, PF_Err* errOut, int* smoothOut) {
    ParamReader rd{in_data};
    AutoExposure ae;
    ae.enabled = rd.Bool(CG_AE_ENABLE);
    ae.targetEv = (float)rd.F(CG_AE_TARGET);
    ae.adapt = (float)(rd.F(CG_AE_ADAPT) / 100.0);
    ae.highlightProtect = (float)(rd.F(CG_AE_HL_PROTECT) / 100.0);
    ae.maxStops = (float)rd.F(CG_AE_MAX);
    int smooth = (int)(rd.F(CG_AE_SMOOTH) + 0.5);
    if (smooth < 0) smooth = 0;
    if (smooth > kMaxSmooth) smooth = kMaxSmooth;
    if (smoothOut) *smoothOut = ae.enabled ? smooth : 0;
    if (errOut) *errOut = rd.err;
    return ae;
}

// -------------------------------------------------------- world <-> f32 ---

PF_Err WorldToFloat(PF_InData* in_data, PF_EffectWorld* world,
                    std::vector<float>& out, int w, int h) {
    AEGP_SuiteHandler suites(in_data->pica_basicP);
    PF_PixelFormat fmt = PF_PixelFormat_INVALID;
    PF_Err err = suites.PFWorldSuite2()->PF_GetPixelFormat(world, &fmt);
    if (err) return err;

    const int cw = MIN(w, world->width);
    const int ch = MIN(h, world->height);
    switch (fmt) {
        case PF_PixelFormat_ARGB32:
            for (int y = 0; y < ch; ++y) {
                const PF_Pixel8* row = (const PF_Pixel8*)
                    ((const char*)world->data + (size_t)y * world->rowbytes);
                float* dst = &out[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    dst[x * 4 + 0] = row[x].red / 255.0f;
                    dst[x * 4 + 1] = row[x].green / 255.0f;
                    dst[x * 4 + 2] = row[x].blue / 255.0f;
                    dst[x * 4 + 3] = row[x].alpha / 255.0f;
                }
            }
            break;
        case PF_PixelFormat_ARGB64:
            for (int y = 0; y < ch; ++y) {
                const PF_Pixel16* row = (const PF_Pixel16*)
                    ((const char*)world->data + (size_t)y * world->rowbytes);
                float* dst = &out[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    dst[x * 4 + 0] = row[x].red / 32768.0f;
                    dst[x * 4 + 1] = row[x].green / 32768.0f;
                    dst[x * 4 + 2] = row[x].blue / 32768.0f;
                    dst[x * 4 + 3] = row[x].alpha / 32768.0f;
                }
            }
            break;
        case PF_PixelFormat_ARGB128:
            for (int y = 0; y < ch; ++y) {
                const PF_PixelFloat* row = (const PF_PixelFloat*)
                    ((const char*)world->data + (size_t)y * world->rowbytes);
                float* dst = &out[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    dst[x * 4 + 0] = row[x].red;
                    dst[x * 4 + 1] = row[x].green;
                    dst[x * 4 + 2] = row[x].blue;
                    dst[x * 4 + 3] = row[x].alpha;
                }
            }
            break;
        default:
            return PF_Err_BAD_CALLBACK_PARAM;
    }
    return PF_Err_NONE;
}

PF_Err FloatToWorld(PF_InData* in_data, const std::vector<float>& src,
                    PF_EffectWorld* world, int w, int h) {
    AEGP_SuiteHandler suites(in_data->pica_basicP);
    PF_PixelFormat fmt = PF_PixelFormat_INVALID;
    PF_Err err = suites.PFWorldSuite2()->PF_GetPixelFormat(world, &fmt);
    if (err) return err;

    const int cw = MIN(w, world->width);
    const int ch = MIN(h, world->height);
    auto to8 = [](float v) -> A_u_char {
        v = clampf(v, 0.0f, 1.0f);
        return (A_u_char)(v * 255.0f + 0.5f);
    };
    auto to16 = [](float v) -> A_u_short {
        v = clampf(v, 0.0f, 1.0f);
        return (A_u_short)(v * 32768.0f + 0.5f);
    };
    switch (fmt) {
        case PF_PixelFormat_ARGB32:
            for (int y = 0; y < ch; ++y) {
                PF_Pixel8* row = (PF_Pixel8*)
                    ((char*)world->data + (size_t)y * world->rowbytes);
                const float* s = &src[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    row[x].red = to8(s[x * 4 + 0]);
                    row[x].green = to8(s[x * 4 + 1]);
                    row[x].blue = to8(s[x * 4 + 2]);
                    row[x].alpha = to8(s[x * 4 + 3]);
                }
            }
            break;
        case PF_PixelFormat_ARGB64:
            for (int y = 0; y < ch; ++y) {
                PF_Pixel16* row = (PF_Pixel16*)
                    ((char*)world->data + (size_t)y * world->rowbytes);
                const float* s = &src[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    row[x].red = to16(s[x * 4 + 0]);
                    row[x].green = to16(s[x * 4 + 1]);
                    row[x].blue = to16(s[x * 4 + 2]);
                    row[x].alpha = to16(s[x * 4 + 3]);
                }
            }
            break;
        case PF_PixelFormat_ARGB128:
            for (int y = 0; y < ch; ++y) {
                PF_PixelFloat* row = (PF_PixelFloat*)
                    ((char*)world->data + (size_t)y * world->rowbytes);
                const float* s = &src[(size_t)y * w * 4];
                for (int x = 0; x < cw; ++x) {
                    row[x].red = s[x * 4 + 0];
                    row[x].green = s[x * 4 + 1];
                    row[x].blue = s[x * 4 + 2];
                    row[x].alpha = s[x * 4 + 3];
                }
            }
            break;
        default:
            return PF_Err_BAD_CALLBACK_PARAM;
    }
    return PF_Err_NONE;
}

// AE stats for one checked-out world (skips empty/transparent worlds).
bool StatsForWorld(PF_InData* in_data, PF_EffectWorld* world,
                   const AutoExposure& ae, float* stopsOut) {
    if (!world || world->width < 4 || world->height < 4) return false;
    const int w = world->width, h = world->height;
    std::vector<float> buf;
    try {
        buf.assign((size_t)w * h * 4, 0.0f);
    } catch (const std::bad_alloc&) {
        return false;
    }
    if (WorldToFloat(in_data, world, buf, w, h) != PF_Err_NONE) return false;
    // skip frames that are essentially transparent (beyond layer bounds)
    double alphaSum = 0.0;
    for (int y = 0; y < h; y += 8)
        for (int x = 0; x < w; x += 8)
            alphaSum += buf[((size_t)y * w + x) * 4 + 3];
    if (alphaSum / (((h + 7) / 8) * (double)((w + 7) / 8)) < 0.05) return false;
    *stopsOut = computeAutoExposureStops(buf.data(), w, h, (size_t)w * 4, ae);
    return true;
}

// ----------------------------------------------------------- commands -----

PF_Err About(PF_InData* in_data, PF_OutData* out_data) {
    AEGP_SuiteHandler suites(in_data->pica_basicP);
    suites.ANSICallbacksSuite1()->sprintf(
        out_data->return_msg, "%s v%d.%d\r%s", CG_NAME, CG_MAJOR_VERSION,
        CG_MINOR_VERSION,
        "Filmic colour grading for CS2 footage. Presets, auto exposure, "
        "halation, grain, glow. All parameters keyframable.");
    return PF_Err_NONE;
}

PF_Err GlobalSetup(PF_InData* in_data, PF_OutData* out_data) {
    out_data->my_version = PF_VERSION(CG_MAJOR_VERSION, CG_MINOR_VERSION,
                                      CG_BUG_VERSION, CG_STAGE_VERSION,
                                      CG_BUILD_VERSION);
    out_data->out_flags = PF_OutFlag_DEEP_COLOR_AWARE |
                          PF_OutFlag_PIX_INDEPENDENT |
                          PF_OutFlag_NON_PARAM_VARY |
                          PF_OutFlag_WIDE_TIME_INPUT |
                          PF_OutFlag_SEND_UPDATE_PARAMS_UI;
    out_data->out_flags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                           PF_OutFlag2_FLOAT_COLOR_AWARE |
                           PF_OutFlag2_PARAM_GROUP_START_COLLAPSED_FLAG |
                           PF_OutFlag2_SUPPORTS_THREADED_RENDERING |
                           PF_OutFlag2_AUTOMATIC_WIDE_TIME_INPUT;
    return PF_Err_NONE;
}

PF_Err ParamsSetup(PF_InData* in_data, PF_OutData* out_data) {
    PF_Err err = PF_Err_NONE;
    PF_ParamDef def;

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Mode", 2, CG_MODE_SIMPLE, "Simple|Advanced", CG_MODE);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Film Preset", kNumPresets, 2, kPresetPopupString, CG_PRESET);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Strength", 0, 100, 0, 100, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_STRENGTH);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Auto Exposure", CG_TOPIC_AE_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_CHECKBOXX("Enable (match shots)", FALSE, 0, CG_AE_ENABLE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Target (EV)", -3, 3, -3, 3, 0, 2, 0, 0, CG_AE_TARGET);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Adaptation", 0, 100, 0, 100, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_AE_ADAPT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Highlight Protection", 0, 100, 0, 100, 35, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_AE_HL_PROTECT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Max Correction (stops)", 0, 4, 0, 4, 4, 2, 0, 0,
                         CG_AE_MAX);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Temporal Smoothing (frames)", 0, kMaxSmooth, 0,
                         kMaxSmooth, 2, 0, 0, 0, CG_AE_SMOOTH);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_AE_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Simple Controls", CG_TOPIC_SIMPLE_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Warmth", -100, 100, -100, 100, 0, 1, 0, 0, CG_S_WARMTH);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Grain", 0, 200, 0, 200, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_S_GRAIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Halation", 0, 200, 0, 200, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_S_HALATION);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Glow", 0, 200, 0, 200, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_S_GLOW);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Softness", 0, 200, 0, 200, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_S_SOFTNESS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vignette", 0, 200, 0, 200, 100, 1,
                         PF_ValueDisplayFlag_PERCENT, 0, CG_S_VIGNETTE);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_SIMPLE_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Exposure & Tone (Advanced)", CG_TOPIC_EXPOSURE_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Exposure (stops)", -4, 4, -4, 4, 0, 2, 0, 0, CG_EXPOSURE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Contrast", -100, 100, -100, 100, 0, 1, 0, 0, CG_CONTRAST);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Contrast Pivot", 0.05, 0.5, 0.05, 0.5, 0.18, 3, 0, 0, CG_PIVOT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Shadows", -100, 100, -100, 100, 0, 1, 0, 0, CG_SHADOWS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Highlights", -100, 100, -100, 100, 0, 1, 0, 0, CG_HIGHLIGHTS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Whites", -100, 100, -100, 100, 0, 1, 0, 0, CG_WHITES);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Blacks", -100, 100, -100, 100, 0, 1, 0, 0, CG_BLACKS);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_EXPOSURE_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("White Balance (Advanced)", CG_TOPIC_WB_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Temperature", -100, 100, -100, 100, 0, 1, 0, 0, CG_TEMP);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Tint", -100, 100, -100, 100, 0, 1, 0, 0, CG_TINT);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_WB_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Filmic Curve (Advanced)", CG_TOPIC_FILMIC_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Curve Amount", -100, 100, -100, 100, 0, 1, 0, 0, CG_FILMIC);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Toe", -100, 100, -100, 100, 0, 1, 0, 0, CG_TOE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Shoulder", -100, 100, -100, 100, 0, 1, 0, 0, CG_SHOULDER);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("White Point", -1, 3, -1, 3, 0, 2, 0, 0, CG_WHITEPOINT);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_FILMIC_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Colour (Advanced)", CG_TOPIC_COLOR_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Saturation", -100, 100, -100, 100, 0, 1, 0, 0, CG_SAT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vibrance", -100, 100, -100, 100, 0, 1, 0, 0, CG_VIB);
    static const char* bandSatNames[6] = {
        "Reds Sat", "Yellows Sat", "Greens Sat",
        "Cyans Sat", "Blues Sat", "Magentas Sat"};
    static const char* bandLumNames[6] = {
        "Reds Lum", "Yellows Lum", "Greens Lum",
        "Cyans Lum", "Blues Lum", "Magentas Lum"};
    for (int i = 0; i < 6; ++i) {
        AEFX_CLR_STRUCT(def);
        PF_ADD_FLOAT_SLIDERX(bandSatNames[i], -100, 100, -100, 100, 0, 1, 0,
                             0, CG_BAND_R_SAT + i);
    }
    for (int i = 0; i < 6; ++i) {
        AEFX_CLR_STRUCT(def);
        PF_ADD_FLOAT_SLIDERX(bandLumNames[i], -100, 100, -100, 100, 0, 1, 0,
                             0, CG_BAND_R_LUM + i);
    }
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_COLOR_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Lift Gamma Gain (Advanced)", CG_TOPIC_LGG_BEGIN);
    static const char* lggNames[9] = {
        "Lift R", "Lift G", "Lift B",
        "Gamma R", "Gamma G", "Gamma B",
        "Gain R", "Gain G", "Gain B"};
    for (int i = 0; i < 3; ++i) {
        AEFX_CLR_STRUCT(def);
        PF_ADD_FLOAT_SLIDERX(lggNames[i], -0.25, 0.25, -0.25, 0.25, 0, 3, 0,
                             0, CG_LIFT_R + i);
    }
    for (int i = 0; i < 3; ++i) {
        AEFX_CLR_STRUCT(def);
        PF_ADD_FLOAT_SLIDERX(lggNames[3 + i], 0.5, 2, 0.5, 2, 1, 3, 0, 0,
                             CG_GAMMA_R + i);
    }
    for (int i = 0; i < 3; ++i) {
        AEFX_CLR_STRUCT(def);
        PF_ADD_FLOAT_SLIDERX(lggNames[6 + i], 0, 2, 0, 2, 1, 3, 0, 0,
                             CG_GAIN_R + i);
    }
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_LGG_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Split Toning (Advanced)", CG_TOPIC_SPLIT_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_ANGLE("Shadow Hue", 220, CG_SPLIT_SH_HUE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Shadow Tint", 0, 100, 0, 100, 0, 1, 0, 0, CG_SPLIT_SH_SAT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_ANGLE("Highlight Hue", 45, CG_SPLIT_HI_HUE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Highlight Tint", 0, 100, 0, 100, 0, 1, 0, 0, CG_SPLIT_HI_SAT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Balance", -100, 100, -100, 100, 0, 1, 0, 0, CG_SPLIT_BAL);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_SPLIT_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Optics & Diffusion (Advanced)", CG_TOPIC_OPTICS_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Diffusion (Softness)", -100, 100, -100, 100, 0, 1, 0, 0, CG_SOFTNESS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Glow Amount", -100, 100, -100, 100, 0, 1, 0, 0, CG_GLOW_AMT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Glow Threshold", -100, 100, -100, 100, 0, 1, 0, 0, CG_GLOW_THR);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Glow Radius", -100, 100, -100, 100, 0, 1, 0, 0, CG_GLOW_RAD);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Halation Amount", -100, 100, -100, 100, 0, 1, 0, 0, CG_HAL_AMT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Halation Threshold", -100, 100, -100, 100, 0, 1, 0, 0, CG_HAL_THR);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Halation Radius", -100, 100, -100, 100, 0, 1, 0, 0, CG_HAL_RAD);
    AEFX_CLR_STRUCT(def);
    PF_ADD_ANGLE("Halation Hue", 20, CG_HAL_HUE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Chromatic Aberration", -100, 100, -100, 100, 0, 1, 0, 0, CG_CA);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_OPTICS_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Vignette (Advanced)", CG_TOPIC_VIG_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vignette Amount", -100, 100, -100, 100, 0, 1, 0, 0, CG_VIG_AMT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vignette Size", -100, 100, -100, 100, 0, 1, 0, 0, CG_VIG_SIZE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vignette Feather", -100, 100, -100, 100, 0, 1, 0, 0, CG_VIG_FEATHER);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Vignette Roundness", -100, 100, -100, 100, 0, 1, 0, 0, CG_VIG_ROUND);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_VIG_END);

    AEFX_CLR_STRUCT(def);
    PF_ADD_TOPIC("Grain & Movement (Advanced)", CG_TOPIC_GRAIN_BEGIN);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Grain Amount", -100, 100, -100, 100, 0, 1, 0, 0, CG_GRAIN_AMT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Grain Size", -1, 2, -1, 2, 0, 2, 0, 0, CG_GRAIN_SIZE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Grain Chroma", -100, 100, -100, 100, 0, 1, 0, 0, CG_GRAIN_CHROMA);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Grain Response", -100, 100, -100, 100, 0, 1, 0, 0, CG_GRAIN_RESP);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Gate Weave", -100, 100, -100, 100, 0, 1, 0, 0, CG_GATE_WEAVE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Flicker", -100, 100, -100, 100, 0, 1, 0, 0, CG_FLICKER);
    AEFX_CLR_STRUCT(def);
    PF_END_TOPIC(CG_TOPIC_GRAIN_END);

    out_data->num_params = CG_NUM_PARAMS;
    return err;
}

// Grey out whichever group the current mode ignores.
PF_Err UpdateParamsUI(PF_InData* in_data, PF_OutData* out_data,
                      PF_ParamDef* params[]) {
    PF_Err err = PF_Err_NONE;
    AEGP_SuiteHandler suites(in_data->pica_basicP);
    const bool simple = params[CG_MODE]->u.pd.value == CG_MODE_SIMPLE;

    auto setEnabled = [&](int idx, bool enabled) {
        PF_ParamDef def = *params[idx];
        A_long flags = def.ui_flags;
        if (enabled) flags &= ~PF_PUI_DISABLED;
        else flags |= PF_PUI_DISABLED;
        if (flags != def.ui_flags) {
            def.ui_flags = flags;
            suites.ParamUtilsSuite3()->PF_UpdateParamUI(in_data->effect_ref,
                                                        idx, &def);
        }
    };
    for (int i = CG_TOPIC_SIMPLE_BEGIN; i <= CG_TOPIC_SIMPLE_END; ++i)
        setEnabled(i, simple);
    for (int i = CG_TOPIC_EXPOSURE_BEGIN; i <= CG_TOPIC_GRAIN_END; ++i)
        setEnabled(i, !simple);
    return err;
}

PF_Err PreRender(PF_InData* in_data, PF_OutData* out_data,
                 PF_PreRenderExtra* extra) {
    PF_Err err = PF_Err_NONE;

    int smooth = 0;
    AutoExposure ae = BuildAE(in_data, &err, &smooth);
    (void)ae;
    if (err) return err;

    PreRenderData* prd = new (std::nothrow) PreRenderData();
    if (!prd) return PF_Err_OUT_OF_MEMORY;
    prd->smoothFrames = smooth;
    extra->output->pre_render_data = prd;
    extra->output->delete_pre_render_data_func = [](void* d) {
        delete static_cast<PreRenderData*>(d);
    };

    // Always request the full frame: auto exposure needs whole-frame
    // statistics, and vignette/grain/optics are full-frame anyway.
    PF_RenderRequest req = extra->input->output_request;
    PF_Rect full;
    full.left = 0;
    full.top = 0;
    full.right = (A_long)(in_data->width *
        ((double)in_data->downsample_x.num / in_data->downsample_x.den) + 0.5);
    full.bottom = (A_long)(in_data->height *
        ((double)in_data->downsample_y.num / in_data->downsample_y.den) + 0.5);
    req.rect = full;
    req.preserve_rgb_of_zero_alpha = TRUE;

    PF_CheckoutResult inResult;
    ERR(extra->cb->checkout_layer(in_data->effect_ref, CG_INPUT, CG_INPUT,
                                  &req, in_data->current_time,
                                  in_data->time_step, in_data->time_scale,
                                  &inResult));
    if (!err) {
        extra->output->result_rect = inResult.result_rect;
        extra->output->max_result_rect = inResult.max_result_rect;
        extra->output->solid = FALSE;
    }

    // extra checkouts for temporal smoothing of auto exposure
    for (int i = 1; i <= smooth && !err; ++i) {
        for (int sign = -1; sign <= 1 && !err; sign += 2) {
            A_long t = in_data->current_time + sign * i * in_data->time_step;
            if (t < 0) continue;
            PF_CheckoutResult r;
            ERR(extra->cb->checkout_layer(in_data->effect_ref, CG_INPUT,
                                          kCheckoutBase + i * 2 + (sign > 0),
                                          &req, t, in_data->time_step,
                                          in_data->time_scale, &r));
        }
    }
    return err;
}

PF_Err SmartRender(PF_InData* in_data, PF_OutData* out_data,
                   PF_SmartRenderExtra* extra) {
    PF_Err err = PF_Err_NONE, err2 = PF_Err_NONE;

    const PreRenderData* prd =
        static_cast<const PreRenderData*>(extra->input->pre_render_data);
    const int smooth = prd ? prd->smoothFrames : 0;

    PF_EffectWorld* inputW = nullptr;
    PF_EffectWorld* outputW = nullptr;
    ERR(extra->cb->checkout_layer_pixels(in_data->effect_ref, CG_INPUT,
                                         &inputW));
    ERR(extra->cb->checkout_output(in_data->effect_ref, &outputW));
    if (err || !inputW || !outputW) return err ? err : PF_Err_BAD_CALLBACK_PARAM;

    GradeParams p = BuildParams(in_data, &err);
    int unusedSmooth = 0;
    AutoExposure ae = BuildAE(in_data, &err2, &unusedSmooth);
    if (err) return err;
    if (err2) return err2;

    const int w = outputW->width, h = outputW->height;
    std::vector<float> buf;
    try {
        buf.assign((size_t)w * h * 4, 0.0f);
    } catch (const std::bad_alloc&) {
        return PF_Err_OUT_OF_MEMORY;
    }
    ERR(WorldToFloat(in_data, inputW, buf, w, h));
    if (err) return err;

    // ---- auto exposure (optionally smoothed across neighbour frames) ----
    float aeStops = 0.0f;
    if (ae.enabled) {
        float centre = computeAutoExposureStops(buf.data(), w, h,
                                                (size_t)w * 4, ae);
        double sum = centre * (double)(smooth + 1);
        double wsum = (double)(smooth + 1);
        for (int i = 1; i <= smooth; ++i) {
            for (int sign = -1; sign <= 1; sign += 2) {
                A_long t = in_data->current_time +
                           sign * i * in_data->time_step;
                if (t < 0) continue;
                PF_EffectWorld* nw = nullptr;
                if (extra->cb->checkout_layer_pixels(
                        in_data->effect_ref,
                        kCheckoutBase + i * 2 + (sign > 0), &nw) ==
                        PF_Err_NONE && nw) {
                    float s = 0.0f;
                    if (StatsForWorld(in_data, nw, ae, &s)) {
                        double wgt = (double)(smooth + 1 - i);
                        sum += s * wgt;
                        wsum += wgt;
                    }
                    extra->cb->checkin_layer_pixels(
                        in_data->effect_ref,
                        kCheckoutBase + i * 2 + (sign > 0));
                }
            }
        }
        aeStops = (float)(sum / wsum);
    }

    // ---- frame index for grain / weave / flicker ----
    const int frame = in_data->time_step > 0
        ? (int)(in_data->current_time / in_data->time_step) : 0;

    gradeFrame(buf.data(), w, h, (size_t)w * 4, p, frame, aeStops);

    ERR(FloatToWorld(in_data, buf, outputW, w, h));
    return err;
}

} // namespace

// -------------------------------------------------------------- entry -----

extern "C" DllExport PF_Err EffectMain(PF_Cmd cmd, PF_InData* in_data,
                                       PF_OutData* out_data,
                                       PF_ParamDef* params[],
                                       PF_LayerDef* output, void* extra) {
    PF_Err err = PF_Err_NONE;
    try {
        switch (cmd) {
            case PF_Cmd_ABOUT:
                err = About(in_data, out_data);
                break;
            case PF_Cmd_GLOBAL_SETUP:
                err = GlobalSetup(in_data, out_data);
                break;
            case PF_Cmd_PARAMS_SETUP:
                err = ParamsSetup(in_data, out_data);
                break;
            case PF_Cmd_UPDATE_PARAMS_UI:
            case PF_Cmd_USER_CHANGED_PARAM:
                err = UpdateParamsUI(in_data, out_data, params);
                break;
            case PF_Cmd_SMART_PRE_RENDER:
                err = PreRender(in_data, out_data,
                                (PF_PreRenderExtra*)extra);
                break;
            case PF_Cmd_SMART_RENDER:
                err = SmartRender(in_data, out_data,
                                  (PF_SmartRenderExtra*)extra);
                break;
            default:
                break;
        }
    } catch (const PF_Err& thrown) {
        err = thrown;
    } catch (...) {
        err = PF_Err_INTERNAL_STRUCT_DAMAGED;
    }
    return err;
}

extern "C" DllExport PF_Err PluginDataEntryFunction2(
    PF_PluginDataPtr inPtr, PF_PluginDataCB2 inPluginDataCallBackPtr,
    SPBasicSuite* inSPBasicSuitePtr, const char* inHostName,
    const char* inHostVersion) {
    PF_Err result = PF_Err_INVALID_CALLBACK;
    result = PF_REGISTER_EFFECT_EXT2(
        inPtr, inPluginDataCallBackPtr,
        CG_NAME,                 // name
        CG_MATCH_NAME,           // match name
        CG_CATEGORY,             // category
        AE_RESERVED_INFO,        // reserved
        "EffectMain",            // entry point
        "https://github.com/Fyreline");  // support url
    return result;
}
