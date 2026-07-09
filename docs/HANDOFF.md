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


## Phase 6 verification sweep — 2026-07-07, complete

Everything below observed live, not reported: 62 pytest / 48 vitest / typecheck /
build / content validator all green; no argon2 in app code; golden path passed
against the running API (lesson → stars → stats → forged-clock reviews → review
session); Mishka-down resilience per AUTH §5 (login 503 with the friendly copy,
existing-session refresh 200); public tunnel + CORS verified from the Pages origin;
streak rest-day bug fixed (trailing gap no longer consumes it); health
content_version now reports the manifest course id.

**Left for humans (cannot be verified from here):**
1. Real login on the public site with household credentials (mechanism verified
   end-to-end with a wrong-password 401 through Mishka; the happy path needs the real password).
2. Password-change propagation (AUTH §5 box 2) — run Mishka's set_password.py once
   and re-login to Michi; by construction it must work, but tick the box.
3. The content agent's TTS listen-through list (u11.hyaku_toban, u13 long-vowel
   katakana, へ-particle lines) — needs ears.
4. Lighthouse a11y ≥95 (DESIGN §9) — not run; keyboard operability and reduced-motion
   are implemented and unit-verified but unscored.

## Post-launch ops — 2026-07-09

Two real incidents this project paid for: testing against the live household db
(corrupted real progress/settings twice) and no way to recover if a bad script or
migration ever did real damage. Both closed:

- **Dev/prod db split.** `data/michi.db` is the household's only copy — the LaunchAgent
  (`com.michi.api`, port 8100, no `--reload`) is the only thing that should ever touch
  it. Local dev now runs on **port 8101** against `data/michi.dev.db` (see the `michi-api`
  entry in the shared launch.json and CLAUDE.md's Gotchas). Refresh the dev copy anytime
  with `sqlite3 data/michi.db ".backup 'data/michi.dev.db'"`. `michi-verify` now mints
  its throwaway session against 8101, never a real email.
- **Nightly backups.** `com.michi.backup` (LaunchAgent, 3am daily) runs
  `apps/server/scripts/backup_db.py`, which uses sqlite3's own `.backup()` API (safe
  against a live WAL-mode db — a plain file copy isn't) to snapshot into
  `data/backups/michi-<timestamp>.db`, pruning to the newest 30. Gotcha paid for here:
  the script **must** run under the venv's python, not `/bin/sh` — macOS's per-app Files
  & Folders permission for `~/Documents` was granted to that python binary (since
  `com.michi.api` already runs under it) but not to `/bin/sh`, so a shell-script version
  of this failed with a bare "Operation not permitted" from launchd with no obvious
  cause. If you ever add another LaunchAgent that touches files under `~/Documents`,
  invoke it via `.venv/bin/python`, not a shell script.
- **Partner nudge.** `nudges` table + `POST /api/stats/nudge` (12h cooldown per sender) +
  `POST /api/stats/nudge/dismiss`; `GET /api/stats/household` gained `pending_nudge`
  (null once >24h old or dismissed) and `is_me`/`user_id` per partner tile. Shares
  `find_partner_row` (now in curriculum.py, used by both routers) — the same
  mishka_user_id-based resolution as the manifest partner. UI: a dismissable one-line
  banner + a per-tile "Nudge" button on StatsPage, no counts or badges (CURRICULUM §8).
- **Phrasebook × itinerary.** `apps/web/src/itinerary.ts` mirrors the household's
  day→{city,leg} schedule from Dev/Japan_website (14 fixed days, city/leg labels only —
  no real names, no bookings; that repo stays the source of truth for the actual
  schedule). PhrasebookPage shows a "Today in {city}" shortlist (leg → tag mapping,
  trip-core first) when `trip_date` puts today inside the 14-day window; quietly absent
  otherwise. Deliberately NOT a live dependency on Japan_website's Supabase — this is a
  hand-maintained mirror of non-secret schedule data only.
- **PWA/offline.** `vite-plugin-pwa` (generateSW mode) in `vite.config.ts`: precaches the
  whole app shell (152 entries) so it opens with zero network, and runtime-caches
  `/api/curriculum/*` GETs with StaleWhileRevalidate so a lesson/phrasebook fetched once
  stays readable offline. Icons: `public/pwa-192.png` / `pwa-512.png` / `apple-touch-icon.png`
  (rasterized from MichiMark via `sips -s format png`, padded onto a square paper-coloured
  background — the source torii mark is non-square). Gotcha paid for: those API responses
  are per-caller (progress, partner presence), not shared static content, so the runtime
  cache uses a custom `cacheKeyWillBeUsed` that hashes the bearer token into the cache key
  — otherwise two accounts on one browser/device would risk being served each other's
  cached progress offline. Verified live: built with `VITE_API_BASE` pointed at a
  throwaway API + a temporary `MICHI_CORS_ORIGINS` override (never touched the shared
  cors_origins default), served via a new `michi-web-dist` launch.json entry
  (`python3 -m http.server 5176`), confirmed SW installs/controls/precaches, and that
  `caches.open('michi-content')` holds real 200 JSON responses keyed per-token. Auth/
  settings/progress POSTs are NOT cached — they need a live round-trip; the settings
  error banner (above) is what surfaces a genuine offline failure there.
- **The speaking corner.** Mic-only freeform conversation with a Claude-played character
  (konbini clerk / restaurant server / station attendant): `routers/converse.py`
  (stateless — the client resends the short transcript each turn, nothing conversational
  ever touches the db), `ConverseScene.tsx` + a card on PracticePage. Openers are
  hardcoded (instant, free); real turns call the Anthropic API via httpx (no SDK dep)
  with a strict-JSON N5-level system prompt, degrading gracefully: non-JSON reply →
  treated as the JP line; API error/bad key → friendly 503 the UI renders with a
  "Try again"; no `MICHI_ANTHROPIC_API_KEY` in .env → "not set up yet" card. The key is
  the household's own (slot + instructions left in `.env`/`.env.example`, restart the
  LaunchAgent after pasting it). Mocked-transport tests in `tests/test_converse.py`.
  No grading, no saving, ends naturally after ~8 exchanges (CURRICULUM §8).
