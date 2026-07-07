# Michi — working notes for Claude

Two-person Japanese-learning app (trip: mid-Sept 2026). **docs/ is the spec and it wins** —
read PLAN.md first, then the doc for whatever you're touching. Phases and owners live in
docs/PLAN.md; current build state in docs/HANDOFF.md.

## Commands

```
apps/server: .venv/bin/python -m pytest -q          # must stay green
             .venv/bin/uvicorn app.main:app --port 8100
apps/web:    npm run typecheck && npm run build     # must stay green
python3 apps/server/scripts/validate_content.py     # content gate — its output IS the content TODO list
```

Preview servers are in the shared `~/…/Dev/.claude/launch.json` as `michi-web` (5174) +
`michi-api` (8100). Mishka Hub owns 5173/8000 — never take those ports.

## Hard rules

- **No passwords in this repo, ever** — login proxies to Mishka Hub (docs/AUTH.md). If you
  find yourself adding argon2/password columns, stop; you've misread the design.
- **Colours**: only semantic tokens (`bg-paper`, `text-clay`, …). Values live in
  `apps/web/src/theme.css` (the shared "Aizome" palette, canonical here, mirrored to
  MishkaHub — see `.claude/skills/theme-sync`). Never hardcode a hex in a component.
- Content ids are permanent (SRS rows reference them) — never rename an item id.
- British English microcopy, calm tone, no exclamation marks, no red-alert guilt UI.
- Commit prefix `phase-N:`; run pytest + typecheck before every commit.

## Gotchas (paid for, don't re-pay)

- `current_user` dependency returns an **int user id**, not a User object.
- An `<svg>` nested inside another SVG ignores CSS class sizing — pass explicit
  `width`/`height` attributes (MichiMark already supports this).
- `content.py` caches with `lru_cache` — a running server won't see content edits until
  restart (fine in dev: uvicorn --reload restarts on .py changes only, so touch a .py or
  bounce it).
- Tailwind v4: palette lives in an imported `theme.css` `@theme` block; the `.dark`
  overrides are in the same file. Michi-only tokens (`--color-trail*`, `--path-node*`,
  fonts, radii) stay in `index.css`.
- To see the authenticated app without real credentials: mint a session
  (`.claude/skills/michi-verify` has the snippet). `?mock` on the URL dresses Path/Stats
  with fake progress, client-side only.
