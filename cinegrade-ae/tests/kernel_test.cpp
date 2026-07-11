// kernel_test.cpp — offline harness for CineGradeKernel.h.
//
// Reads a raw float32 RGBA image, grades it with a named preset, writes the
// result as raw float32 RGBA. reference/compare_kernel.py drives this and
// diffs the result against the Python reference implementation.
//
//   kernel_test IN.raw WIDTH HEIGHT PRESET_INDEX AE(0|1) NOISE(0|1) OUT.raw
//
// Prints the computed auto-exposure stops on stdout (for cross-checking).

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include "../plugin/src/PresetMap.h"

int main(int argc, char** argv) {
    if (argc != 8) {
        std::fprintf(stderr,
                     "usage: kernel_test in.raw w h presetIdx ae noise out.raw\n");
        return 2;
    }
    const char* inPath = argv[1];
    int w = std::atoi(argv[2]);
    int h = std::atoi(argv[3]);
    int presetIdx = std::atoi(argv[4]);
    bool ae = std::atoi(argv[5]) != 0;
    bool noise = std::atoi(argv[6]) != 0;
    const char* outPath = argv[7];

    if (presetIdx < 0 || presetIdx >= cinegrade::kNumPresets) {
        std::fprintf(stderr, "bad preset index\n");
        return 2;
    }

    std::vector<float> img((size_t)w * h * 4);
    FILE* f = std::fopen(inPath, "rb");
    if (!f || std::fread(img.data(), sizeof(float), img.size(), f) != img.size()) {
        std::fprintf(stderr, "failed to read %s\n", inPath);
        return 1;
    }
    std::fclose(f);

    cinegrade::GradeParams p =
        cinegrade::presetToParams(cinegrade::kPresets[presetIdx], 1.0f);
    if (!noise) {
        // disable the stochastic stages for exact comparison
        p.grainAmount = 0.0f;
        p.gateWeave = 0.0f;
        p.flicker = 0.0f;
    }

    cinegrade::AutoExposure aeCfg;
    aeCfg.enabled = ae;
    float stops = 0.0f;
    if (ae) {
        stops = cinegrade::computeAutoExposureStops(img.data(), w, h,
                                                    (size_t)w * 4, aeCfg);
    }
    std::printf("ae_stops=%.6f\n", stops);

    cinegrade::gradeFrame(img.data(), w, h, (size_t)w * 4, p, /*frame=*/7,
                          stops);

    f = std::fopen(outPath, "wb");
    if (!f) { std::fprintf(stderr, "failed to open %s\n", outPath); return 1; }
    std::fwrite(img.data(), sizeof(float), img.size(), f);
    std::fclose(f);
    return 0;
}
