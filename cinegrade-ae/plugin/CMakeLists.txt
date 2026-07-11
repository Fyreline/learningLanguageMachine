# CineGrade — After Effects plugin build.
#
#   cmake -B build -DAE_SDK_ROOT="C:/path/to/AfterEffectsSDK" \
#         -G "Visual Studio 16 2019" -A x64          (Windows, AE 2021+)
#   cmake -B build -DAE_SDK_ROOT=~/AfterEffectsSDK -G Xcode   (macOS)
#   cmake --build build --config Release
#
# Output: CineGrade.aex (Windows) / CineGrade.plugin (macOS).
# See docs/BUILDING.md for the full walkthrough, including the AE 2021
# (SDK "March 2021") notes.

cmake_minimum_required(VERSION 3.20)
project(CineGrade CXX)

set(AE_SDK_ROOT "" CACHE PATH "Path to the Adobe After Effects SDK")
if(NOT AE_SDK_ROOT)
    if(DEFINED ENV{AE_SDK_ROOT})
        set(AE_SDK_ROOT "$ENV{AE_SDK_ROOT}")
    else()
        message(FATAL_ERROR
            "Set -DAE_SDK_ROOT=/path/to/AfterEffectsSDK (folder containing "
            "Examples/Headers/...). Download the SDK from "
            "https://developer.adobe.com/after-effects/")
    endif()
endif()

set(AE_HEADERS "${AE_SDK_ROOT}/Examples/Headers")
set(AE_UTIL    "${AE_SDK_ROOT}/Examples/Util")
set(AE_RSRC    "${AE_SDK_ROOT}/Examples/Resources")
if(NOT EXISTS "${AE_HEADERS}/AE_Effect.h")
    message(FATAL_ERROR "AE_Effect.h not found under ${AE_HEADERS} — is "
                        "AE_SDK_ROOT correct?")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SRC
    src/CineGrade.cpp
    "${AE_UTIL}/AEGP_SuiteHandler.cpp"
    "${AE_UTIL}/MissingSuiteError.cpp"
)

include_directories(
    src
    "${AE_HEADERS}"
    "${AE_HEADERS}/SP"
    "${AE_UTIL}"
    "${AE_RSRC}"
)

# ---------------------------------------------------------------- PiPL ----
set(PIPL_R "${CMAKE_CURRENT_SOURCE_DIR}/src/CineGrade_PiPL.r")

if(WIN32)
    # Standard AE SDK Windows PiPL pipeline:
    #   .r --(cl /EP)--> .rr --(PiPLtool)--> .rrc --(cl /EP)--> .rc
    set(PIPLTOOL "${AE_RSRC}/PiPLtool.exe")
    set(PIPL_RR  "${CMAKE_CURRENT_BINARY_DIR}/CineGrade_PiPL.rr")
    set(PIPL_RRC "${CMAKE_CURRENT_BINARY_DIR}/CineGrade_PiPL.rrc")
    set(PIPL_RC  "${CMAKE_CURRENT_BINARY_DIR}/CineGrade_PiPL.rc")
    add_custom_command(
        OUTPUT "${PIPL_RC}"
        COMMAND cl /I "${AE_HEADERS}" /I "${AE_RSRC}" /EP /DAE_OS_WIN
                /DAE_PROC_INTELx64 "${PIPL_R}" > "${PIPL_RR}"
        COMMAND "${PIPLTOOL}" "${PIPL_RR}" "${PIPL_RRC}"
        COMMAND cl /D "MSWindows" /EP "${PIPL_RRC}" > "${PIPL_RC}"
        DEPENDS "${PIPL_R}"
        COMMENT "Compiling PiPL resource"
        VERBATIM
    )
    list(APPEND SRC "${PIPL_RC}")

    add_library(CineGrade MODULE ${SRC})
    target_compile_definitions(CineGrade PRIVATE
        _CRT_SECURE_NO_WARNINGS AE_OS_WIN)
    set_target_properties(CineGrade PROPERTIES SUFFIX ".aex")

elseif(APPLE)
    add_library(CineGrade MODULE ${SRC})
    target_compile_definitions(CineGrade PRIVATE AE_OS_MAC)
    set_target_properties(CineGrade PROPERTIES
        BUNDLE TRUE
        BUNDLE_EXTENSION "plugin"
        MACOSX_BUNDLE_BUNDLE_NAME "CineGrade"
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.fyreline.cinegrade")
    # Rez the PiPL into the bundle's resource fork location AE expects
    find_program(REZ Rez PATHS
        /Applications/Xcode.app/Contents/Developer/usr/bin)
    if(NOT REZ)
        message(FATAL_ERROR "Rez not found — install Xcode command line tools")
    endif()
    set(PIPL_RSRC "${CMAKE_CURRENT_BINARY_DIR}/CineGrade.rsrc")
    add_custom_command(
        OUTPUT "${PIPL_RSRC}"
        COMMAND "${REZ}" -o "${PIPL_RSRC}" -useDF
                -i "${AE_HEADERS}" -i "${AE_RSRC}" -i "${AE_UTIL}"
                -D AE_OS_MAC "${PIPL_R}"
        DEPENDS "${PIPL_R}"
        COMMENT "Rezzing PiPL resource"
        VERBATIM
    )
    add_custom_target(CineGradePiPL DEPENDS "${PIPL_RSRC}")
    add_dependencies(CineGrade CineGradePiPL)
    add_custom_command(TARGET CineGrade POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory
                "$<TARGET_BUNDLE_DIR:CineGrade>/Contents/Resources"
        COMMAND ${CMAKE_COMMAND} -E copy "${PIPL_RSRC}"
                "$<TARGET_BUNDLE_DIR:CineGrade>/Contents/Resources/CineGrade.rsrc"
        VERBATIM)
endif()

# Verify PiPL literals match the code's outflags whenever python3 is around.
find_program(PYTHON3 python3 python)
if(PYTHON3)
    add_custom_command(TARGET CineGrade PRE_BUILD
        COMMAND "${PYTHON3}"
                "${CMAKE_CURRENT_SOURCE_DIR}/../tools/check_pipl_flags.py"
                --sdk "${AE_SDK_ROOT}" --fix
        COMMENT "Checking PiPL outflag literals against the SDK headers"
        VERBATIM)
endif()
