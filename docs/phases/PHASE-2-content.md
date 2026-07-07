# Phase 2 — Course content (owner: Opus)

Author the entire `content/` tree per CONTENT_GUIDE.md schemas and CURRICULUM.md §1
inventories. This is authorship, not code — quality bar is "a calm, knowledgeable friend
who lived in Japan wrote your phrasebook".

Order (CONTENT_GUIDE §4): validator script first (`apps/server/scripts/validate_content.py`
— schema, id integrity, count ranges, trip-core census; exits non-zero on violation), then
manifest + units 1–4 + hiragana, then 5–10 + katakana, then 11–13 + the six unit-14
dialogues.

Hard rules (from CONTENT_GUIDE, restated because they get broken):
- Polite form only; kanji only for traveller-visible words, always with `furigana`;
  Hepburn macrons; TTS reads `jp` — author for the ear, test-listen anything odd.
- Distractor discipline §3.7; sumimasen's multi-use taught explicitly (u01).
- ~120 `trip_core` items spread across units; every unit ≥4.
- Dialogues: 8–14 turns, alternating, every `you` turn answerable from studied items,
  written with stakes and warmth (they're the course's best scenes, treat them that way).

## Acceptance
- [ ] `python scripts/validate_content.py` green; totals 350–420 items, 110–130 trip-core,
      84 main lessons + 20 kana + menu-katakana bonus.
- [ ] All CONTENT_GUIDE §5 boxes, with the TTS spot-check listed item-by-item in the
      completion report.
- [ ] Orchestrator (Fable) reviews a sample: u01 fully, u04 dialogues, 20 random items
      across units for Japanese correctness before phase 3 consumes the data.
