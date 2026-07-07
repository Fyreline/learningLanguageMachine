#!/usr/bin/env python3
"""Michi content validator.

Standalone, stdlib-only. Validates every ✋ rule in CONTENT_GUIDE.md §2 plus the
count/census rules from CURRICULUM.md §1/§7. Exits non-zero with a readable list of
violations on failure; prints a census on success.

Run from anywhere: it locates the repo's content/ directory relative to this file.
"""
import json
import sys
import unicodedata
from pathlib import Path

# ---------------------------------------------------------------------------
# Locate content/ relative to the repo root, regardless of CWD.
# ---------------------------------------------------------------------------

def find_content_dir() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "content"
        if candidate.is_dir() and (parent / "docs").is_dir():
            return candidate
    # Fallback: apps/server/scripts -> repo root is parents[3]
    guess = here.parents[3] / "content"
    if guess.is_dir():
        return guess
    print("FATAL: could not locate content/ directory", file=sys.stderr)
    sys.exit(2)


CONTENT = find_content_dir()

# ---------------------------------------------------------------------------
# Curriculum §1 inventory targets (item counts per unit) and config.
# ---------------------------------------------------------------------------

INVENTORY = {
    "u01": 26, "u02": 24, "u03": 30, "u04": 34, "u05": 32, "u06": 28,
    "u07": 28, "u08": 26, "u09": 30, "u10": 26, "u11": 28, "u12": 30,
    "u13": 22, "u14": 0,
}

TAG_VOCAB = {
    "greeting", "politeness", "food", "drink", "number", "money", "transport",
    "direction", "place", "shopping", "hotel", "time", "feeling", "smalltalk",
    "emergency", "health", "culture", "question", "pattern", "trip_core",
    "body", "weather", "kana", "menu", "set-phrase",
}

STEP_TYPES = {
    "teach", "listen-pick", "listen-pick-jp", "tile-arrange", "speak",
    "listen-type-romaji", "kana-glyph", "match-pairs", "dialogue",
}
ITEM_STEP_TYPES = {
    "teach", "listen-pick", "listen-pick-jp", "tile-arrange", "speak",
    "listen-type-romaji", "kana-glyph",
}

violations = []


def err(where, msg):
    violations.append(f"[{where}] {msg}")


def has_kanji(s: str) -> bool:
    for ch in s:
        # CJK Unified Ideographs (+ Extension A) and the iteration mark 々
        o = ord(ch)
        if 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or ch == "々":
            return True
    return False


SMALL_KANA = set("ゃゅょャュョ")


def mora_count(s: str) -> int:
    """Rough mora count over a kana string: count kana, small ya/yu/yo don't add."""
    n = 0
    for ch in s:
        o = ord(ch)
        is_kana = (0x3040 <= o <= 0x309F) or (0x30A0 <= o <= 0x30FF) or ch == "ー"
        if not is_kana:
            continue
        if ch in SMALL_KANA:
            continue
        n += 1
    return n


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        err(path.name, f"could not parse JSON: {e}")
        return None


# ---------------------------------------------------------------------------
# Load everything.
# ---------------------------------------------------------------------------

manifest = load(CONTENT / "manifest.json")
unit_files = sorted((CONTENT / "units").glob("u*.json"))
units = {}
for uf in unit_files:
    data = load(uf)
    if data is not None:
        units[data.get("id", uf.stem)] = (uf.name, data)

kana_files = {
    "hiragana": CONTENT / "kana" / "hiragana.json",
    "katakana": CONTENT / "kana" / "katakana.json",
}
kana = {}
for name, kf in kana_files.items():
    if kf.exists():
        data = load(kf)
        if data is not None:
            kana[name] = data
    else:
        err("kana", f"missing file {kf.name}")

# ---------------------------------------------------------------------------
# Build global id registries.
# ---------------------------------------------------------------------------

all_item_ids = {}          # id -> source
all_lesson_ids = {}
all_dialogue_ids = {}
unit_item_ids = {}         # unit id -> set of its item ids
all_tags = set()
trip_core_total = 0
trip_core_per_unit = {}


def register_item(iid, source):
    if iid in all_item_ids:
        err(source, f"duplicate item id '{iid}' (also in {all_item_ids[iid]})")
    else:
        all_item_ids[iid] = source


