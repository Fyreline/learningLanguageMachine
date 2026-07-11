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
  --color-trail: #c5e0dd;        /* = the shared `liquid` mint; the walking trail */
  --color-trail-done: #2e8b74;   /* olive — the ground you've covered */
  --path-node: 56px;             /* lesson node diameter */
  --path-node-gate: 72px;        /* unit checkpoint (torii) size */

  /* exercise feedback — reuse semantics, no new hues:
     correct = olive, close = kraft, incorrect = fig (never a harsh red) */
}
.dark {
  --color-trail: #2b4a5e;        /* lifted vs the dark `liquid` so the trail reads */
  --color-trail-done: #5fcfae;   /* dark olive */
}
```

(Values above mirror the shipped `index.css`; if they ever disagree, the CSS wins —
the palette story lives in `theme.css` and `docs/HOUSEHOLD-DESIGN.md`.)

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

## 5b. The Mountain revision (shipped 2026-07-07, household request)

§5's flat trail became a full mountain ascent — **the whole page is the mountain**
(`PathScene.tsx` + `PathScenery.tsx`; sky/night tokens in `index.css`):

- **Altitude t ∈ [0,1]** (door→summit) drives everything by lerp — *no hard biome
  boundaries anywhere*: sky gradient (`--path-sky-low/mid/high/night`), sprite mix
  (pines/bushes/grass fade out by t≈0.55; rocks ramp 0.15–0.65; stone tōrō 0.45–0.75;
  cloud band centred t≈0.68; chōchin lanterns, decorative mini-torii and stars own
  0.75→1), and winding — accumulated-phase sine whose frequency (0.52→1.02 rad/node)
  and amplitude (102→140) grow with progress: switchbacks tighten toward the peak.
- **The summit is night in both themes**, so two non-flipping tokens
  (`--color-night-ink/soft`) carry upper-mountain text; unit headers flip above
  t≈0.62 (`NIGHT_LINE`). Clouds are moonlit `night-ink`, never `paper`.
- **Summit = goraikō**: rising sun behind a silhouette torii (`SummitScene`) with the
  trip-ready meter beneath — replaced the Fuji illustration (you're *on* Fuji now).
- **Parallax** (motion `useScroll`): far ridges ×0.16, cloud band ×0.07, foreground
  wisps ×−0.06 (they pass in front of the trail — you climb *through* them); ridges
  are placed pre-compensated (`y·(1−f)+f·300`) so they align where they belong.
  Ambience loops (cloud drift, star twinkle, lantern sway) are scoped CSS keyframes.
  Everything — parallax and loops — sits behind `prefers-reduced-motion`.
- **Determinism**: all placement is fract-sin hashed by index — the mountain is a
  place, not a screensaver; it never reshuffles between visits.

**Full-bleed amendment (same day):** the scene now escapes its column
(margin breakout, `w-screen` — deliberately no transform) and spans the full
page on every device, with a responsive unit width (`W = clamp(420, pageW/1.2,
920)`, seeded from `window.innerWidth`) so nodes render finger-sized
everywhere. A converging **mountain body** (`bodyHalfAt`: wider than the page
at the base → narrow crest, always ≥ the trail's swing) carries a
meadow→stone→volcanic-dusk gradient (`--path-ground-*`; stop-color set via
style — as an attribute, `var()` silently paints black) and occludes
stars/ridges/clouds behind it for depth; the trail's amplitude now *shrinks*
into the crest while frequency doubles, landing the last node on the peak.
Hard-won rendering rules: (1) no transformed element may span the whole scene
— band-limit every parallax layer to its content's altitude range (Chromium
composites transformed elements and squashes overlapping siblings into
textures with a hard device-pixel budget); (2) the scene renders in stacked
segment `<svg>`s (~1600 units each), body/trail drawn in every segment and
clipped by its viewBox; (3) `overflow: clip` on the wrapper, or scrolling
parallax offsets grow the document with phantom pixels; (4) headless
screenshot tooling whites out beyond ~16384 device px of page height — deep
regions must be verified in a real browser or at narrow widths, not declared
broken (a full afternoon says hello).

## 5c. The kitsune walker — history and the current (v4) design

Went through four passes in one day (2026-07-08):

- **v1**: standing-bipedal, Duolingo-owl-proportioned. Direct feedback: "more
  like a red panda than anything else."
- **v2**: Duo/Kiriko eye construction (white oval, the head's own colour
  dipping over the rim as the brow, black pupil, catchlight) + sitting-cat
  posture. Same red-panda feedback persisted — round teddy ears, a round
  muzzle patch, pupils too large relative to the white all still read wrong.
- **v3** (same session, unshipped): tried fixing v2's issues with taller
  ears, a tapered face, and a single continuous sitting silhouette. Closer,
  but still Fable's own illustration, not what the household actually
  wanted.
- **v4 (shipped, current)**: replaced entirely with **the household's own
  hand-designed kitsune**, built in Claude Design — a sticker-style sitting
  spirit-fox with a white outline (SVG `feMorphology` dilate technique).
  Design source: https://claude.ai/design/p/c513c49a-0c9e-4a70-9c1c-8e0a7064f7f2
  `AnimatedKitsune.tsx`'s geometry is verbatim from that design except one
  repair — a path in the pasted source was truncated mid-coordinate (almost
  certainly a copy/paste cut-off); it was closed with a plausible endpoint,
  flagged in the file's header comment as a guess rather than original data.

**Tone**: the source art is one fixed cyan illustration (six flat shades +
a dark ink for the brows/nose/mouth). Recolouring per selectable tone
(clay/sky/teal/plum/cyan) is a CSS `hue-rotate` filter chained onto the
artwork's own sticker-outline filter — `filter: url(#sticker)
hue-rotate(Ndeg)` — with degrees computed from each tone's actual hue
relative to the art's native ~186° cyan (via `colorsys`, not eyeballed).
`cyan` is a 0° no-op — the art as designed. This preserves every hand-tuned
shade in the source art rather than requiring six-shades-×-five-tones of
manual recolouring, at the cost of the hue-rotated tones staying as
low-saturation/pastel as the source cyan rather than matching the UI's
vivid clay/sky/etc — a real trade-off, not hidden: worth a look together
before calling it final. `PALETTE` (flat swatch hex for Settings' picker
and the Stats buddies-panel dot) is unchanged from v2/v3 — those consumers
only ever needed one representative hex per tone, not the recolour
mechanism itself.

**Animation** (transforms only, no new geometry — everything behind
prefers-reduced-motion): the tail (household-requested) **flicks upward**
on a loop — a quick snap up, slower ease back down, not a symmetric sway —
faster still on `walking`/`celebrating`. The eyes (just the two brow/closed-
eye strokes) blink. The white muzzle patch is static, painted before the
nose/mouth so they stay visible always — it used to sit in the blinking
group, painting over the nose/mouth permanently except during the blink's
squash, which is why they briefly "appeared" only mid-blink; fixed by
moving the muzzle to the static body group. Everything else breathes
gently, and hops on `celebrating`. `walking` is built and exported but not
yet wired to a call site — the natural next step is a path-advance transit
animation (walk from the just-completed node to the next one) rather than
the instant snap the path currently does.

**Rendering fix (same day)**: the walker and partner-ghost used to be drawn
inside PathScene's per-segment SVGs (a raster-budget slicing workaround —
§5b) — a segment's viewBox clips anything past its edge, so a node sitting
near a segment boundary cropped the walker's head, and could hide the
partner ghost entirely. Both now render as HTML overlays (the same
percentage-positioned pattern unit headers/landmarks already used, which
never had this problem for exactly this reason), immune to segment
boundaries. `tone` is also now genuinely reactive (`useSettings()`, not a
`getSettings()` snapshot) so a Settings colour change repaints the walker
immediately.

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
