/** The living path walker (docs/DESIGN.md §5), replaced 2026-07-08 (v4, same
 * day) with the household's own hand-designed kitsune — a sticker-style
 * sitting spirit-fox (white outline via an SVG feMorphology-dilate filter),
 * built in Claude Design: https://claude.ai/design/p/c513c49a-0c9e-4a70-9c1c-8e0a7064f7f2
 * The artwork’s geometry is verbatim, including the ear-decoration path
 * ending `L278 ` with no explicit closing `Z` — intentional in the source,
 * not a paste error (an earlier pass here mistakenly "fixed" it; reverted
 * per the household). Browsers auto-close an open path for FILL purposes
 * (straight back to the initial M), so it renders correctly without one.
 * This file only adds the animation groupings and the tone-recolour
 * mechanism.
 *
 * Earlier redesign attempts this same day (standing-bipedal, then a
 * flat-shaded sitting-cat silhouette) both read as "red panda" against
 * direct feedback; this design is the one that actually lands as a
 * kitsune, so it replaces AnimatedKitsune's contents outright rather than
 * iterating further on the flat-shaded approach.
 *
 * Tone: the source art is one fixed cyan illustration (6 flat shades + a
 * dark ink for the brows/nose/mouth). Recolouring it per selectable tone
 * (docs/DESIGN.md §5c — clay/sky/teal/plum/cyan) is done with a CSS
 * `hue-rotate` filter chained onto the artwork's own sticker-outline filter
 * (`filter: url(#sticker) hue-rotate(Ndeg)`), rather than hand-recolouring
 * six shades × five tones. Degrees are computed from each tone's actual hue
 * relative to the art's native cyan (~186°) — see `HUE_ROTATE` below. `cyan`
 * is therefore a 0° no-op: the art as designed. `PALETTE` (the flat
 * body/shadow hex pairs) is UNCHANGED from the previous version and still
 * exported — Settings' swatch picker and the Stats buddies-panel swatch
 * only ever needed one representative hex per tone, not the recolour
 * mechanism itself, so neither required any change.
 *
 * Animation groups (transforms only, no new geometry): `kit-tail` (the
 * first two paths — the bushy curled tail) gets the household-requested
 * upward flick — a quick rotate up, slower ease back down, looping, faster
 * still on `walking`/`celebrating`. `kit-eyes` (the two brow strokes only —
 * the white muzzle patch stays static, nose/mouth painted after it so they
 * stay visible always, not just mid-blink) blinks. `kit-body` (everything
 * else, muzzle/nose/mouth included) breathes gently and hops on
 * `celebrating`. All motion behind prefers-reduced-motion. */

export type KitsuneMood = 'idle' | 'walking' | 'celebrating'
export type KitsuneTone = 'clay' | 'sky' | 'teal' | 'plum' | 'cyan'

/** Flat swatch hex per tone — used by Settings' picker and the Stats
 * buddies-panel dot, NOT by the artwork itself (see file header). Kept
 * byte-for-byte from the previous version; downstream consumers (grep
 * `PALETTE[` in SettingsPage.tsx / StatsPage.tsx) only read `.body`. */
export const PALETTE: Record<KitsuneTone, { body: string; shadow: string }> = {
  clay: { body: '#c33c54', shadow: '#a03349' },
  sky: { body: '#37718e', shadow: '#2b5a71' },
  teal: { body: '#2e8b74', shadow: '#236b5a' },
  plum: { body: '#9c3f6d', shadow: '#7d2f56' },
  cyan: { body: '#3d9db3', shadow: '#2c7a8c' },
}

/** Degrees to rotate the artwork's native ~186° cyan to land on each tone's
 * actual hue (computed via colorsys, not eyeballed — see the commit that
 * introduced this file for the derivation). */
const HUE_ROTATE: Record<KitsuneTone, number> = {
  clay: 163,
  sky: 14,
  teal: 339,
  plum: 144,
  cyan: 0,
}

