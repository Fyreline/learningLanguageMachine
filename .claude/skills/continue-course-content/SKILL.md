---
name: continue-course-content
description: Author or extend Michi course content (units 10-14 outstanding, or future Season 2). Use when asked to finish the curriculum, add units/lessons/dialogues, or fix validator failures in content/.
---

# Continuing the course content

State as of 2026-07-07: units u01–u09 + kana trail + manifest are authored and committed;
**u10–u14 are missing**. Run `python3 apps/server/scripts/validate_content.py` — its
violation list is the exact TODO list, and green = done.

## Method

1. Read `docs/CONTENT_GUIDE.md` fully (schemas, ✋ rules, Japanese style rules) and
   `docs/CURRICULUM.md` §1 rows 10–14 (inventories) + §7 (trip core).
2. Match the register of the existing files — open `content/units/u04.json` and `u09.json`
   as exemplars before writing a line. Same JSON field order, same tone in `note` fields.
3. Author one unit at a time; run the validator after each file, not at the end.
4. Unit 14 is special: ~0 new items; six long dialogue lessons (8–14 turns, alternating
   npc/you, every `you` turn's `expect_item` must be taught in u01–u13, written like small
   scenes with stakes). It is the course's centrepiece — spend the effort there.
5. Trip-core census must land 110–130 total (86 exist in u01–u09; add ~24–44 across
   u10–u14, ≥4 per unit).

## Non-negotiables (the validator can't check taste)

- Polite です/ます register only; kanji only for traveller-visible written words, then
  `furigana` required; Hepburn macrons; author `jp` for TTS (kana when kanji could
  misread — test-listen odd ones via the Settings test-voice button or macOS `say`).
- Distractor discipline: never two defensible answers in one exercise.
- Hand-set `distractors` for near-synonyms; u11 emergencies must include the kōban
  cultural note pattern used in u01's sumimasen multi-use teaching.
- item ids are permanent once committed — SRS rows point at them.

After the validator is green: update docs/HANDOFF.md's state table and get a native-
adequacy spot-check (10 random items TTS-listened, romaji/gloss checked) before building
lesson features on the new units.
