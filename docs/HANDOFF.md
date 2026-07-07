# Handoff — from Fable, retiring 2026-07-07

The docs suite (PLAN/ARCHITECTURE/AUTH/DESIGN/CURRICULUM/CONTENT_GUIDE/DATA_MODEL/API +
phases/) is complete and battle-tested against real code — trust it. This note is only
the delta: what exists, what's next, and where the bodies are buried.

## State

| Piece | State |
|---|---|
| Phase 1 scaffold (both apps, shared-identity auth) | ✅ done, verified, committed. 30 server tests green. Real login round-trips through Mishka Hub. |
| Phase 2 content | ✅ **Complete (2026-07-07): 369 items, 115 trip_core, 84 lessons, 19 dialogues incl. six u14 dress rehearsals; validator green.** TTS spot-listen list in the phase-2 agent report (u11.hyaku_toban, u13 long vowels, へ-particle lines). |
| Phase 3 engine | ✅ **Complete (2026-07-07): SRS + progress/reviews/placement endpoints, session builder with fast/slow lanes, all 8 exercise components, LessonPlayer + score screen wired to path celebration. 57 pytest + 41 vitest. Known nit: stats._streak rest_day_used=true on a 1-day streak.** |
| Phase 4 practice/phrasebook/settings/placement | ✅ **Complete (2026-07-07): review/drill/lightning sessions over the phase-3 engine, kana trainer, phrasebook, live settings store, placement probe. 62 pytest + 48 vitest.** |
| Phase 5 Path + Stats (Fable's) | ✅ done: PathScene/PathPage/StatsPage + manifest/stats endpoints. `?mock` previews a dressed path. **Deferred polish:** lesson-complete walk animation + torii confetti moment (specs in DESIGN §5/§7) wire up when phase 3's score screen exists; kana spur is a card, not a literal branch path. |
| Aizome palette | ✅ both apps, shared theme.css + sync script + skill. |
| Phase 6 verify & ship | Skill `michi-verify` is the gauntlet; PHASE-6 doc is the full checklist. |

## Recommended order

1. ~~Content u10–u14~~ done 2026-07-07.
   realism.
2. ~~Phase 3 engine~~ done 2026-07-07.
3. ~~Phase 4~~ done 2026-07-07. Remaining: phase 6 final verification sweep (docs/phases/PHASE-6-verify.md).
4. Wire the deferred Phase-5 animations into phase 3's completion flow.
5. Phase 6 gauntlet, then GitHub Pages + tunnel deploy per ARCHITECTURE §5.

## Bodies, buried

- CLAUDE.md "Gotchas" is the list (int `current_user`, nested-svg sizing, lru_cache
  content, theme.css split). Add to it when you pay for a new one.
- u04's manifest kicker ("UNIT 4 · RESTAURANT") + title ("Restaurant") read redundantly on
  the path header — retitle to "Ordering food" style display titles in manifest.json when
  next touching content (titles are display-only; safe to change, unlike ids).
- The one live subagent lesson from this project: **verify, don't believe** — the phase-1
  agent was excellent, the phase-2 agent died mid-run from session limits and the partial
  state needed auditing. Always run `michi-verify` after any delegated phase.
- Two Mishka repos exist: `Dev/MishkaHub` (real) and `Dev/mishka-hub copy` (stale copy —
  ignore it).
