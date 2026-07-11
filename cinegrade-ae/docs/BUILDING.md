# Building CineGrade

## Prerequisites

1. **Adobe After Effects SDK** — free from
   <https://developer.adobe.com/after-effects/>. Any SDK from **March 2021**
   (AE 18.x / "2021") onward works; the code avoids post-2021 API additions
   except `PF_REGISTER_EFFECT_EXT2`, which that SDK already ships.
   Unzip anywhere; the folder containing `Examples/Headers` is your
   `AE_SDK_ROOT`.
2. **CMake ≥ 3.20**.
3. Windows: **Visual Studio 2019/2022** (Desktop C++ workload).
   macOS: **Xcode** + command line tools (for `Rez`).

## Windows (.aex)

```bat
cd cinegrade-ae\plugin
cmake -B build -DAE_SDK_ROOT="C:\SDKs\AfterEffectsSDK" -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

Copy `build\Release\CineGrade.aex` to
`C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Plug-ins\`
(or the shared `...\Common\Plug-ins\7.0\MediaCore\`) and restart AE.

The PiPL is compiled with the SDK's standard pipeline
(`cl /EP` → `PiPLtool.exe` → `cl /EP` → `rc`), wired up in CMake. Run the
build from a *Developer Command Prompt* so `cl` is on PATH.

## macOS (.plugin)

```bash
cd cinegrade-ae/plugin
cmake -B build -DAE_SDK_ROOT=~/SDKs/AfterEffectsSDK -G Xcode
cmake --build build --config Release
```

Copy `CineGrade.plugin` to
`/Applications/Adobe After Effects <ver>/Plug-ins/`. Builds a universal
binary when Xcode defaults allow (Intel + Apple Silicon; AE 2022+ for
native ARM, AE 2021 runs the Intel slice under Rosetta).

## After Effects 2021 notes

- AE 2021 (18.x) fully supports everything the plugin uses: SmartFX, float
  worlds, threaded rendering (MFR was introduced as preview in 2021 betas;
  the flag is simply ignored where unsupported).
- Build with the **March 2021** SDK if you want to be maximally conservative
  for 2021, or any newer SDK — plugins built against newer SDKs load fine in
  2021 as long as you avoid newer suites (we do).

## If the effect doesn't appear

1. Check AE's log for a **PiPL outflags mismatch** warning. If you edited
   `out_flags` in `CineGrade.cpp` or the `.r` file, re-sync them:
   ```bash
   python3 tools/check_pipl_flags.py --sdk "$AE_SDK_ROOT" --fix
   ```
   (The build runs this automatically when python3 is available. The
   literals in the repo were computed from SDK headers offline — trust the
   checker over the checked-in values if they ever disagree.)
2. Match name conflicts: the effect registers as `FYRELINE CineGrade` in
   category *Color Correction*.
3. macOS Gatekeeper: unsigned bundles need
   `xattr -dr com.apple.quarantine CineGrade.plugin` or a codesign.

## Alternative: drop into an SDK sample project

If you'd rather not use CMake: duplicate the SDK's `SmartFX` (or
`Skeleton`) example project, remove its sources, add
`plugin/src/CineGrade.cpp` (plus the SDK's `AEGP_SuiteHandler.cpp` /
`MissingSuiteError.cpp`, already referenced by the sample), replace the
sample's `.r` file with `CineGrade_PiPL.r`, and build. The headers
(`CineGradeKernel.h`, `Presets.h`, `PresetMap.h`, `CineGrade.h`) ride along
via the include path.

## Regenerating presets

Presets live in `presets/presets.json`. After editing:

```bash
python3 tools/gen_presets_header.py   # refresh plugin/src/Presets.h
cd reference && python3 run_tests.py  # confirm the looks still pass
```
