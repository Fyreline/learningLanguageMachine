/*  CineGrade_PiPL.r — plugin property list.

    IMPORTANT: AE_Effect_Global_OutFlags / OutFlags_2 below MUST equal the
    values set in GlobalSetup() (CineGrade.cpp) or After Effects will log a
    PiPL mismatch and may refuse to load the effect. After changing flags in
    either place, run:

        python3 tools/check_pipl_flags.py --sdk "$AE_SDK_ROOT"

    which parses AE_Effect.h from your SDK, recomputes both literals from
    the flag names listed in CineGrade.cpp, and rewrites this file if needed.

    OutFlags  = PF_OutFlag_DEEP_COLOR_AWARE | PF_OutFlag_PIX_INDEPENDENT |
                PF_OutFlag_NON_PARAM_VARY | PF_OutFlag_WIDE_TIME_INPUT |
                PF_OutFlag_SEND_UPDATE_PARAMS_UI
    OutFlags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                PF_OutFlag2_FLOAT_COLOR_AWARE |
                PF_OutFlag2_PARAM_GROUP_START_COLLAPSED_FLAG |
                PF_OutFlag2_SUPPORTS_THREADED_RENDERING |
                PF_OutFlag2_AUTOMATIC_WIDE_TIME_INPUT
*/

#include "AEConfig.h"
#include "AE_EffectVers.h"

#ifndef AE_OS_WIN
    #include <AE_General.r>
#endif

resource 'PiPL' (16000) {
    {
        Kind { AEEffect },
        Name { "CineGrade" },
        Category { "Color Correction" },

#ifdef AE_OS_WIN
    #ifdef AE_PROC_INTELx64
        CodeWin64X86 { "EffectMain" },
    #endif
#else
    #ifdef AE_OS_MAC
        CodeMacIntel64 { "EffectMain" },
        CodeMacARM64 { "EffectMain" },
    #endif
#endif

        AE_PiPL_Version { 2, 0 },
        AE_Effect_Spec_Version { PF_PLUG_IN_VERSION, PF_PLUG_IN_SUBVERS },
        AE_Effect_Version { 524289 },  /* PF_VERSION(1,0,0,DEVELOP,1) */
        AE_Effect_Info_Flags { 0 },
        AE_Effect_Global_OutFlags { 0x00600406 },
        AE_Effect_Global_OutFlags_2 { 0x08021408 },
        AE_Effect_Match_Name { "FYRELINE CineGrade" },
        AE_Reserved_Info { 8 },
        AE_Effect_Support_URL { "https://github.com/Fyreline" }
    }
};
