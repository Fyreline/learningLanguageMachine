"""Verify (and optionally fix) the PiPL outflag literals against the AE SDK.

The PiPL resource (CineGrade_PiPL.r) carries numeric copies of the outflags
set in GlobalSetup() (CineGrade.cpp). After Effects logs a mismatch warning
and can behave unpredictably if they drift apart. This script:

  1. parses PF_OutFlag_* / PF_OutFlag2_* bit values from your SDK's
     AE_Effect.h (so the numbers are authoritative, not from memory),
  2. reads the flag names used in CineGrade.cpp's GlobalSetup(),
  3. recomputes both literals and compares them to CineGrade_PiPL.r,
  4. with --fix, rewrites the .r file in place.

Usage:
    python3 tools/check_pipl_flags.py --sdk /path/to/AfterEffectsSDK [--fix]
"""

from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CPP = os.path.join(HERE, "..", "plugin", "src", "CineGrade.cpp")
PIPL = os.path.join(HERE, "..", "plugin", "src", "CineGrade_PiPL.r")


def find_ae_effect_h(sdk_root):
    for dirpath, _dirs, files in os.walk(sdk_root):
        if "AE_Effect.h" in files:
            return os.path.join(dirpath, "AE_Effect.h")
    raise SystemExit(f"AE_Effect.h not found under {sdk_root}")


def parse_flag_values(header_path):
    text = open(header_path, encoding="utf-8", errors="replace").read()
    values = {}
    for m in re.finditer(
            r"(PF_OutFlag2?_[A-Za-z0-9_]+)\s*=\s*(?:\(?\s*)?"
            r"(?:1L?\s*<<\s*(\d+)|(\d+)L?)", text):
        name, shift, direct = m.groups()
        values[name] = (1 << int(shift)) if shift else int(direct)
    return values


def parse_used_flags(cpp_path):
    text = open(cpp_path, encoding="utf-8").read()
    m1 = re.search(r"out_flags\s*=\s*([^;]+);", text)
    m2 = re.search(r"out_flags2\s*=\s*([^;]+);", text)
    if not (m1 and m2):
        raise SystemExit("could not find out_flags assignments in CineGrade.cpp")
    f1 = re.findall(r"PF_OutFlag_[A-Za-z0-9_]+", m1.group(1))
    f2 = re.findall(r"PF_OutFlag2_[A-Za-z0-9_]+", m2.group(1))
    return f1, f2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sdk", required=True, help="AE SDK root directory")
    ap.add_argument("--fix", action="store_true", help="rewrite the .r file")
    args = ap.parse_args()

    header = find_ae_effect_h(args.sdk)
    values = parse_flag_values(header)
    f1, f2 = parse_used_flags(CPP)

    missing = [f for f in f1 + f2 if f not in values]
    if missing:
        raise SystemExit(f"flags not found in {header}: {missing}")

    v1 = 0
    for f in f1:
        v1 |= values[f]
    v2 = 0
    for f in f2:
        v2 |= values[f]

    pipl = open(PIPL, encoding="utf-8").read()
    cur1 = int(re.search(r"AE_Effect_Global_OutFlags\s*\{\s*(0x[0-9A-Fa-f]+)",
                         pipl).group(1), 16)
    cur2 = int(re.search(r"AE_Effect_Global_OutFlags_2\s*\{\s*(0x[0-9A-Fa-f]+)",
                         pipl).group(1), 16)

    ok1, ok2 = cur1 == v1, cur2 == v2
    print(f"OutFlags : code 0x{v1:08X}  pipl 0x{cur1:08X}  "
          f"{'OK' if ok1 else 'MISMATCH'}")
    print(f"OutFlags2: code 0x{v2:08X}  pipl 0x{cur2:08X}  "
          f"{'OK' if ok2 else 'MISMATCH'}")

    if ok1 and ok2:
        return
    if not args.fix:
        sys.exit(1)
    pipl = re.sub(r"(AE_Effect_Global_OutFlags\s*\{\s*)0x[0-9A-Fa-f]+",
                  rf"\g<1>0x{v1:08X}", pipl)
    pipl = re.sub(r"(AE_Effect_Global_OutFlags_2\s*\{\s*)0x[0-9A-Fa-f]+",
                  rf"\g<1>0x{v2:08X}", pipl)
    open(PIPL, "w", encoding="utf-8").write(pipl)
    print("rewrote", os.path.relpath(PIPL, os.path.join(HERE, "..")))


if __name__ == "__main__":
    main()
