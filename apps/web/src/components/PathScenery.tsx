/** The mountain's dressing (docs/DESIGN.md §5b): flat palette-only sprites
 * scattered deterministically along the trail, whose MIX shifts gradually
 * with altitude t ∈ [0,1] (0 = front door, 1 = summit). No hard biome
 * boundaries anywhere — every density is a lerp over t:
 *
 *   trees/bushes/grass fade out over t 0.00→0.55
 *   rocks ramp in      over t 0.15→0.65, thin out again by 0.9
 *   stone tōrō lanterns appear t 0.45→0.75
 *   cloud band centred on t≈0.68 (some puffs render ABOVE the trail)
 *   paper chōchin + decorative mini-torii + stars own t 0.75→1
 *
 * Placement is seeded by node index (fract-sin hash) so the mountain is
 * identical on every visit — it's a place, not a screensaver. */

export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** lerp-clamped ramp: 0 before a, 1 after b. */
export function ramp(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / (b - a)))
}

/* ---------------------------------------------------------------- sprites */

export function Pine({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} aria-hidden>
      <rect x="-1.6" y="14" width="3.2" height="7" className="fill-ink-soft/60" />
      <path d="M0,-14 L9,2 L4.5,2 L11,14 L-11,14 L-4.5,2 L-9,2 Z" className="fill-olive" />
    </g>
  )
}

export function Bush({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} aria-hidden>
      <ellipse cx="0" cy="0" rx="9" ry="6" className="fill-olive/80" />
      <ellipse cx="-6" cy="2" rx="6" ry="4.4" className="fill-olive/60" />
      <ellipse cx="6.5" cy="2.2" rx="5.5" ry="4" className="fill-olive/70" />
    </g>
  )
}

export function Grass({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} className="stroke-olive/70" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M0,4 Q-1,-2 -4,-5" fill="none" />
      <path d="M1,4 Q1,-3 1,-7" fill="none" />
      <path d="M2,4 Q4,-1 6,-4" fill="none" />
    </g>
  )
}

export function Rock({ s = 1, flip = false }: { s?: number; flip?: boolean }) {
  return (
    <g transform={`scale(${flip ? -s : s}, ${s})`} aria-hidden>
      <path d="M-11,6 L-7,-4 L-1,-7 L7,-5 L11,6 Z" className="fill-cloud/60" />
      <path d="M-1,-7 L7,-5 L4,6 L-3,6 Z" className="fill-cloud/40" />
    </g>
  )
}

/** Stone tōrō lantern — the mid-mountain waypoint. */
export function Toro({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} aria-hidden>
      <rect x="-2" y="6" width="4" height="10" className="fill-cloud/80" />
      <rect x="-6" y="14" width="12" height="3" rx="1" className="fill-cloud/80" />
      <path d="M-7,6 L7,6 L4.5,1 L-4.5,1 Z" className="fill-cloud" />
      <rect x="-3.5" y="1" width="7" height="5" className="fill-kraft/70" />
      <path d="M-8,0 Q0,-4 8,0 L6,-1.5 Q0,-4.5 -6,-1.5 Z" className="fill-cloud" />
    </g>
  )
}

/** Paper chōchin lantern on a post — warm light for the night stretch. */
export function Chochin({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} aria-hidden>
      <rect x="-1.2" y="-18" width="2.4" height="34" className="fill-ink-soft/50" />
      <path d="M-1.2,-18 L8,-18" className="stroke-ink-soft/50" strokeWidth="2" strokeLinecap="round" stroke="currentColor" fill="none" />
      <g className="lantern-sway">
        <ellipse cx="8" cy="-8" rx="6.5" ry="8.5" className="fill-clay" />
        <ellipse cx="8" cy="-8" rx="6.5" ry="8.5" fill="none" className="stroke-clay-deep/60" strokeWidth="0.8" />
        <path d="M3.5,-11 Q8,-12.6 12.5,-11 M3,-8 Q8,-9.4 13,-8 M3.5,-5 Q8,-6.4 12.5,-5" fill="none" className="stroke-paper/50" strokeWidth="0.7" />
        <rect x="5.5" y="-17.5" width="5" height="2" rx="0.8" className="fill-ink-soft" />
        <rect x="5.5" y="-1" width="5" height="1.8" rx="0.8" className="fill-ink-soft" />
        {/* the glow — pure opacity halo, reads at night */}
        <circle cx="8" cy="-8" r="12" className="fill-kraft/25" />
      </g>
    </g>
  )
}

