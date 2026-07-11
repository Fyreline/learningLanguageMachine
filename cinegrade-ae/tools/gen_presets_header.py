"""Generate plugin/src/Presets.h from presets/presets.json.

Run whenever presets.json changes:
    python3 tools/gen_presets_header.py
"""

from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "presets", "presets.json")
DST = os.path.join(HERE, "..", "plugin", "src", "Presets.h")

SCALAR_FIELDS = [
    "exposure", "temperature", "tint", "contrast", "pivot",
    "shadows", "highlights", "whites", "blacks",
    "filmic_amount", "toe", "shoulder", "white_point",
    "saturation", "vibrance",
    "split_shadow_hue", "split_shadow_sat",
    "split_highlight_hue", "split_highlight_sat", "split_balance",
    "softness",
    "glow_amount", "glow_threshold", "glow_radius",
    "halation_amount", "halation_threshold", "halation_radius",
    "halation_hue", "ca_amount",
    "vignette_amount", "vignette_size", "vignette_feather",
    "vignette_roundness",
    "grain_amount", "grain_size", "grain_chroma", "grain_response",
    "gate_weave", "flicker",
]
VEC3_FIELDS = ["lift", "gamma", "gain"]
VEC6_FIELDS = ["band_sat", "band_lum"]


def fmt(v):
    s = f"{float(v):g}"
    if "." not in s and "e" not in s and "inf" not in s:
        s += ".0"
    return s + "f"


def emit_preset(pid, name, p):
    parts = [f'    {{ "{name}",']
    for f in SCALAR_FIELDS:
        parts.append(f"      /* {f:>18} */ {fmt(p[f])},")
    for f in VEC3_FIELDS:
        vals = ", ".join(fmt(x) for x in p[f])
        parts.append(f"      /* {f:>18} */ {{ {vals} }},")
    for f in VEC6_FIELDS:
        vals = ", ".join(fmt(x) for x in p[f])
        parts.append(f"      /* {f:>18} */ {{ {vals} }},")
    parts.append("    },")
    return "\n".join(parts)


def main():
    with open(SRC) as f:
        data = json.load(f)
    neutral = data["neutral"]

    lines = []
    lines.append("// GENERATED FILE — do not edit by hand.")
    lines.append("// Source of truth: presets/presets.json")
    lines.append("// Regenerate with: python3 tools/gen_presets_header.py")
    lines.append("#pragma once")
    lines.append("")
    lines.append("namespace cinegrade {")
    lines.append("")
    lines.append("struct PresetDef {")
    lines.append("    const char* name;")
    for f in SCALAR_FIELDS:
        lines.append(f"    float {f};")
    for f in VEC3_FIELDS:
        lines.append(f"    float {f}[3];")
    for f in VEC6_FIELDS:
        lines.append(f"    float {f}[6];")
    lines.append("};")
    lines.append("")
    lines.append("static const PresetDef kPresets[] = {")
    lines.append(emit_preset("none", "None (Custom)", neutral))
    for p in data["presets"]:
        merged = dict(neutral)
        merged.update(p["params"])
        lines.append(emit_preset(p["id"], p["name"], merged))
    lines.append("};")
    lines.append("")
    n = len(data["presets"]) + 1
    lines.append(f"static const int kNumPresets = {n};")
    lines.append("")
    names = "|".join(["None (Custom)"] + [p["name"] for p in data["presets"]])
    lines.append(f'static const char* kPresetPopupString = "{names}";')
    lines.append("")
    lines.append("} // namespace cinegrade")
    lines.append("")

    with open(DST, "w") as f:
        f.write("\n".join(lines))
    print("wrote", os.path.relpath(DST, os.path.join(HERE, "..")), f"({n} presets)")


if __name__ == "__main__":
    main()