def validate_item(item, source):
    iid = item.get("id")
    if not iid:
        err(source, "item missing id")
        return
    for field in ("jp", "romaji", "en"):
        if not item.get(field):
            err(source, f"item '{iid}' missing required field '{field}'")
    tags = item.get("tags")
    if not isinstance(tags, list) or not tags:
        err(source, f"item '{iid}' must have a non-empty tags list")
    else:
        for t in tags:
            all_tags.add(t)
            if t not in TAG_VOCAB:
                err(source, f"item '{iid}' uses tag '{t}' outside the allowed vocabulary")
    jp = item.get("jp", "")
    if has_kanji(jp) and not item.get("furigana"):
        err(source, f"item '{iid}' jp contains kanji but has no furigana")
    note = item.get("note")
    if note is not None and len(note) > 120:
        err(source, f"item '{iid}' note exceeds 120 chars ({len(note)})")
    if item.get("furigana") and has_kanji(item["furigana"]):
        err(source, f"item '{iid}' furigana still contains kanji")


# --- items ---------------------------------------------------------------
for uid, (fname, data) in units.items():
    ids = set()
    tc = 0
    for item in data.get("items", []):
        iid = item.get("id")
        validate_item(item, fname)
        if iid:
            register_item(iid, fname)
            ids.add(iid)
            if not iid.startswith(uid + "."):
                err(fname, f"item id '{iid}' does not match its unit prefix '{uid}.'")
        if item.get("trip_core"):
            tc += 1
    unit_item_ids[uid] = ids
    trip_core_per_unit[uid] = tc
    global_tc = tc

# recompute trip_core total cleanly
trip_core_total = sum(trip_core_per_unit.values())

# kana items
kana_item_ids = set()
for name, data in kana.items():
    for item in data.get("items", []):
        iid = item.get("id")
        if not iid:
            err(name, "kana item missing id")
            continue
        register_item(iid, name)
        kana_item_ids.add(iid)
        for field in ("jp", "romaji", "en"):
            if not item.get(field):
                err(name, f"kana item '{iid}' missing '{field}'")
        for t in item.get("tags", []):
            all_tags.add(t)
            if t not in TAG_VOCAB:
                err(name, f"kana item '{iid}' uses tag '{t}' outside vocabulary")

# ---------------------------------------------------------------------------
# Dialogues.
# ---------------------------------------------------------------------------
units_1_13_items = set()
for uid in units:
    if uid != "u14":
        units_1_13_items |= unit_item_ids.get(uid, set())

for uid, (fname, data) in units.items():
    for dlg in data.get("dialogues", []):
        did = dlg.get("id")
        if not did:
            err(fname, "dialogue missing id")
            continue
        if did in all_dialogue_ids:
            err(fname, f"duplicate dialogue id '{did}'")
        else:
            all_dialogue_ids[did] = (fname, dlg)
        if not dlg.get("scene"):
            err(fname, f"dialogue '{did}' missing scene")
        turns = dlg.get("turns", [])
        n = len(turns)
        if not (8 <= n <= 14):
            err(fname, f"dialogue '{did}' has {n} turns (need 8-14)")
        prev = None
        for i, turn in enumerate(turns):
            sp = turn.get("speaker")
            if sp not in ("npc", "you"):
                err(fname, f"dialogue '{did}' turn {i} bad speaker '{sp}'")
            if sp == prev:
                err(fname, f"dialogue '{did}' turn {i} does not alternate (two '{sp}' in a row)")
            prev = sp
            if sp == "npc":
                for field in ("jp", "romaji", "en"):
                    if not turn.get(field):
                        err(fname, f"dialogue '{did}' npc turn {i} missing '{field}'")
                if has_kanji(turn.get("jp", "")) and not turn.get("furigana"):
                    err(fname, f"dialogue '{did}' npc turn {i} jp has kanji but no furigana")
            elif sp == "you":
                ei = turn.get("expect_item")
                if not ei:
                    err(fname, f"dialogue '{did}' you turn {i} missing expect_item")
                elif ei not in all_item_ids:
                    err(fname, f"dialogue '{did}' you turn {i} expect_item '{ei}' does not exist")
                if turn.get("mode") not in ("pick", "speak"):
                    err(fname, f"dialogue '{did}' you turn {i} bad mode '{turn.get('mode')}'")
                if not turn.get("stakes"):
                    err(fname, f"dialogue '{did}' you turn {i} missing stakes")