const KIT_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .kit-tail { transform-box: fill-box; transform-origin: 90% 85%; animation: kit-tail-flick 3.2s cubic-bezier(.3,0,.2,1) infinite; }
  .kit-body { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-breath 3.2s ease-in-out infinite; }
  .kit-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: kit-blink 4.8s linear infinite; }

  .kit-walking .kit-tail { animation-duration: 1.4s; }
  .kit-walking .kit-body { animation: kit-bounce 0.6s ease-in-out infinite; }

  .kit-celebrating .kit-tail { animation-duration: 0.7s; }
  .kit-celebrating .kit-body { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-hop-cheer 1.1s ease-in-out infinite; }
}
/* the flick: a quick snap upward, a slower settle back down — not a
   symmetric sway, per "make the bushy tail flick upwards" */
@keyframes kit-tail-flick {
  0%, 60% { transform: rotate(0deg); }
  72% { transform: rotate(-22deg); }
  100% { transform: rotate(0deg); }
}
@keyframes kit-breath { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
@keyframes kit-blink { 0%, 93.9%, 98.1%, 100% { transform: scaleY(1); } 95%, 97% { transform: scaleY(0.12); } }
@keyframes kit-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes kit-hop-cheer {
  0%, 100% { transform: translateY(0) scaleY(1); }
  15% { transform: translateY(2px) scaleY(0.9); }
  45% { transform: translateY(-14px) scaleY(1.07); }
  65% { transform: translateY(0) scaleY(0.95); }
  82% { transform: translateY(-5px) scaleY(1.03); }
}
`

export function AnimatedKitsune({
  mood = 'idle',
  tone = 'clay',
  width,
  height,
  className = '',
}: {
  mood?: KitsuneMood
  tone?: KitsuneTone
  width?: number
  height?: number
  className?: string
}) {
  return (
    <svg
      // Padded well past the artwork's own 0 0 440 460 bounds: the tail's
      // flick ROTATES it (a CSS transform on `.kit-tail`), which sweeps its
      // tip outside the artwork's static bounding box — an unpadded viewBox
      // clips that swing every cycle. The padding is pure headroom; the
      // artwork itself hasn't moved.
      viewBox="-55 -55 550 570"
      aria-hidden
      width={width}
      height={height}
      className={`kit-${mood} ${className}`}
    >
      <style>{KIT_CSS}</style>
      <defs>
        {/* thinner sticker edge (was radius 9 / stroke 5 — read as heavy) */}
        <filter id="kit-sticker" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="dilated" />
          <feFlood floodColor="#ffffff" result="white" />
          <feComposite in="white" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        stroke="#1E6D7E"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `url(#kit-sticker) hue-rotate(${HUE_ROTATE[tone]}deg)` }}
      >
        {/* tail — the household-requested flick lives here */}
        <g className="kit-tail">
          <path
            fill="#A9E9F0"
            d="M158 292 C118 268 74 276 56 308 C47 324 44 338 47 350 L26 362 L52 364 L34 392 L64 382 L58 412 L88 392 L94 416 L114 394 C132 376 146 344 160 316 C162 306 162 298 158 292 Z"
          />
          <path
            fill="#DFF9FB"
            stroke="none"
            d="M138 296 C112 284 88 290 74 310 C67 320 64 332 67 342 L56 352 L74 352 L64 376 L86 366 L84 390 L102 374 C118 356 130 330 142 310 C144 302 142 298 138 296 Z"
          />
        </g>

        {/* body, haunches, legs, ears, head — everything but the tail/eyes */}
        <g className="kit-body">
          <path
            fill="#B8EFF4"
            d="M212 242 C160 250 126 292 124 338 C123 368 132 392 148 402 L222 402 C210 378 204 344 206 308 C207 284 210 262 212 242 Z"
          />
          <path
            fill="#8ADCE6"
            stroke="none"
            d="M148 402 C136 392 128 372 128 344 C128 316 140 288 162 270 C146 296 140 330 144 360 C147 380 154 394 162 402 Z"
          />
          <path
            fill="#C7F3F7"
            d="M138 388 C154 382 178 382 192 388 C200 392 202 398 198 402 L140 402 C132 398 132 392 138 388 Z"
          />
          <path fill="none" strokeWidth="4" d="M160 388 L160 398 M178 386 L178 398" />
          <path
            fill="#B8EFF4"
            d="M196 214 C190 258 192 302 206 342 C214 368 228 386 246 394 L284 394 C292 370 292 328 286 294 C282 264 276 236 268 216 Z"
          />
          <path
            fill="#B8EFF4"
            d="M216 336 C214 358 214 374 216 386 C216 396 221 402 230 402 L240 402 C246 402 248 396 246 388 C243 370 243 352 244 336 "
          />
          <path fill="none" strokeWidth="4" d="M232 392 L232 400" />
          <path
            fill="#C7F3F7"
            d="M246 334 C244 358 244 374 246 388 C246 398 252 402 260 402 L272 402 C280 402 282 396 280 386 C277 368 277 350 278 334 "
          />
          <path fill="none" strokeWidth="4" d="M262 392 L262 402" />
          <path
            fill="#C7F3F7"
            d="M224 216 C250 224 268 238 274 250 L300 258 L282 272 L302 288 L280 296 L294 314 L270 318 L278 "
          />
          <path
            fill="#E9FCFD"
            stroke="none"
            d="M238 242 C252 248 262 256 266 263 L282 268 L270 277 L283 288 L268 293 L277 306 L262 309 C252 305 246 296 243 285 C239 270 238 254 238 242 Z"
          />
          <path
            fill="#B8EFF4"
            d="M180 132 C162 98 152 66 150 38 C174 56 200 78 214 100 Z"
          />
          <path
            fill="#B8EFF4"
            d="M276 132 C294 98 304 66 306 38 C282 56 256 78 242 100 Z"
          />
          <path fill="#5FC4D4" stroke="none" d="M184 120 C172 96 165 74 163 56 C179 70 196 86 206 102 Z" />
          <path fill="#5FC4D4" stroke="none" d="M272 120 C284 96 291 74 293 56 C277 70 260 86 250 102 Z" />
          <path
            fill="#C7F3F7"
            d="M228 96 C252 96 272 104 282 118 L292 134 L318 144 L296 162 L316 180 L292 190 L302 210 L278 214 C266 228 248 236 228 236 C208 236 190 228 178 214 L154 210 L164 190 L140 180 L160 162 L138 144 L164 134 L174 118 C184 104 204 96 228 96 Z"
          />
          <path fill="#C7F3F7" d="M202 102 L214 76 L225 94 L237 72 L247 100 C233 93 216 93 202 102 Z" />
          {/* the white muzzle patch — static, never blinks; nose and mouth
              painted AFTER it so they stay visible on top at all times (they
              used to sit under the eye-white ellipse when it lived in the
              blinking group, only surfacing during the squashed blink frame) */}
          <ellipse cx="228" cy="198" rx="38" ry="27" fill="#EFFDFE" stroke="none" />
          <path fill="#174B57" stroke="none" d="M219 189 L237 189 Q239 191 237 194 L230 201 Q228 203 226 201 L219 194 Q217 191 219 189 Z" />
          <path fill="none" stroke="#174B57" strokeWidth="5" d="M217 208 Q228 216 239 208" />
        </g>

        {/* eyebrows only — the blink */}
        <g className="kit-eyes">
          <path fill="none" stroke="#174B57" strokeWidth="6" d="M176 168 Q191 152 206 166" />
          <path fill="none" stroke="#174B57" strokeWidth="6" d="M250 166 Q265 152 280 168" />
        </g>
      </g>
    </svg>
  )
}
