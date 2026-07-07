# Phase 5 — The Path & Stats (owner: **Fable**, by household request)

The signature surfaces, built by the orchestrator directly: `PathPage.tsx`,
`PathScene.tsx` (SVG trail, nodes, torii, landmarks, cat + partner ghost cat, summit
meter, unit headers/sheets), lesson-complete path-reveal + walk animation, torii
checkpoint moment, `StatsPage.tsx` (hero tiles, week chart, strength garden, buddy panel,
forecast sparkline), and the final `MichiMark` (bindle cat) + favicon export.

Spec: DESIGN.md §5, §6, §7 — authoritative and already detailed; no re-design latitude
needed. Data: `GET /api/curriculum/manifest` and `GET /api/stats/*` (API.md).

## Acceptance
- [ ] DESIGN.md §9 boxes 3, 5, and the motion rows of §7.
- [ ] 60fps path scroll on a mid-range phone profile; reduced-motion clean.
- [ ] Torii moment fires exactly once per checkpoint completion.
