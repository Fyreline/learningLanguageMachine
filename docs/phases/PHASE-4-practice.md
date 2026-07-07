# Phase 4 — Practice, Phrasebook, Settings, placement (owner: Sonnet)

Reuses Phase 3's exercise components wholesale — this phase is composition, not new
mechanics.

1. **PracticePage**: due-review session (GET /api/reviews/due → session of ≤20, weakest
   first, production-biased for strength ≥3); free drills — listening drill, speaking
   drill, **lightning review** (the app's only timed mode, labelled); due-count badge on
   the tab (cap "20+", clay, never red).
2. **KanaTrainer**: the kana trail lessons via `kana-glyph` exercises + a reference grid
   (tap any kana → hear it), progress ticks on the Path's spur (Phase 5 renders the spur;
   this phase persists completions like normal lessons).
3. **PhrasebookPage**: all items grouped by unit, search (matches jp/romaji/en), tag filter
   chips, strength dot per item, tap-to-speak on every row, trip-core section pinned top
   ("The 120 that matter"). Works offline-ish from the loaded manifest cache.
4. **SettingsPage**: romaji mode, TTS rate slider (0.7–1.1) + test button, daily goal,
   trip date picker, STT mode display/override, theme, logout, "about this app" footer
   with the Mishka-family credit.
5. **Placement probe** (CURRICULUM §5) at first login: modal offer → 12-step adaptive run
   → POST /api/placement/complete → path pre-completion; "start from the beginning" skip.

## Acceptance
- [ ] Reviews round-trip SRS correctly; badge counts match `/api/reviews/due`.
- [ ] Phrasebook search finds "sumimasen", "すみません", and "excuse" identically; every
      row speaks.
- [ ] Settings persist via PUT /api/auth/settings and apply live (romaji fade, rate).
- [ ] Placement: a run answering only u01 items correctly pre-completes only u01 lessons.
- [ ] typecheck green; no new dependencies.