# ---------------------------------------------------------------------------
# Lessons: new_items rules, reachability, steps referential integrity.
# ---------------------------------------------------------------------------
assigned = {}  # item id -> lesson id (must be exactly one)


def check_item_ref(iid, where, ctx):
    if iid not in all_item_ids:
        err(where, f"{ctx} references unknown item id '{iid}'")


def check_step(step, where, ctx):
    st = step.get("type")
    if st not in STEP_TYPES:
        err(where, f"{ctx} step has bad type '{st}'")
        return
    if st == "match-pairs":
        items = step.get("items", [])
        if len(items) != 5:
            err(where, f"{ctx} match-pairs step has {len(items)} items (need exactly 5)")
        for iid in items:
            check_item_ref(iid, where, ctx + " match-pairs")
    elif st == "dialogue":
        did = step.get("dialogue")
        if did not in all_dialogue_ids:
            err(where, f"{ctx} dialogue step references unknown dialogue '{did}'")
    elif st in ITEM_STEP_TYPES:
        iid = step.get("item")
        check_item_ref(iid, where, ctx)
        for d in step.get("distractors", []):
            check_item_ref(d, where, ctx + " distractor")
        # speak steps: jp <= ~20 mora
        if st == "speak" and iid in all_item_ids:
            pass  # mora checked below where we have the item text


# index items by id -> item dict for mora checks
item_by_id = {}
for uid, (fname, data) in units.items():
    for item in data.get("items", []):
        if item.get("id"):
            item_by_id[item["id"]] = item

for uid, (fname, data) in units.items():
    lessons = data.get("lessons", [])
    for lesson in lessons:
        lid = lesson.get("id")
        if not lid:
            err(fname, "lesson missing id")
            continue
        if lid in all_lesson_ids:
            err(fname, f"duplicate lesson id '{lid}'")
        else:
            all_lesson_ids[lid] = fname
        kind = lesson.get("kind")
        new_items = lesson.get("new_items", [])
        if kind == "teach":
            if not (4 <= len(new_items) <= 7):
                err(fname, f"lesson '{lid}' (teach) has {len(new_items)} new_items (need 4-7)")
            for iid in new_items:
                check_item_ref(iid, fname, f"lesson '{lid}' new_items")
                if iid in all_item_ids and iid not in unit_item_ids.get(uid, set()):
                    err(fname, f"lesson '{lid}' new_items '{iid}' is not an item of unit {uid}")
                if iid in assigned:
                    err(fname, f"item '{iid}' assigned to multiple lessons ({assigned[iid]}, {lid})")
                else:
                    assigned[iid] = lid
        elif kind == "checkpoint":
            if len(new_items) != 0:
                err(fname, f"checkpoint '{lid}' must have zero new_items (has {len(new_items)})")
        else:
            err(fname, f"lesson '{lid}' has bad kind '{kind}'")
        # steps
        steps = lesson.get("steps")
        if steps is not None:
            for step in steps:
                check_step(step, fname, f"lesson '{lid}'")
                # mora limit on speak/dialogue-bearing item steps
                if step.get("type") == "speak":
                    iid = step.get("item")
                    it = item_by_id.get(iid)
                    if it:
                        txt = it.get("furigana") or it.get("jp", "")
                        if mora_count(txt) > 20:
                            err(fname, f"lesson '{lid}' speak step item '{iid}' exceeds ~20 mora")

# reachability: every unit item assigned to exactly one lesson
for uid, ids in unit_item_ids.items():
    for iid in ids:
        if iid not in assigned:
            err(units[uid][0], f"item '{iid}' is not reachable from any lesson's new_items")

# ---------------------------------------------------------------------------
# Manifest checks.
# ---------------------------------------------------------------------------
if manifest is None:
    err("manifest.json", "missing or unparseable")
