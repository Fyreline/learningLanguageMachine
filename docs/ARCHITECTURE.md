# Michi — Architecture

The shape deliberately mirrors Mishka Hub (`Dev/MishkaHub`): a Vite/React SPA talking JSON
to a local FastAPI + SQLite backend, deployed the same way (static web on GitHub Pages or
served locally; API on the household machine behind Cloudflare Tunnel). Anyone who has
worked on Mishka Hub can navigate this repo blind.

## 1. Repo layout

```
learningLanguageMachine/
├── README.md
├── docs/                      # you are here — the spec that drives implementation
│   └── phases/                # per-phase build orders with acceptance criteria
├── apps/
│   ├── web/                   # Vite + React 19 + TypeScript + Tailwind v4 + motion
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.ts     # dev server port 5174 (Mishka web owns 5173)
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx        # route switch + nav shell + auth gate
│   │       ├── index.css      # Tailwind @theme tokens (DESIGN.md §2)
│   │       ├── auth.ts        # PORT of MishkaHub apps/web/src/auth.ts, key renamed
│   │       ├── api.ts         # fetch wrapper w/ bearer token + 401 retry (port of Mishka's)
│   │       ├── audio/
│   │       │   ├── tts.ts     # speechSynthesis wrapper (ja-JP voice pick, rate, queue)
│   │       │   └── stt.ts     # SpeechRecognition wrapper + graceful capability detection
│   │       ├── curriculum/
│   │       │   ├── types.ts   # Item, Lesson, Unit, Exercise types (CONTENT_GUIDE.md §2)
│   │       │   └── loader.ts  # fetches manifest + lesson JSON, caches in memory
│   │       ├── engine/
│   │       │   ├── session.ts # lesson session builder (CURRICULUM.md §5 pacing rules)
│   │       │   ├── grading.ts # answer normalization + speech similarity scoring
│   │       │   └── srs.ts     # client-side mirror of interval math for forecast display
│   │       └── components/
│   │           ├── LoginScreen.tsx
│   │           ├── PathPage.tsx        # the journey (Fable-built, DESIGN.md §5)
│   │           ├── PathScene.tsx       # SVG path + nodes + cat (Fable-built)
│   │           ├── LessonPlayer.tsx    # exercise runner shell
│   │           ├── exercises/          # one component per exercise type (CURRICULUM.md §4)
│   │           ├── PracticePage.tsx    # SRS reviews + free drills
│   │           ├── KanaTrainer.tsx
│   │           ├── PhrasebookPage.tsx
│   │           ├── StatsPage.tsx       # (Fable-built, DESIGN.md §6)
│   │           ├── SettingsPage.tsx
│   │           └── ThemeToggle.tsx     # straight port from Mishka
│   └── server/                # FastAPI
│       ├── requirements.txt   # fastapi, uvicorn, sqlalchemy, pydantic-settings, pyjwt, httpx
│       ├── app/
│       │   ├── main.py        # app factory, CORS, routers, static curriculum mount
│       │   ├── config.py      # env prefix MICHI_ (see §4)
│       │   ├── db.py          # engine/session helpers (port of Mishka's)
│       │   ├── models.py      # DATA_MODEL.md
│       │   ├── security.py    # JWT access + rotating refresh tokens (port of Mishka's,
│       │   │                  #   MINUS password hashing — Michi never sees a hash)
│       │   ├── auth.py        # current_user dependency
│       │   ├── identity.py    # the Mishka Hub identity client (AUTH.md §3)
│       │   ├── srs.py         # SM-2-lite scheduler (CURRICULUM.md §6)
│       │   └── routers/
│       │       ├── auth.py    # login (proxied verify) / refresh / logout / me
│       │       ├── curriculum.py  # manifest + lesson content
│       │       ├── progress.py    # lesson completions, path state
│       │       ├── reviews.py     # due queue + submissions
│       │       ├── stats.py       # me + household
│       │       └── health.py
│       └── scripts/           # nothing needed at v1 (no set_password — see AUTH.md)
├── data/                      # gitignored runtime data: michi.db
└── content/
    ├── manifest.json          # course map: units → lessons (ids, titles, icons)
    ├── units/u01-.....json    # one file per unit: items + lesson exercise scripts
    └── kana/hiragana.json, katakana.json
```

## 2. How the pieces talk

```
 browser SPA (5174)
   │  POST /api/auth/login (email+pw) ─────────► Michi server (8100)
   │                                                │ POST /api/auth/login  ──► Mishka Hub
   │                                                │ (verify only, AUTH.md)     server (8000)
   │  ◄─ Michi access(15m) + refresh(30d) tokens ◄──┘
   │
   │  GET /api/curriculum/manifest, /lessons/{id} ──► server reads content/*.json
   │  POST /api/lessons/{id}/complete ──────────────► progress + SRS writes to michi.db
   │  GET  /api/reviews/due, POST /api/reviews ─────► SRS queue
   │  GET  /api/stats/me, /api/stats/household ─────► aggregates for StatsPage
   │
   └─ speechSynthesis / SpeechRecognition — entirely in-browser, no audio ever
      leaves the device and no external TTS/STT API is called. Zero audio cost,
      works offline once the page is loaded (except grading writes).
```

Decisions worth stating:

- **Content ships as static JSON in the repo**, versioned like code, served by the API
  (`content/` mounted read-only). No CMS, no DB rows for curriculum. Progress references
  items by stable string ids (`CONTENT_GUIDE.md §1`), so content edits never migrate the DB.
