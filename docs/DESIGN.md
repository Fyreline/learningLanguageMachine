# Michi — Design System

> **Palette superseded 2026-07-07 — "Aizome".** The household moved off the
> Anthropic-derived hues to its own woodblock-print palette (hanko crimson
> #c33c54, Hokusai indigo #254e70, steel #37718e, cyan #8ee3ef, mint #aef3e7).
> Canonical values: `apps/web/src/theme.css` (shared with MishkaHub via
> `scripts/sync-theme.sh`). **Token names below are unchanged and still law**
> (`clay` = the crimson accent now); every structural/component/motion spec in
> this doc stands. Read colour *values* from theme.css, everything else from here.

Michi inherits Mishka Hub's visual contract wholesale — **Anthropic's editorial warmth:
calm ivory surfaces, near-black ink, one clay accent, hairline borders instead of shadows,
generous whitespace** — and swaps Mishka's poster density for Michi's own signature
surfaces: the winding Path, the audio-first lesson stage, and a stats room that feels like
a travel journal rather than a dashboard. Where Mishka Hub is a cinema lobby, Michi is a
walking trail.

Source of truth for the inherited layer: `Dev/MishkaHub/docs/DESIGN.md` §1 (tokens are
Anthropic-verified) and the shipped `Dev/MishkaHub/apps/web/src/index.css` (which includes
the dark-mode block — copy from the *shipped file*, not the doc, it's newer).

## 1. What is inherited verbatim

- **Full colour palette**, light and dark: `paper/paper-mid/paper-deep`, `ink/ink-mid/
  ink-soft`, `line/line-strong`, `clay/clay-deep`, `kraft`, `oat`, `cloud`, `olive`, `sky`,
  `fig` — exact values from Mishka's shipped `index.css`, including the `.dark` block and
  `@custom-variant dark` mechanism, and the `liquid` sand tone (Michi reuses it as the
  path-trail fill).
- **Type stacks**: display `"Schibsted Grotesk"…`, serif accent `"Source Serif 4"…`, body
  `"Inter"…`, mono `"JetBrains Mono"…`. Same scale, same sentence-case discipline, same
  tiny tracked mono labels (`STREAK 12`, 11–12px, +0.08em).
- **Radii** (4/8/16/full), **spacing scale**, **borders-not-shadows elevation**, container
  `max-width: 72rem`.
- **Component specs**: primary/accent/secondary/ghost buttons, inputs, cards, pills, toast,
  nav bar, empty states — Mishka DESIGN.md §1e applies unchanged.
- **ThemeToggle** behaviour (localStorage `michi-theme`, OS default on first visit).
- **Voice**: Anthropic-calm, British English, no exclamation-mark cheerleading. Michi is
  *encouraging without being a golden retriever*: "Nice — that one's sticking." not
  "AMAZING!! 🎉".

## 2. Michi-specific tokens (append to the inherited `@theme`)

```css
@theme {
  /* …all Mishka tokens first (light), .dark block after, then: … */

  /* Japanese text. Noto Sans JP self-hosted (variable, weights 400–700);
     Hiragino fallbacks are what macOS/iOS ship anyway. */
  --font-jp: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN",
             "Yu Gothic", sans-serif;

  /* path scene */
  --color-trail: #dcc9ab;        /* = Mishka's `liquid` sand; the walking trail */
  --color-trail-done: #788c5d;   /* olive — the ground you've covered */
  --path-node: 56px;             /* lesson node diameter */
  --path-node-gate: 72px;        /* unit checkpoint (torii) size */

  /* exercise feedback — reuse semantics, no new hues:
     correct = olive, close = kraft, incorrect = fig (never a harsh red) */
}
.dark {
  --color-trail: #3f3a31;        /* Mishka's dark `liquid` */
  --color-trail-done: #9bb17c;   /* dark olive */
}
```

Japanese typography rules:

- Kana/kanji render in `--font-jp`, **larger than the surrounding UI**: main answer line
  30–38px, tiles 20–24px. Japanese needs air — line-height ≥1.4, never letter-spaced.
- Furigana via real `<ruby>` elements (`<ruby>水<rt>みず</rt></ruby>`), `rt` at 50%,
  `ink-soft`.
- Romaji is always `--font-sans` italic `ink-soft`, physically *below* the kana — the eye
  should meet Japanese first, and the romaji line can fade out as a per-user setting
  (Settings: romaji **show / fade after first exposure / hide**).

## 3. App shell & navigation

Sticky header, `bg-paper/95`, 1px `border-line` bottom — same skeleton as Mishka. Left:
the **MichiMark** — Mishka's two-eared cat silhouette sat inside a torii gate (variant
`torii`; the bare `cat` variant walks the Path scene; `currentColor` so it follows clay and
theme; also exported flat to `public/michi-icon.svg` with hardcoded colours for the
favicon; superseded the bindle 2026-07-07 by household request) — then "Michi" in
`font-display` with 道 in clay after it. Right: streak pill
(mono, flame replaced by a paw print 🐾 rendered as an inline SVG, count in clay), theme
toggle, user avatar dot (user 1 = clay, user 2 = sky — same assignment as Mishka Hub).

Tabs (desktop: header-inline; mobile: bottom bar, 5 items, 64px tall, safe-area padded):
**Path · Practice · Phrasebook · Stats · Settings**. Active tab: ink text + 2px clay
underline (desktop) / clay icon + label (mobile). Lesson player opens as a full-screen
takeover (no tabs — a single quiet ✕ top-left, progress bar top-centre).

## 4. The lesson stage (exercise UI)

One exercise at a time, centred column max 40rem, generous top padding. Anatomy, top to
bottom:

1. **Progress bar** — 4px track `paper-deep`, fill `clay`, springs (motion) toward the new
   value on every answer; hearts/lives do **not** exist (nothing to lose — pacing is the
   pressure, not punishment).
2. **Prompt line** — small `ink-soft` sentence: "Listen, then pick the meaning" /
   "Say it aloud".
3. **The stage** — the audio button and/or Japanese text:
   - **Audio button**: 88px circle, `bg-clay text-paper`, speaker glyph, springs to 0.95 on
     press; a subtle sound-wave ring animates while TTS speaks. Beside it a 44px
     **turtle button** (`bg-paper-mid border-line`, 🐢 as SVG): replays at rate 0.65.
     Auto-plays once when the exercise mounts (never re-steals focus).
   - **Japanese line** per §2 typography, with furigana where the item has kanji.
4. **The response area** — varies by exercise type (CURRICULUM.md §4): choice cards
   (2×2 grid, `bg-paper-mid border-line rounded-lg`, hover `border-line-strong`, selected
   `border-clay` + clay ring), word tiles (chips `rounded-md bg-paper-mid border-line`,
   drag or tap-to-place into a `border-dashed` answer row; motion springs on reorder), mic
   button (same 88px circle in `ink`; pulses `clay` while listening; live transcript
   appears beneath in `--font-jp`).
5. **Feedback strip** — slides up from the bottom (spring, 250ms): correct = `bg-olive/15`
   with `text-olive` "そう！ That's it." + the full answer with furigana + romaji;
   incorrect = `bg-fig/10 text-fig` "Not quite —" + correct answer + a **"listen again"**
   inline replay; close (speech) = `bg-kraft/20` "Close — one more try?" with both
   transcripts diffed (matched mora in ink, missed in fig). Continue = full-width primary
   button inside the strip. **The strip never auto-advances** — the learner controls tempo
   (this is the anti-Pingo principle in pixels).
6. **"I know this" escape hatch** — quiet ghost link bottom-right of every *teach* card and
   first-drill of a new item ("Skip — I know this one"), per CURRICULUM.md §5. Never shown
   on review reps.

Teach cards (new item introduction): `bg-paper-mid rounded-lg border-line p-8`, item at
38px kana with furigana, romaji below, English meaning in serif accent, auto-played audio,
a one-line usage note in `ink-soft` ("Drop the お when it's your own tea."), mnemonic if
the item has one. Buttons: "Got it" (primary) / "Skip — I know this" (ghost).

## 5. The Path (home) — Michi's signature surface

**Concept: one continuous walking trail from the household's front door to the summit of
Mt. Fuji.** Units are stretches of trail; lessons are paw-print stepping stones; each unit
ends at a **torii gate** checkpoint. The cat (MichiMark, walking pose) stands on the
current node. Behind/around the trail, sparse flat-colour landmarks mark progress through
the course: front door → tenement street (Scotland) → plane → Tokyo skyline silhouette →
shinkansen → torii avenue → onsen town → Mt. Fuji. All illustration is **flat SVG in
palette colours only** (kraft/oat/olive/sky/cloud shapes on paper, clay accents) — the
Anthropic-brand rule "warmth from restraint" applies; no gradients, no clipart, ≤3 colours
per landmark.

Layout & mechanics:

- Vertical scroll, newest at top? **No — the path ascends**: page loads scrolled to the
  cat's current position; Fuji is up (scroll up = future), the front door is at the bottom
  (scroll down = past). Elevation = progress, and "how far we've come" is literally
  looking back down the hill.
- The trail is a single SVG `<path>` (~S-curves, amplitude ±120px around centre column,
  one lesson node every ~140px of arc length). Two strokes: full trail in `--color-trail`
  (14px, round caps), and an overlaid partial stroke in `--color-trail-done` drawn with
  `stroke-dasharray`/`dashoffset` up to the cat — completing a lesson animates the olive
  stroke growing (800ms ease-out) and the cat walking (x/y along the path via motion,
  little vertical bob) to the next node.
- **Node states**: done = olive fill, paper paw-print glyph, tap replays lesson (relaxed
  practice mode); current = clay fill, breathing halo (scale 1→1.06, 2s loop, disabled on
  reduced-motion), cat standing on it; available-next = paper fill, `border-line-strong`,
  clay paw outline; locked = `paper-deep` fill, `cloud` paw, not tappable (tooltip:
  "Finish the trail behind you first").
- **Stars**: each done node wears 1–3 tiny clay stars (lesson score ≥60/80/95) hung under
  it, mono-sized.
- **Torii checkpoints**: 72px torii gate SVG in clay (dark-mode: lifted clay); locked =
  cloud. Passing one triggers the single most celebratory moment in the app: the gate's
  crossbeam draws itself (SVG stroke animation), a 1.5s paper-confetti of palette-coloured
  rectangles (≤12 pieces, physics via motion, skipped on reduced-motion), and a serif line
  ("Unit 4 — you can now order dinner in Japanese."). Then calm again.
- **Unit headers** float beside their trail stretch: mono kicker (`UNIT 4 · RESTAURANT`),
  display title ("Ordering food"), 1-line summary, and a phrase-count chip. Tapping opens
  the unit sheet (lesson list with scores, unit vocab preview, "practice this unit" button).
- **The summit**: Fuji with a tiny flag; under it the **trip-readiness meter** — a
  horizontal `paper-deep` track with clay fill showing % of the *Trip Core* item set
  mastered (CURRICULUM.md §7), captioned in mono: `TRIP-READY 62% · 41 DAYS TO GO`
  (days until 2026-09-15, computed client-side).
- **Two cats**: the partner's position shows as a small ghosted cat in `sky` at their
  current node (read from `/api/stats/household`) — presence, not competition. Tooltip:
  "Amy is here."
- Performance: the scene is one SVG; nodes are `<g>` buttons; virtualize nothing (≤120
  nodes), but memoize the path geometry. Initial scroll via `scrollIntoView({block:
  'center'})` on the current node, instant (no animation) on load.

## 6. Stats — the travel journal

Four zones on one scrolling page (cards `bg-paper-mid border-line rounded-lg p-6`):

1. **Hero strip** — three stat tiles: **streak** (paw-print + mono count + "day streak";
   flame-anxiety copy banned — a missed day shows "streak resting", and one *rest day per
   week is free*, CURRICULUM.md §8), **words & phrases known** (count of items at
   strength ≥ 3), **minutes practiced** (total, mono). Numbers 38px mono; labels 12px
   tracked caps.
2. **The week** — 7-column bar chart (pure SVG, no chart lib): XP per day, bars `clay`
   (today `clay-deep`), `paper-deep` baseline for empty days, mono day letters. Height 96px.
   A dashed `olive` line marks the daily goal.
3. **Strength garden** — items-by-strength as five horizontal bands (seedling → blossom:
   strength 0–4), each band a count + a row of tiny dots (one per item, capped at 60 with
   "+n"); tapping a band opens those items in the Phrasebook filtered. Colours: cloud →
   kraft → oat-border → olive → clay. Caption: "Reviews water them. 12 due today."
4. **Travel buddies** — two-column card: each partner's avatar dot, streak, words known,
   path position ("Unit 5 · Trains"); a shared line at the bottom — "Together you know
   214 phrases." Kind by design: no leaderboard framing, deltas never negative-coloured.

Review forecast (next 7 days of due counts) renders as a mini sparkline row under the
strength garden, mono counts, `sky` bars.

## 7. Motion & sound inventory

| Moment | Spec |
|---|---|
| Correct answer | feedback strip springs up (stiffness 400, damping 30); choice card border flashes olive; tiny paw-print stamps beside the answer (scale 0→1 spring, 1 per session position) |
| Wrong answer | stage shakes horizontally ±6px, 2 cycles, 180ms total (skip on reduced-motion — colour alone carries it) |
| Lesson complete | full-screen takeover: big score, stars punch in one-by-one (spring, 80ms stagger), XP counter counts up (mono), then the path is revealed behind with the cat walking to the next node |
| Torii checkpoint | §5 confetti + gate-draw |
| TTS speaking | audio button's ring pulses at 1Hz, `clay/25` |
| Mic listening | mic circle pulses `clay`, live transcript fades in word-by-word |
| Streak tick | header paw pill does one small hop (translateY -3px spring) on first XP of the day |
| Reduced motion | all of the above collapse to ≤150ms opacity; path cat teleports; confetti skipped entirely |

Sound: **TTS only.** No dings, no chimes — feedback is visual + the natural rhythm of
hearing Japanese. (Speech is the app's sound design.)

## 8. Login screen

Port Mishka's `LoginScreen.tsx` styling: centred card on `paper`, MichiMark large in clay,
serif welcome line — "The path to Japan starts with sumimasen." — email + password inputs
per the inherited input spec, primary button "Set off". Error styling identical to
Mishka's. Small `ink-soft` footnote: "One household login — same email and password as
Mishka Hub."

## 9. Acceptance criteria

- [ ] Every colour on every screen resolves to a token; clay is the only saturated accent
      per view; dark mode repaints everything via the `.dark` token block with no `dark:`
      class hunting.
- [ ] Japanese text renders in Noto Sans JP (self-hosted, no CDN fetch at runtime), with
      real `<ruby>` furigana; romaji setting (show/fade/hide) works and persists.
- [ ] The Path: loads centred on the current node; completing a lesson animates trail-fill
      + cat walk; node states/stars/torii/summit meter all render per §5; partner's ghost
      cat appears when the other account has progress.
- [ ] Lesson stage: audio auto-plays once, turtle replay at 0.65 rate, feedback strip never
      auto-advances, "I know this" appears exactly where §4.6 says and nowhere else.
- [ ] Stats page matches §6 (all pure SVG, no chart library in package.json).
- [ ] `prefers-reduced-motion`: zero springs/shake/confetti; app fully usable.
- [ ] Lighthouse a11y ≥ 95 on Path, Lesson, Stats: focus rings everywhere, exercises fully
      keyboard-operable (tiles via arrow keys + space), TTS buttons have aria-labels, live
      regions announce feedback.
