# Phase 3 — Learning engine (owner: Opus)

The core product: a lesson is playable end-to-end with audio, grading, adaptivity, and SRS
persistence. Builds on Phase 1's scaffold; until Phase 2 lands, develop against a
hand-written `content/units/u01.json` fixture conforming to CONTENT_GUIDE (replace with
real content when available — zero code changes expected at swap).

## Server
1. `app/srs.py` per CURRICULUM §6 — pure functions, unit-tested with forged clocks,
   including the 60-day cap and strength transitions.
2. `routers/curriculum.py` (manifest state-merge + lesson payload with server-picked
   review riders + lock enforcement), `routers/progress.py` (lesson/placement complete —
   idempotent submission_id transaction per DATA_MODEL), `routers/reviews.py`,
   `routers/stats.py` (all shapes exactly per API.md).
3. Streak derivation with the 6-of-7 rest-day rule; local_date handling per DATA_MODEL.

## Web
1. `curriculum/loader.ts`, `engine/session.ts` (CURRICULUM §3 anatomy + §5 pacing: fast
   lane, slow lane, new-item rate), `engine/grading.ts` (normalization, mora Levenshtein,
   §4.5 romaji compare — vitest coverage), `engine/srs.ts` (forecast mirror).
2. `audio/tts.ts` full: voice pick (prefer Kyoko/Google 日本語), queue, rate + 0.65 turtle,
   speaking-state events for the pulse ring. `audio/stt.ts` full: ja-JP recognition,
   interim transcripts, shadow-mode fallback per CURRICULUM §4.8.
3. All eight exercise components (CURRICULUM §4) + `LessonPlayer.tsx` per DESIGN.md §4 —
   including feedback strip (never auto-advance), 2-miss re-teach conversion, "I know
   this" placement rules, keyboard operability, reduced-motion.
4. Lesson-complete score screen (DESIGN §7 row 3) with a plain "back to path" (Phase 5
   replaces the reveal animation).

## Acceptance
- [ ] Full u01 lesson playable in Chrome and Safari (shadow mode) — audio auto-plays,
      every exercise type reachable via a dev route that force-loads each type.
- [ ] CURRICULUM §10 boxes: fast-skip, slow-lane, new-item-rate, SRS math tests, speech
      thresholds.
- [ ] Complete a lesson → rows land per DATA_MODEL (paste sqlite queries); repeat POST with
      same submission_id → no double XP.
- [ ] Next-day (forged clock) `GET /api/reviews/due` returns yesterday's items;
      review session updates them.
- [ ] typecheck, vitest, pytest all green (paste output).