/** Decorative mini-torii (scenery, not a checkpoint — always clay). */
export function MiniTorii({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`} className="text-clay" aria-hidden>
      <path d="M-11,-12 Q0,-15.4 11,-12 L10.6,-9.4 Q0,-12.6 -10.6,-9.4 Z" fill="currentColor" />
      <rect x="-8" y="-7" width="16" height="2" fill="currentColor" />
      <path d="M-8.5,-10 L-6.5,10 L-4.5,10 L-6.2,-10 Z" fill="currentColor" />
      <path d="M8.5,-10 L6.5,10 L4.5,10 L6.2,-10 Z" fill="currentColor" />
    </g>
  )
}

/** Moonlit in both themes — the band lives at night altitude, so puffs use
 * the non-flipping night token rather than paper (which goes dark in .dark
 * and vanished against the sky). */
export function CloudPuff({ s = 1, className = '' }: { s?: number; className?: string }) {
  return (
    <g transform={`scale(${s})`} className={className} aria-hidden>
      <ellipse cx="0" cy="0" rx="26" ry="9" className="fill-night-ink" opacity="0.8" />
      <ellipse cx="-14" cy="-5" rx="13" ry="7.5" className="fill-night-ink" opacity="0.7" />
      <ellipse cx="10" cy="-6" rx="15" ry="8" className="fill-night-ink" opacity="0.75" />
    </g>
  )
}

/* ------------------------------------------------------- scene assembly */

export type Sprite = {
  key: string
  kind: 'pine' | 'bush' | 'grass' | 'rock' | 'toro' | 'chochin' | 'minitorii'
  x: number
  y: number
  s: number
  flip: boolean
}

/** Deterministic prop for one placement slot at altitude t, or null (gaps are
 * part of the composition). Weights lerp with t — the "no hard change" rule. */
function pickKind(t: number, r: number): Sprite['kind'] | null {
  const w = {
    pine: 1.5 * (1 - ramp(t, 0.1, 0.55)),
    bush: 1.1 * (1 - ramp(t, 0.05, 0.5)),
    grass: 0.9 * (1 - ramp(t, 0.1, 0.45)),
    rock: 0.4 + 1.1 * ramp(t, 0.15, 0.5) * (1 - 0.7 * ramp(t, 0.65, 0.9)),
    toro: 1.0 * ramp(t, 0.45, 0.6) * (1 - ramp(t, 0.68, 0.8)),
    chochin: 1.3 * ramp(t, 0.72, 0.85),
    minitorii: 1.2 * ramp(t, 0.78, 0.95),
    gap: 0.9,
  }
  const entries = Object.entries(w) as [keyof typeof w, number][]
  const total = entries.reduce((a, [, v]) => a + v, 0)
  let acc = 0
  const target = r * total
  for (const [k, v] of entries) {
    acc += v
    if (target <= acc) return k === 'gap' ? null : k
  }
  return null
}

/** Two placement slots per node — one either side of the trail, offset
 * outward but clamped ONTO the mountain body (`halfAt` gives the body's
 * half-width at a given y), so nothing floats in the sky beside the peak. */
export function buildScenery(
  nodes: { x: number; y: number; i: number }[],
  totalH: number,
  cx: number,
  w: number,
  halfAt: (y: number) => number,
): Sprite[] {
  const sprites: Sprite[] = []
  for (const n of nodes) {
    const t = 1 - n.y / totalH
    for (const side of [0, 1] as const) {
      const seed = n.i * 2 + side + 1
      const r1 = hash(seed)
      const kind = pickKind(t, r1)
      if (!kind) continue
      const dir = side === 0 ? -1 : 1
      const y = n.y + (hash(seed * 7.3) - 0.5) * 100
      const bodyEdge = cx + dir * (halfAt(y) - 20)
      // between the trail's swing on this side and the body's edge, jittered
      const edge = side === 0 ? Math.min(n.x, cx) : Math.max(n.x, cx)
      const room = Math.abs(bodyEdge - (edge + dir * 52))
      if (room < 10) continue // the crest is too narrow here — leave it bare
      const x = edge + dir * (52 + hash(seed * 3.7) * room * 0.85)
      if (x < 14 || x > w - 14 || Math.abs(x - cx) > halfAt(y) - 16) continue
      sprites.push({
        key: `sp-${seed}`,
        kind,
        x,
        y,
        s: 0.8 + hash(seed * 13.9) * 0.55,
        flip: hash(seed * 23.3) > 0.5,
      })
    }
  }
  return sprites
}

export function SpriteGlyph({ sp }: { sp: Sprite }) {
  switch (sp.kind) {
    case 'pine': return <Pine s={sp.s} />
    case 'bush': return <Bush s={sp.s} />
    case 'grass': return <Grass s={sp.s} />
    case 'rock': return <Rock s={sp.s} flip={sp.flip} />
    case 'toro': return <Toro s={sp.s} />
    case 'chochin': return <Chochin s={sp.s} />
    case 'minitorii': return <MiniTorii s={sp.s} />
  }
}

/** Star field for the upper mountain — density ramps with altitude.
 * `asHtml` renders positioned <span> dots for use inside a plain div layer
 * (avoids a page-tall svg, which busts Chromium's raster budget). */
export function Stars({
  totalH,
  w,
  asHtml = false,
  bandFrac = 1,
}: {
  totalH: number
  w: number
  asHtml?: boolean
  /** when the HTML host div covers only the top `bandFrac` of the scene,
   * positions are re-based so stars land at their true scene altitude */
  bandFrac?: number
}) {
  const pts: { k: number; x: number; y: number; r: number; o: number; d: number }[] = []
  const zoneTop = 0.68 // stars live above t≈0.68, thickening upward
  for (let k = 0; k < 90; k++) {
    const rx = hash(k * 3.1 + 5)
    const ry = hash(k * 9.7 + 2)
    const t = zoneTop + ry * (1 - zoneTop)
    if (hash(k * 5.3) > ramp(t, 0.68, 0.98) * 0.95) continue
    pts.push({
      k,
      x: rx * w,
      y: (1 - t) * totalH,
      r: 0.8 + hash(k * 7.7) * 1.3,
      o: 0.35 + hash(k) * 0.5,
      d: hash(k * 11.3) * 3.8,
    })
  }
  if (asHtml) {
    return (
      <>
        {pts.map((p) => (
          <span
            key={`st-${p.k}`}
            className="star-twinkle absolute rounded-full"
            style={{
              left: `${(p.x / w) * 100}%`,
              top: `${((p.y / totalH) / bandFrac) * 100}%`,
              width: `${p.r * 2.4}px`,
              height: `${p.r * 2.4}px`,
              background: 'var(--color-night-ink)',
              opacity: p.o,
              animationDelay: `${p.d}s`,
            }}
          />
        ))}
      </>
    )
  }
  return (
    <g aria-hidden>
      {pts.map((p) => (
        <circle
          key={`st-${p.k}`}
          cx={p.x}
          cy={p.y}
          r={p.r}
          className="fill-night-ink star-twinkle"
          style={{ animationDelay: `${p.d}s`, opacity: p.o }}
        />
      ))}
    </g>
  )
}

/** Goraikō — the summit sunrise: torii against the rising sun, the reward at
 * the top of every Fuji climb. Replaces the old Fuji illustration (you're ON
 * the mountain now). */
export function SummitScene() {
  return (
    <svg viewBox="0 0 160 96" className="h-24 w-40" aria-hidden>
      <circle cx="80" cy="66" r="30" className="fill-clay/90" />
      <circle cx="80" cy="66" r="40" className="fill-clay/25" />
      <path d="M0,66 L160,66 L160,96 L0,96 Z" style={{ fill: 'var(--path-sky-night)' }} />
      {/* the summit torii, black against the sun */}
      <g transform="translate(80 62)" className="text-ink-mid dark:text-ink-soft">
        <path d="M-26,-28 Q0,-35 26,-28 L25,-22 Q0,-28.5 -25,-22 Z" fill="currentColor" />
        <rect x="-19" y="-16" width="38" height="4.5" fill="currentColor" />
        <path d="M-20,-24 L-15,4 L-10.5,4 L-14.8,-24 Z" fill="currentColor" />
        <path d="M20,-24 L15,4 L10.5,4 L14.8,-24 Z" fill="currentColor" />
        <rect x="-2.5" y="-13" width="5" height="5" fill="currentColor" />
      </g>
    </svg>
  )
}
