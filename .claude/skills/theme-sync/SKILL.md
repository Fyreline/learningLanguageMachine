---
name: theme-sync
description: Edit the shared Aizome colour palette and keep Michi + MishkaHub in step. Use when changing site colours, adding a colour token, fixing dark-mode contrast, or when the two apps' themes have drifted.
---

# The shared Aizome palette

One palette, two apps. Canonical file: `apps/web/src/theme.css` **in this repo**; mirror:
`/Users/mack/Documents/Dev/MishkaHub/apps/web/src/theme.css`. Both apps' `index.css`
import it; every component styles itself with the semantic utilities (`bg-paper`,
`text-ink`, `border-line`, `bg-clay`, …).

Palette story (keep it coherent when editing): Japanese woodblock print — washi paper
with a mint cast, indigo ink (#254e70 family), **hanko-crimson #c33c54 as the single
accent** (token still named `clay` for historical compat), steel-blue `sky` for
info/partner, teal `olive` for success, plum `fig` for soft errors. Dark mode is a "night
print": deep indigo ground (#0f1d2b), cyan #8ee3ef takes the lead role. Base hexes chosen
by the household: C33C54 · 254E70 · 37718E · 8EE3EF · AEF3E7.

## Rules

1. **Change values, never names.** Both codebases' markup depends on the token names.
2. Edit the canonical copy here, then run `scripts/sync-theme.sh` (plain `cp` + verify).
3. Light AND dark: every token has a `.dark` override in the same file — edit both or
   contrast rots. Check: accent-on-paper and paper-text-on-accent ≥ ~4.5:1.
4. Michi's `--color-trail`/`--color-trail-done` in `index.css` shadow `liquid`/`olive` —
   keep them in step when those change.
5. Favicons (`public/michi-icon.svg` here, `public/cat-icon.svg` in MishkaHub) hardcode
   the accent + paper hexes — update them on any accent/paper change.
6. After syncing: build BOTH apps (`npm run build`), then commit both repos (Mishka
   message: `theme: …`, this repo: `theme: …`).