- **Audio is the browser's job.** `speechSynthesis` with a `ja-JP` voice (macOS/iOS ship
  Kyoko + friends; Chrome ships Google 日本語). No ElevenLabs/Polly dependency, no keys, no
  latency. `stt.ts` uses `webkitSpeechRecognition` where present (Chrome/Edge); elsewhere
  speaking exercises degrade to shadow-mode (CURRICULUM.md §4.8). Capability detection at
  startup, surfaced in Settings.
- **Ports:** Mishka server owns 8000 and web 5173; Michi takes **8100 / 5174** so both run
  side-by-side on the household machine.
- **The two servers share a machine, not a database.** Michi's only dependency on Mishka
  Hub is the identity call at login (AUTH.md). Michi's own SQLite (`data/michi.db`) holds
  progress only.

## 3. Frontend conventions (inherited from Mishka Hub)

- React 19 function components, no state library — module-level stores with subscribe/notify
  (see Mishka's `auth.ts` pattern) for auth and session; React state for the rest.
- `api.ts` wraps fetch: attaches bearer token via `getValidAccessToken()`, retries once on
  401 after a forced refresh, calls `forceLogout()` on second 401.
- Tailwind v4 utilities against the `@theme` tokens only — a colour that isn't a token is a
  review-blocker. Dark mode via the same `.dark` class-variant mechanism as Mishka.
- `motion` for springs (path cat movement, tile physics, correct/incorrect feedback).
  Everything gated on `useReducedMotion()`.
- British English microcopy, Anthropic-calm tone (DESIGN.md §7).

## 4. Server conventions

- Settings via pydantic-settings, env prefix `MICHI_`, `.env` in `apps/server/`:
  - `MICHI_JWT_SECRET` (32+ random bytes; independent from Mishka's secret)
  - `MICHI_MISHKA_BASE_URL` (default `http://127.0.0.1:8000`)
  - `MICHI_CORS_ORIGINS` (defaults: `http://localhost:5174`, `http://127.0.0.1:5174`,
    `https://fyreline.github.io`)
  - `MICHI_DATABASE_URL` (default `sqlite:///<repo>/data/michi.db`)
  - `MICHI_ACCESS_TOKEN_TTL_MINUTES=15`, `MICHI_REFRESH_TOKEN_TTL_DAYS=30`
- Error shape: `{"detail": str, "code": str}` — same `MishkaHTTPException` pattern, renamed
  `MichiHTTPException`.
- SQLAlchemy 2.x mapped-column style, tables created on startup (SQLite; alembic only if a
  breaking change ever demands it — progress data is precious but small).
- Timestamps stored as UTC `"%Y-%m-%d %H:%M:%S"` strings, matching Mishka's convention.

## 5. Deployment (mirrors Mishka Hub's DEPLOYMENT.md)

- Web: `npm run build` → GitHub Pages (`https://fyreline.github.io/learningLanguageMachine/`)
  with `VITE_API_BASE` pointing at the tunnel hostname; **or** just run both locally.
- API: uvicorn on 8100, loopback-only, exposed via the existing Cloudflare Tunnel with a new
  hostname route (e.g. `michi-api.<domain>`); the tunnel terminates TLS exactly as Mishka's
  does, so `X-Forwarded-For` remains trustworthy for the login rate limit.
- Vite config sets `base: '/learningLanguageMachine/'` for Pages builds (env-gated, same
  trick as Mishka).

### 5b. The shipped runbook (live since 2026-07-07, all tested)

- **API, always on**: LaunchAgent `~/Library/LaunchAgents/com.michi.api.plist`
  (mirrors Mishka's) runs uvicorn on 127.0.0.1:8100 at login, KeepAlive, logs in
  `~/Library/Logs/michi/`. Manage with
  `launchctl kickstart -k gui/$UID/com.michi.api` (restart) /
  `launchctl bootout gui/$UID/com.michi.api` (stop).
- **Tunnel**: `michi-api.mishka-hub.com` ingress in `~/.cloudflared/config.yml`
  → 127.0.0.1:8100, DNS CNAME routed to the shared tunnel. cloudflared is a
  root LaunchDaemon: config changes need
  `sudo launchctl kickstart -k system/com.cloudflare.cloudflared`.
- **Web**: GitHub Pages via `.github/workflows/deploy-pages.yml` on every push
  to main touching `apps/web/**` or `content/**`; repo variable
  `VITE_API_BASE=https://michi-api.mishka-hub.com` baked in at build. Live at
  https://fyreline.github.io/learningLanguageMachine/.
- **CORS**: `https://fyreline.github.io` is in the server's default allow-list
  (config.py); verified end-to-end through the tunnel.

## 6. Testing & verification bar

- Server: pytest for `identity.py` (Mishka up / down / bad password), `srs.py` interval
  math, and the auth router (login/refresh/rotate/reuse-tripwire) using a stubbed identity
  client. Target: the auth + SRS test suites pass before any UI work lands on top.
- Web: `npm run typecheck` clean; grading (`grading.ts`) unit-tested with vitest (kana
  normalization, mora similarity thresholds).
- End-to-end gate before "done": login with real Mishka Hub creds → complete lesson 1 with
  audio → see path node fill + stats move → reviews due next day (clock-forged in test).
