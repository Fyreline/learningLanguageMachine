# Michi — Build Plan

Docs-first (this suite), then phased implementation with explicit owners. Model policy per
household preference: **Sonnet for well-specified ports/scaffolds, Opus for judgment-heavy
engine and content work, Fable for the signature visuals and final verification.** Every
phase ends at its doc's acceptance criteria, independently verified by the orchestrator
(run the code, not the report — subagent claims are not evidence).

| Phase | Scope | Owner | Doc |
|---|---|---|---|
| 1 | Monorepo scaffold: web app shell + tokens + login; server with auth (Mishka identity proxy), models, health | Sonnet | [PHASE-1](phases/PHASE-1-scaffold.md) |
| 2 | Full course content: manifest, 14 units, kana trail, dialogues, validator | Opus | [PHASE-2](phases/PHASE-2-content.md) |
| 3 | Learning engine: TTS/STT wrappers, session builder, all 8 exercise components, lesson player, grading, SRS server-side, progress/reviews/stats endpoints | Opus | [PHASE-3](phases/PHASE-3-engine.md) |
| 4 | Practice tab, Phrasebook, Settings, placement probe, kana trainer | Sonnet | [PHASE-4](phases/PHASE-4-practice.md) |
| 5 | The Path scene, Stats page, lesson-complete/torii moments, MichiMark | **Fable** | [PHASE-5](phases/PHASE-5-path-stats.md) |
| 6 | End-to-end verification against every doc's acceptance list, polish, deploy notes, push | Fable | [PHASE-6](phases/PHASE-6-verify.md) |

Sequencing: 1 → 2 and 3 in parallel (3 stubs content with unit 1 fixtures until 2 lands) →
4 and 5 in parallel → 6. Phases 2–5 each land as one or more commits on `main` (single-user
repo, no PR ceremony), message prefix `phase-N:`.

Ground rules for implementing agents:

1. Read the referenced docs **fully** before writing code; the docs win over instinct. A
   contradiction between docs is a stop-and-report, not a coin flip.
2. Ports from Mishka Hub (`/Users/mack/Documents/Dev/MishkaHub`) are explicitly listed in
   each phase doc — copy the real files and adapt; do not reinvent.
3. No new dependencies beyond the stack in ARCHITECTURE.md without written justification
   in the commit message.
4. Meet the acceptance criteria *and leave proof*: each phase's completion report must
   include commands run and their real output (typecheck, pytest, validator, curl).
5. British English in all user-facing copy; tone per DESIGN.md.