else:
    munits = manifest.get("units", [])
    if len(munits) != 14:
        err("manifest.json", f"expected 14 units, found {len(munits)}")
    seen_landmarks = []
    for mu in munits:
        for field in ("id", "title", "kicker", "summary", "landmark", "lessons"):
            if field not in mu:
                err("manifest.json", f"unit {mu.get('id')} missing '{field}'")
        seen_landmarks.append(mu.get("landmark"))
        muid = mu.get("id")
        if muid not in units:
            err("manifest.json", f"manifest unit '{muid}' has no unit file")
        mlessons = mu.get("lessons", [])
        if len(mlessons) != 6:
            err("manifest.json", f"unit '{muid}' should have 6 lessons, has {len(mlessons)}")
        # manifest lesson ids should match the unit file lesson ids
        file_lessons = {l.get("id") for l in units.get(muid, ("", {}))[1].get("lessons", [])} if muid in units else set()
        for ml in mlessons:
            if ml.get("id") not in file_lessons:
                err("manifest.json", f"manifest lesson '{ml.get('id')}' not found in {muid} file")
    kt = manifest.get("kana_trail", {})
    hira = kt.get("hiragana", [])
    kata = kt.get("katakana", [])
    if len(hira) < 10:
        err("manifest.json", f"kana_trail.hiragana has {len(hira)} lessons (need >=10)")
    if len(kata) < 10:
        err("manifest.json", f"kana_trail.katakana has {len(kata)} lessons (need >=10)")
    # kana lesson ids should exist in kana files
    kana_lesson_ids = set()
    for name, data in kana.items():
        for lesson in data.get("lessons", []):
            kana_lesson_ids.add(lesson.get("id"))
    for lid in hira + kata:
        if lid not in kana_lesson_ids:
            err("manifest.json", f"kana_trail lesson '{lid}' not found in kana files")

# kana reachability: every kana item appears in some kana lesson step
kana_referenced = set()
for name, data in kana.items():
    for lesson in data.get("lessons", []):
        for step in lesson.get("steps", []):
            if step.get("type") in ITEM_STEP_TYPES:
                kana_referenced.add(step.get("item"))
            if step.get("type") == "match-pairs":
                kana_referenced.update(step.get("items", []))
for iid in kana_item_ids:
    if iid not in kana_referenced:
        err("kana", f"kana item '{iid}' is not referenced by any kana lesson step")

# ---------------------------------------------------------------------------
# Count / census rules.
# ---------------------------------------------------------------------------
for uid, target in INVENTORY.items():
    if uid == "u14":
        continue
    count = len(unit_item_ids.get(uid, set()))
    lo, hi = round(target * 0.8), round(target * 1.2)
    if not (lo <= count <= hi):
        err(uid, f"item count {count} outside ±20% of inventory target {target} ({lo}-{hi})")
    if trip_core_per_unit.get(uid, 0) < 4:
        err(uid, f"has {trip_core_per_unit.get(uid,0)} trip_core items (need >=4)")

if not (110 <= trip_core_total <= 130):
    err("census", f"trip_core total {trip_core_total} outside 110-130")

total_items = len(all_item_ids) - len(kana_item_ids)
if not (350 <= total_items <= 420):
    err("census", f"total course items {total_items} outside 350-420")

if len(all_tags) > 25:
    err("tags", f"{len(all_tags)} distinct tags in use (max 25): {sorted(all_tags)}")

# u14 dialogues: exactly the six long dress-rehearsals, 8-14 turns each
if "u14" in units:
    u14_dialogues = units["u14"][1].get("dialogues", [])
    if len(u14_dialogues) < 6:
        err("u14", f"unit 14 has {len(u14_dialogues)} dialogues (need >=6 dress rehearsals)")
    for dlg in u14_dialogues:
        for turn in dlg.get("turns", []):
            if turn.get("speaker") == "you":
                ei = turn.get("expect_item")
                if ei and ei not in units_1_13_items:
                    err("u14", f"dialogue '{dlg.get('id')}' expect_item '{ei}' not taught in units 1-13")

# ---------------------------------------------------------------------------
# Report.
# ---------------------------------------------------------------------------
if violations:
    print(f"CONTENT VALIDATION FAILED — {len(violations)} violation(s):\n")
    for v in violations:
        print("  ✗ " + v)
    sys.exit(1)

print("CONTENT VALIDATION PASSED\n")
print(f"  Course items:        {total_items}")
print(f"  Kana items:          {len(kana_item_ids)}")
print(f"  trip_core total:     {trip_core_total}")
print(f"  Distinct tags:       {len(all_tags)}")
print(f"  Dialogues:           {len(all_dialogue_ids)}")
print(f"  Lessons:             {len(all_lesson_ids)}")
print("\n  Per-unit (items / trip_core):")
for uid in sorted(unit_item_ids):
    print(f"    {uid}: {len(unit_item_ids[uid]):>3} items, {trip_core_per_unit[uid]:>2} trip_core")
sys.exit(0)
