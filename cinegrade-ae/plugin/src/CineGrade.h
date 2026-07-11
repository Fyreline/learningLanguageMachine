// CineGrade.h — plugin identity + parameter table.

#pragma once

#define CG_NAME         "CineGrade"
#define CG_MATCH_NAME   "FYRELINE CineGrade"
#define CG_CATEGORY     "Color Correction"
#define CG_DESCRIPTION  "Filmic colour correction & grading for CS2 footage.\r" \
                        "Auto exposure shot-matching, film presets, halation, " \
                        "grain, glow. 8/16/32 bpc."

#define CG_MAJOR_VERSION   1
#define CG_MINOR_VERSION   0
#define CG_BUG_VERSION     0
#define CG_STAGE_VERSION   PF_Stage_DEVELOP
#define CG_BUILD_VERSION   1

// Parameter indices. DISK ORDER — only ever append; never reorder or
// remove, or existing projects will scramble their keyframes.
enum {
    CG_INPUT = 0,

    CG_MODE,        // Simple | Advanced
    CG_PRESET,      // popup over kPresets
    CG_STRENGTH,    // 0..100, blends preset toward neutral

    CG_TOPIC_AE_BEGIN,
    CG_AE_ENABLE,
    CG_AE_TARGET,       // EV, -3..3
    CG_AE_ADAPT,        // %
    CG_AE_HL_PROTECT,   // %
    CG_AE_MAX,          // stops 0..4
    CG_AE_SMOOTH,       // frames each side, 0..6
    CG_TOPIC_AE_END,

    // Simple mode: scale the preset's character
    CG_TOPIC_SIMPLE_BEGIN,
    CG_S_WARMTH,        // -100..100 temperature trim
    CG_S_GRAIN,         // % of preset, 0..200
    CG_S_HALATION,
    CG_S_GLOW,
    CG_S_SOFTNESS,
    CG_S_VIGNETTE,
    CG_TOPIC_SIMPLE_END,

    // Advanced: trims applied on top of the (strength-blended) preset
    CG_TOPIC_EXPOSURE_BEGIN,
    CG_EXPOSURE,        // stops
    CG_CONTRAST,
    CG_PIVOT,
    CG_SHADOWS,
    CG_HIGHLIGHTS,
    CG_WHITES,
    CG_BLACKS,
    CG_TOPIC_EXPOSURE_END,

    CG_TOPIC_WB_BEGIN,
    CG_TEMP,
    CG_TINT,
    CG_TOPIC_WB_END,

    CG_TOPIC_FILMIC_BEGIN,
    CG_FILMIC,
    CG_TOE,
    CG_SHOULDER,
    CG_WHITEPOINT,
    CG_TOPIC_FILMIC_END,

    CG_TOPIC_COLOR_BEGIN,
    CG_SAT,             // delta, -100..100
    CG_VIB,
    CG_BAND_R_SAT, CG_BAND_Y_SAT, CG_BAND_G_SAT,
    CG_BAND_C_SAT, CG_BAND_B_SAT, CG_BAND_M_SAT,
    CG_BAND_R_LUM, CG_BAND_Y_LUM, CG_BAND_G_LUM,
    CG_BAND_C_LUM, CG_BAND_B_LUM, CG_BAND_M_LUM,
    CG_TOPIC_COLOR_END,

    CG_TOPIC_LGG_BEGIN,
    CG_LIFT_R, CG_LIFT_G, CG_LIFT_B,
    CG_GAMMA_R, CG_GAMMA_G, CG_GAMMA_B,
    CG_GAIN_R, CG_GAIN_G, CG_GAIN_B,
    CG_TOPIC_LGG_END,

    CG_TOPIC_SPLIT_BEGIN,
    CG_SPLIT_SH_HUE,    // angle
    CG_SPLIT_SH_SAT,
    CG_SPLIT_HI_HUE,    // angle
    CG_SPLIT_HI_SAT,
    CG_SPLIT_BAL,
    CG_TOPIC_SPLIT_END,

    CG_TOPIC_OPTICS_BEGIN,
    CG_SOFTNESS,
    CG_GLOW_AMT, CG_GLOW_THR, CG_GLOW_RAD,
    CG_HAL_AMT, CG_HAL_THR, CG_HAL_RAD, CG_HAL_HUE,  // hue = angle
    CG_CA,
    CG_TOPIC_OPTICS_END,

    CG_TOPIC_VIG_BEGIN,
    CG_VIG_AMT, CG_VIG_SIZE, CG_VIG_FEATHER, CG_VIG_ROUND,
    CG_TOPIC_VIG_END,

    CG_TOPIC_GRAIN_BEGIN,
    CG_GRAIN_AMT, CG_GRAIN_SIZE, CG_GRAIN_CHROMA, CG_GRAIN_RESP,
    CG_GATE_WEAVE, CG_FLICKER,
    CG_TOPIC_GRAIN_END,

    CG_NUM_PARAMS
};

// Popup values
enum { CG_MODE_SIMPLE = 1, CG_MODE_ADVANCED = 2 };
