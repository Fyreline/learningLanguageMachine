# Phase 1 — Scaffold (owner: Sonnet)

Deliver a running skeleton: both apps boot, login round-trips through Mishka Hub, theme
tokens in place, nav shell with empty pages.

## Server (`apps/server`)
1. FastAPI app factory per ARCHITECTURE §1/§4: config (`MICHI_` prefix), db.py, models.py
   (DATA_MODEL.md — all five tables), errors.py (`MichiHTTPException`).
2. Auth stack per AUTH.md §3 exactly: `security.py` (port from
   `Dev/MishkaHub/apps/server/app/security.py`, password functions deleted), `identity.py`,
   `routers/auth.py` (login proxy + refresh/logout/me ports + rate limit), `auth.py`
   dependency. `PUT /api/auth/settings` merge-patch.
3. `routers/health.py` incl. identity reachability probe (1s timeout, cached 60s).
4. pytest: identity client (respx-stubbed 200/401/429/timeout), login/refresh/rotation/
   reuse-tripwire, settings patch. **No argon2 anywhere.**

## Web (`apps/web`)
1. Vite + React 19 + TS + Tailwind v4 + motion; port 5174; typecheck script. Copy
   `index.css` tokens from `Dev/MishkaHub/apps/web/src/index.css` (shipped file, includes
   dark block) + Michi additions from DESIGN.md §2. Self-host Noto Sans JP variable
   (npm `@fontsource-variable/noto-sans-jp`; also Schibsted Grotesk, Source Serif 4, Inter,
   JetBrains Mono via fontsource, matching Mishka's approach if it differs — check its
   index.html/package.json and mirror).
2. Port `auth.ts` + `api.ts` from Mishka (AUTH.md §3.5 changes), `ThemeToggle.tsx` as-is
   (storage key `michi-theme`).
3. App shell per DESIGN.md §3: header with placeholder MichiMark (Mishka CatMark copy is
   fine this phase), tabs routing to stub pages (Path/Practice/Phrasebook/Stats/Settings),
   mobile bottom bar. LoginScreen per DESIGN.md §8 (functional, styled).
4. `audio/tts.ts` + `audio/stt.ts` capability detection + minimal working wrappers (a
   "test voice" button on the Settings stub proves ja-JP TTS works).

## Acceptance
- [ ] `uvicorn app.main:app --port 8100` + `npm run dev` → login with real Mishka creds
      succeeds (Mishka server running); wrong password → styled error; Mishka down → the
      503 copy from AUTH.md.
- [ ] Session survives reload; logout works; Mishka's own web session unaffected.
- [ ] All AUTH.md §5 criteria that don't require later phases.
- [ ] Dark/light toggle repaints every visible surface; tabs navigate; typecheck + pytest
      green (paste output).
- [ ] Settings stub speaks "こんにちは、ミチです" via ja-JP TTS on click.
