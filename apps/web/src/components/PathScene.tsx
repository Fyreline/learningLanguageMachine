/** The Path (docs/DESIGN.md §5 + §5b): THE WHOLE PAGE IS THE MOUNTAIN. One
 * trail climbs from the front door (bottom) through forest, rock, a cloud
 * band and finally a starlit summit stretch — the biome shifting gradually
 * with altitude, never at a boundary. Lessons are paw-print stepping stones,
 * checkpoints are torii gates, the kitsune stands on the current node.
 *
 * Geometry: nodes are laid bottom-up along an accumulated-phase sine whose
 * frequency AND amplitude grow with progress, so the path winds back on
 * itself more often the higher you climb (switchbacks near the peak). The
 * trail is a Catmull-Rom curve through the nodes, drawn twice (full +
 * walked overlay). Sky/ridges/clouds are parallax layers driven by
 * motion's useScroll; scenery sprites live in PathScenery.tsx.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion as m, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { PathLesson, PathManifest, PathUnit } from '../pathData'
import { AnimatedKitsune } from './AnimatedKitsune'
import { MichiMark } from './MichiMark'
import { buildScenery, CloudPuff, hash, ramp, SpriteGlyph, Stars, SummitScene } from './PathScenery'

const STEP = 132 // vertical px between nodes ≈ the ~140px arc of the spec
const TOP_PAD = 300 // room for the summit block
const BOT_PAD = 190 // room for the front door

/** Text on the upper mountain sits on night sky in BOTH themes — flip unit
 * headers to the non-theming night tokens above this altitude. */
const NIGHT_LINE = 0.62

/** The mountain body's half-width at progress p ∈ [0,1] (0 = base, 1 = peak):
 * wider than the page at the base, converging to a narrow crest that always
 * still fits the trail's swing (+ node radius + margin) at that height. */
function bodyHalfAt(p: number, w: number): number {
  const trailExtent = 8 + (1 - p * p) * w * 0.3 + 44
  const taper = w * (0.5 - 0.42 * Math.pow(Math.max(0, p), 1.4)) + 40
  return Math.min(w / 2 + 60, Math.max(trailExtent + 26, taper))
}

interface FlatNode {
  lesson: PathLesson
  unit: PathUnit
  indexInUnit: number
  i: number // walking order, 0 = first step (bottom)
  x: number
  y: number
}

function buildNodes(units: PathUnit[], totalH: number, w: number): FlatNode[] {
  const cx = w / 2
  const flat: { lesson: PathLesson; unit: PathUnit; indexInUnit: number }[] = []
  for (const u of units) u.lessons.forEach((l, li) => flat.push({ lesson: l, unit: u, indexInUnit: li }))
  const N = Math.max(1, flat.length - 1)
  let phase = 0
  return flat.map((f, i) => {
    const p = i / N // 0 at the door, 1 at the summit
    // real summit approach: sweeping curves on the broad base, then the
    // switchbacks come faster (frequency doubles) while the swing narrows
    // with the mountain itself — the last node lands on the crest's centre
    phase += 0.52 + 0.55 * p
    return {
      ...f,
      i,
      x: cx + (8 + (1 - p * p) * w * 0.3) * Math.sin(phase),
      y: totalH - BOT_PAD - i * STEP,
    }
  })
}

/** Catmull-Rom → cubic bezier through the given points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d.push(`C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
  }
  return d.join(' ')
}

function Star({ cx, cy, filled }: { cx: number; cy: number; filled: boolean }) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 === 0 ? 4.6 : 2.1
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return <polygon points={pts} className={filled ? 'fill-clay' : 'fill-cloud/50'} />
}

function PawGlyph({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <g transform={`translate(${x - 10} ${y - 10}) scale(1)`} className={className} aria-hidden>
      <ellipse cx="10" cy="13.4" rx="4.6" ry="3.8" fill="currentColor" />
      <ellipse cx="4.8" cy="7" rx="1.8" ry="2.3" fill="currentColor" />
      <ellipse cx="9.2" cy="4.8" rx="1.8" ry="2.3" fill="currentColor" />
      <ellipse cx="13.7" cy="5.6" rx="1.8" ry="2.3" fill="currentColor" />
      <ellipse cx="16.6" cy="9.2" rx="1.7" ry="2.1" fill="currentColor" />
    </g>
  )
}

/** Torii gate — the checkpoint node (docs/DESIGN.md §5). */
function Torii({ x, y, state }: { x: number; y: number; state: string }) {
  const color =
    state === 'done' ? 'text-olive' : state === 'locked' ? 'text-cloud' : 'text-clay'
  return (
    <g transform={`translate(${x - 26} ${y - 30})`} className={color} aria-hidden>
      {/* kasagi (top beam, curved) + shimaki */}
      <path d="M0,10 Q26,2 52,10 L52,15 Q26,8 0,15 Z" fill="currentColor" />
      {/* nuki (second beam) */}
      <rect x="5" y="21" width="42" height="5" fill="currentColor" />
      {/* pillars, slightly splayed */}
      <path d="M8,12 L13,60 L18,60 L13.5,12 Z" fill="currentColor" />
      <path d="M44,12 L39,60 L34,60 L38.5,12 Z" fill="currentColor" />
      {/* gakuzuka (centre tablet) */}
      <rect x="23.5" y="15" width="5" height="6" fill="currentColor" />
    </g>
  )
}

/** Flat ≤3-colour landmark illustrations, one per unit (DESIGN §5). */
function Landmark({ kind }: { kind: string }) {
  switch (kind) {
    case 'door':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="14" y="14" width="36" height="44" rx="2" className="fill-sky/30" />
          <rect x="22" y="24" width="20" height="34" rx="1.5" className="fill-clay" />
          <circle cx="38" cy="42" r="1.8" className="fill-paper" />
          <path d="M10 16 L32 4 L54 16" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-ink-soft" stroke="currentColor" />
        </svg>
      )
    case 'street':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path d="M6 58 V26 L17 16 L28 26 V58 Z" className="fill-sky/40" />
          <path d="M36 58 V22 L47 12 L58 22 V58 Z" className="fill-sky/60" />
          <rect x="12" y="32" width="6" height="7" className="fill-paper" />
          <rect x="43" y="28" width="6" height="7" className="fill-paper" />
          <rect x="12" y="44" width="6" height="7" className="fill-paper" />
          <rect x="43" y="42" width="6" height="7" className="fill-paper" />
        </svg>
      )
    case 'plane':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path d="M6 38 L50 22 Q58 20 57 26 Q56 30 48 32 L14 44 Z" className="fill-sky" />
          <path d="M28 30 L22 14 L28 14 L38 27 Z" className="fill-sky/70" />
          <path d="M22 41 L18 52 L24 50 L30 38 Z" className="fill-sky/70" />
          <circle cx="50" cy="25" r="2" className="fill-paper" />
        </svg>
      )
    case 'tokyo':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="6" y="34" width="10" height="24" className="fill-sky/50" />
          <rect x="48" y="30" width="10" height="28" className="fill-sky/50" />
          <path d="M32 6 L40 46 L24 46 Z" className="fill-clay" />
          <rect x="24" y="46" width="16" height="12" className="fill-clay/70" />
          <rect x="30.5" y="18" width="3" height="6" className="fill-paper" />
        </svg>
      )
    case 'izakaya':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <ellipse cx="32" cy="30" rx="14" ry="18" className="fill-clay" />
          <path d="M18 24 Q32 18 46 24" fill="none" strokeWidth="2" className="stroke-ink-soft" stroke="currentColor" />
          <rect x="28" y="8" width="8" height="5" rx="2" className="fill-ink-soft" />
          <rect x="29" y="46" width="6" height="6" rx="2" className="fill-ink-soft" />
          <text x="32" y="36" textAnchor="middle" className="fill-paper" style={{ font: '600 13px var(--font-jp)' }}>酒</text>
        </svg>
      )
    case 'shinkansen':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path d="M4 40 Q6 28 22 26 L58 26 L58 40 Z" className="fill-paper-deep" />
          <path d="M4 40 Q6 28 22 26 L58 26 L58 31 L20 31 Q10 32 4 40 Z" className="fill-sky" />
          <rect x="26" y="29" width="7" height="5" rx="1" className="fill-ink-soft/60" />
          <rect x="38" y="29" width="7" height="5" rx="1" className="fill-ink-soft/60" />
          <rect x="2" y="44" width="60" height="3" rx="1.5" className="fill-cloud" />
        </svg>
      )
    case 'streets':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="30" y="10" width="4" height="48" className="fill-ink-soft" />
          <rect x="12" y="14" width="24" height="9" rx="2" className="fill-clay" />
          <rect x="30" y="28" width="23" height="9" rx="2" className="fill-sky" />
          <path d="M12 18.5 L7 18.5 L12 14 Z" className="fill-clay" />
        </svg>
      )
    case 'donki':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path d="M14 22 L50 22 L46 56 L18 56 Z" className="fill-clay" />
          <path d="M24 22 Q24 12 32 12 Q40 12 40 22" fill="none" strokeWidth="3" className="stroke-ink-soft" stroke="currentColor" />
          <circle cx="27" cy="36" r="2.2" className="fill-paper" />
          <circle cx="37" cy="36" r="2.2" className="fill-paper" />
          <path d="M26 44 Q32 49 38 44" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-paper" stroke="currentColor" />
        </svg>
      )
    case 'ryokan':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path d="M4 26 L32 8 L60 26 L54 26 L32 13 L10 26 Z" className="fill-ink-soft" />
          <rect x="12" y="26" width="40" height="30" className="fill-paper-deep" />
          <rect x="16" y="30" width="14" height="18" className="fill-clay/80" />
          <rect x="34" y="30" width="14" height="18" className="fill-clay/80" />
          <rect x="22.5" y="30" width="1.5" height="18" className="fill-paper" />
          <rect x="40.5" y="30" width="1.5" height="18" className="fill-paper" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="10" y="14" width="44" height="42" rx="4" className="fill-paper-deep" />
          <rect x="10" y="14" width="44" height="12" rx="4" className="fill-sky" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}${c}`} x={16 + c * 9.5} y={32 + r * 8} width="6" height="5" rx="1" className={r === 1 && c === 2 ? 'fill-clay' : 'fill-cloud/60'} />
            )),
          )}
        </svg>
      )
    case 'onsen-town':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <ellipse cx="32" cy="46" rx="22" ry="9" className="fill-sky/50" />
          <path d="M20 34 Q17 28 20 23 M32 32 Q29 26 32 20 M44 34 Q41 28 44 23" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-cloud" stroke="currentColor" />
        </svg>
      )
    case 'koban':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="16" y="26" width="32" height="30" className="fill-paper-deep" />
          <path d="M12 26 L32 12 L52 26 Z" className="fill-sky" />
          <circle cx="32" cy="10" r="4" className="fill-clay" />
          <rect x="27" y="38" width="10" height="18" className="fill-ink-soft" />
        </svg>
      )
    case 'market':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="8" y="30" width="48" height="26" className="fill-paper-deep" />
          <path d="M6 30 L58 30 L54 16 L10 16 Z" className="fill-clay" />
          <path d="M6 30 L14 30 L16 16 L10 16 Z M22 30 L30 30 L31 16 L23 16 Z M38 30 L46 30 L46 16 L38 16 Z" className="fill-paper" />
          <circle cx="20" cy="40" r="3.5" className="fill-olive" />
          <circle cx="30" cy="40" r="3.5" className="fill-clay" />
          <circle cx="40" cy="40" r="3.5" className="fill-sky" />
        </svg>
      )
    case 'torii-avenue':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          {[
            { s: 1, o: 0.4, x: 40 },
            { s: 1.35, o: 0.7, x: 22 },
            { s: 1.8, o: 1, x: 4 },
          ].map((t, i) => (
            <g key={i} transform={`translate(${t.x} ${34 - t.s * 14}) scale(${t.s})`} opacity={t.o}>
              <path d="M0,3 Q8,0 16,3 L16,5.4 Q8,2.8 0,5.4 Z" className="fill-clay" />
              <rect x="1.6" y="7.6" width="12.8" height="1.8" className="fill-clay" />
              <rect x="2.8" y="4" width="2" height="14" className="fill-clay" />
              <rect x="11.2" y="4" width="2" height="14" className="fill-clay" />
            </g>
          ))}
        </svg>
      )
    case 'fuji':
      return (
        <svg viewBox="0 0 120 72" className="h-20 w-32" aria-hidden>
          <path d="M8 68 L52 12 Q60 4 68 12 L112 68 Z" className="fill-sky" />
          <path d="M42 25 Q50 33 60 26 Q70 34 78 25 L68 12 Q60 4 52 12 Z" className="fill-paper" />
          <rect x="59" y="0" width="2.4" height="14" className="fill-ink-soft" />
          <path d="M61.4 1 L74 4.5 L61.4 8 Z" className="fill-clay" />
        </svg>
      )
    default:
      return null
  }
}

export interface PathSceneProps {
  manifest: PathManifest
  onSelectLesson?: (lessonId: string, state: string) => void
}

export function PathScene({ manifest, onSelectLesson }: PathSceneProps) {
  // One round of hops when arriving back from a just-completed lesson — the
  // score screen (or anything else) sets sessionStorage 'michi-celebrate'.
  const [celebrating, setCelebrating] = useState(
    () => sessionStorage.getItem('michi-celebrate') === '1',
  )
  useEffect(() => {
    if (!celebrating) return
    sessionStorage.removeItem('michi-celebrate')
    const t = setTimeout(() => setCelebrating(false), 3400)
    return () => clearTimeout(t)
  }, [celebrating])

  // Full-bleed responsive coordinate space: the scene escapes its column and
  // measures the real page width; scene units render at a near-constant
  // ~1.2px each, so nodes stay finger-sized on phones AND desktops rather
  // than scaling a fixed viewBox up into a blur.
  const wrapRef = useRef<HTMLDivElement>(null)
  // seeded from the viewport (the wrapper is w-screen) so the FIRST render is
  // already right; the ResizeObserver only handles subsequent resizes
  const [pageW, setPageW] = useState(() => window.innerWidth || 430)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setPageW((prev) => (Math.abs(prev - w) > 24 ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = Math.round(Math.min(920, Math.max(420, pageW / 1.2)))
  const CX = W / 2

  const { units, summit, partner } = manifest
  const nodeCount = units.reduce((n, u) => n + u.lessons.length, 0)
  const totalH = TOP_PAD + BOT_PAD + (nodeCount - 1) * STEP

  const nodes = useMemo(() => buildNodes(units, totalH, W), [units, totalH, W])
  const currentNode = nodes.find((n) => n.lesson.state === 'current')
  const partnerNode = partner?.current_lesson_id
    ? nodes.find((n) => n.lesson.id === partner.current_lesson_id)
    : undefined

  const walked = useMemo(() => {
    const upto = currentNode ? currentNode.i : nodes.length - 1
    return smoothPath(nodes.slice(0, upto + 1).map(({ x, y }) => ({ x, y })))
  }, [nodes, currentNode])
  const full = useMemo(() => smoothPath(nodes.map(({ x, y }) => ({ x, y }))), [nodes])

  const currentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  // Unit header/landmark overlay positions from the same geometry, plus each
  // header's altitude so text flips to the night tokens on the upper mountain.
  const unitMeta = useMemo(() => {
    let cursor = 0
    return units.map((u) => {
      const first = nodes[cursor]
      const mid = nodes[Math.min(cursor + 3, cursor + u.lessons.length - 1)]
      cursor += u.lessons.length
      return {
        unit: u,
        headerTopPct: (first.y / totalH) * 100,
        headerSide: first.x < CX ? 'right' : 'left',
        landmarkTopPct: ((mid.y - 20) / totalH) * 100,
        landmarkSide: mid.x < CX ? 'left' : 'right',
        night: 1 - first.y / totalH > NIGHT_LINE,
      }
    })
  }, [units, nodes, totalH, CX])

  // The mountain body: converging sides, sampled top→bottom each side with a
  // hashed wobble so the edges read hand-cut, not ruled.
  const halfAtY = useMemo(() => {
    const peakY = 150
    return (y: number) => {
      const p = Math.max(0, Math.min(1, 1 - (y - peakY) / (totalH - BOT_PAD * 0.4 - peakY)))
      return bodyHalfAt(p, W)
    }
  }, [totalH, W])
  const bodyPath = useMemo(() => {
    const peakY = 150
    const baseY = totalH
    const STEPS = 84
    // Rugged flanks: two octaves of ridged noise per side (independent
    // seeds), so the silhouette reads hand-cut rock, not a ruler. The
    // coarse octave interpolates between knots every 6 samples; |noise|
    // is folded (ridged) for the occasional sharp spur or notch.
    const flank = (k: number, seed: number) => {
      const knot = Math.floor(k / 6)
      const f = (k % 6) / 6
      const a = (hash((knot + seed) * 13.7) - 0.5) * 2
      const b = (hash((knot + 1 + seed) * 13.7) - 0.5) * 2
      const coarse = (a + (b - a) * f) * 26
      const fine = (Math.abs(hash((k + seed) * 71.3)) - 0.5) * 13
      const spur = Math.pow(Math.abs(hash((k + seed) * 29.9)), 6) * 34
      return coarse + fine + spur
    }
    const right: string[] = []
    const left: string[] = []
    for (let k = 0; k <= STEPS; k++) {
      const y = peakY + ((baseY - peakY) * k) / STEPS
      const taper = Math.min(1, k / 5) // calm the crest tip so the peak stays a peak
      right.push(`${(CX + halfAtY(y) + flank(k, 0) * taper).toFixed(1)} ${y.toFixed(1)}`)
      left.push(`${(CX - halfAtY(y) - flank(k, 500) * taper).toFixed(1)} ${y.toFixed(1)}`)
    }
    // crest → down the right flank → base → up the left flank → close
    return `M ${CX} ${peakY - 26} L ${right.join(' L ')} L ${left.reverse().join(' L ')} Z`
  }, [totalH, W, CX, halfAtY])

  // Scenery + atmosphere (PathScenery.tsx). Deterministic, memoized.
  const scenery = useMemo(() => buildScenery(nodes, totalH, CX, W, halfAtY), [nodes, totalH, CX, W, halfAtY])
  const clouds = useMemo(() => {
    const out: { key: string; x: number; y: number; s: number; far: boolean; fg: boolean }[] = []
    for (let k = 0; k < 48; k++) {
      // the band is centred on t≈0.68 and feathers out both ways — you climb
      // into it, through it, and above it, gradually
      const t = 0.5 + hash(k * 17.3) * 0.36
      const density = 1 - Math.min(1, Math.abs(t - 0.68) / 0.17)
      if (hash(k * 29.1) > density * 1.6) continue
      out.push({
        key: `cl-${k}`,
        x: 30 + hash(k * 7.9) * (W - 60),
        y: (1 - t) * totalH,
        s: 1.7 + hash(k * 11.7) * 1.7,
        far: hash(k * 3.3) > 0.55,
        fg: hash(k * 41.7) > 0.8,
      })
    }
    return out
  }, [totalH, W])

  // Parallax: far ridges lag the scroll, the cloud band lags less, foreground
  // wisps run slightly ahead. Zeroed under reduced motion.
  const reduced = useReducedMotion()
  const { scrollY } = useScroll()
  const starsY = useTransform(scrollY, (v) => (reduced ? 0 : v * 0.2))
  const ridgeY = useTransform(scrollY, (v) => (reduced ? 0 : v * 0.16))
  const cloudY = useTransform(scrollY, (v) => (reduced ? 0 : v * 0.07))
  const fgY = useTransform(scrollY, (v) => (reduced ? 0 : v * -0.06))

  // Distant ridge silhouettes, placed pre-compensated for their parallax
  // factor so they still sit beside the altitude they belong to on screen.
  const ridges = useMemo(() => {
    const f = 0.16
    const out: { key: string; x: number; y: number; w2: number; h: number; o: number }[] = []
    for (let k = 0; k < 12; k++) {
      // now that the body converges, distant ranges stay visible in the side
      // sky most of the way up — they're what the peak rises out of
      const tScene = 0.06 + k * 0.075
      if (tScene > 0.88) break
      const ys = (1 - tScene) * totalH
      out.push({
        key: `rg-${k}`,
        x: (k % 2 === 0 ? 0.22 : 0.78) * W + (hash(k * 5.7) - 0.5) * 80,
        y: ys * (1 - f) + f * 300,
        w2: (0.25 + hash(k * 3.1) * 0.18) * W,
        h: 48 + hash(k * 9.3) * 36,
        o: (0.16 + (1 - tScene) * 0.22) * (1 - 0.5 * ramp(tScene, 0.6, 0.88)),
      })
    }
    return out
  }, [totalH, W])

  // ——— Chromium rasterises an <svg> as one layer with a hard device-pixel
  // budget (~16k); the full scene at desktop widths is ~32k device px tall
  // and silently paints NOTHING past the budget. So the scene renders as
  // stacked SEGMENT svgs (each ~1600 units ≈ well under budget). The body
  // and trail paths are drawn in every segment — the segment's viewBox does
  // the clipping; point elements are filtered into their segment by y. ———
  const SEG_UNITS = 1600
  const segCount = Math.ceil(totalH / SEG_UNITS)
  const segs = Array.from({ length: segCount }, (_, si) => {
    const y0 = si * SEG_UNITS
    const y1 = y0 + SEG_UNITS
    const within = (y: number, pad = 120) => y >= y0 - pad && y <= y1 + pad
    return { si, y0, y1, within }
  })

  // Each segment carries its own copy of the ground gradient (svg ids must
  // be unique per document) — but in userSpaceOnUse coordinates spanning the
  // FULL scene height, so every slice shows its correct portion of one
  // continuous meadow→stone→dusk ramp. No per-slice stop math.

  return (
    <div
      ref={wrapRef}
      className="relative w-screen"
      // Full-bleed WITHOUT a transform: -translate-x-1/2 promoted this
      // page-tall wrapper to one composited texture, which blows Chromium's
      // raster budget on tall pages — content deep in the scene hit-tested
      // but never painted. Margin breakout composites nothing.
      // overflow: clip (both axes): the parallax layers translate with
      // scroll and would otherwise overflow the scene's bottom, growing the
      // document by thousands of phantom px (un-sticking the header).
      style={{
        aspectRatio: `${W} / ${totalH}`,
        overflow: 'clip',
        marginLeft: 'calc(50% - 50vw)',
      }}
      role="list"
      aria-label="Your path up the mountain — one node per lesson"
    >
      {/* the sky: day at the trailhead, night at the summit, one gradient */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to top, var(--path-sky-low) 0%, var(--path-sky-low) 18%, var(--path-sky-mid) 46%, var(--path-sky-high) 72%, var(--path-sky-night) 88%)',
        }}
      />

      {/* ——— everything from here to the segment SVGs sits BEHIND the
             mountain body, so the converging peak occludes it: the depth.
             CRITICAL LAYERING RULE: a transformed (parallax) element must
             NEVER span the whole scene — Chromium composites it (and
             squashes overlapping siblings) into textures with a hard
             device-pixel budget; past it, paint silently drops. So every
             parallax layer is band-limited to the altitude range its
             content actually occupies, and ridges move individually. ——— */}

      {/* stars — the farthest layer, upper third only */}
      <m.div
        className="pointer-events-none absolute inset-x-0"
        style={{ top: 0, height: '34%', y: starsY }}
        aria-hidden
      >
        <Stars totalH={totalH} w={W} asHtml bandFrac={0.34} />
      </m.div>

      {/* far ridges — each its own small motion element */}
      {ridges.map((r) => (
        <m.svg
          key={r.key}
          viewBox={`0 0 ${2 * r.w2} ${r.h}`}
          className="pointer-events-none absolute"
          aria-hidden
          style={{
            left: `${((r.x - r.w2) / W) * 100}%`,
            top: `${((r.y - r.h) / totalH) * 100}%`,
            width: `${((2 * r.w2) / W) * 100}%`,
            opacity: r.o,
            y: ridgeY,
          }}
        >
          <path d={`M 0 ${r.h} Q ${r.w2} 0 ${2 * r.w2} ${r.h} Z`} style={{ fill: 'var(--color-ridge)' }} />
        </m.svg>
      ))}

      {/* the cloud band, drifting behind the mountain — band-limited */}
      <m.div
        className="pointer-events-none absolute inset-x-0"
        style={{ top: '10%', height: '44%', y: cloudY }}
        aria-hidden
      >
        {clouds.filter((c) => !c.fg).map((c) => (
          <svg
            key={c.key}
            viewBox="-45 -18 90 30"
            className={`absolute ${c.far ? 'cloud-drift-far' : 'cloud-drift'}`}
            style={{
              left: `${((c.x - 45 * c.s) / W) * 100}%`,
              top: `${(((c.y - 18 * c.s) / totalH - 0.1) / 0.44) * 100}%`,
              width: `${((90 * c.s) / W) * 100}%`,
              opacity: c.far ? 0.5 : 0.8,
            }}
          >
            <CloudPuff />
          </svg>
        ))}
      </m.div>

      {/* the mountain itself, in raster-budget-sized slices */}
      {segs.map(({ si, y0, within }) => {
        return (
          <svg
            key={si}
            viewBox={`0 ${y0} ${W} ${Math.min(SEG_UNITS, totalH - y0)}`}
            className="absolute inset-x-0 w-full"
            style={{ top: `${(y0 / totalH) * 100}%`, height: `${(Math.min(SEG_UNITS, totalH - y0) / totalH) * 100}%` }}
          >
            <defs>
              {/* stop-color must be set via style — as an ATTRIBUTE, var()
                  doesn't resolve and the stops silently paint black */}
              <linearGradient id={`mtn-g-${si}`} gradientUnits="userSpaceOnUse" x1="0" y1={totalH} x2="0" y2="0">
                <stop offset="0%" style={{ stopColor: 'var(--path-ground-low)' }} />
                <stop offset="52%" style={{ stopColor: 'var(--path-ground-mid)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--path-ground-high)' }} />
              </linearGradient>
            </defs>
            <path d={bodyPath} fill={`url(#mtn-g-${si})`} aria-hidden />

            {/* trailside scenery in this slice */}
            <g aria-hidden>
              {scenery.filter((sp) => within(sp.y)).map((sp) => (
                <g key={sp.key} transform={`translate(${sp.x} ${sp.y})`}>
                  <SpriteGlyph sp={sp} />
                </g>
              ))}
            </g>

            {/* the trail (full + walked overlay) — clipped by the viewBox */}
            <path d={full} fill="none" className="stroke-trail" strokeWidth="14" strokeLinecap="round" />
            <path d={walked} fill="none" className="stroke-trail-done" strokeWidth="14" strokeLinecap="round" />
            {renderSegmentNodes(within)}
          </svg>
        )
      })}

      {/* foreground wisps — you pass THROUGH the cloud band (band-limited) */}
      <m.div
        className="pointer-events-none absolute inset-x-0"
        style={{ top: '10%', height: '44%', y: fgY }}
        aria-hidden
      >
        {clouds.filter((c) => c.fg).map((c) => (
          <svg
            key={c.key}
            viewBox="-45 -18 90 30"
            className="absolute cloud-drift"
            style={{
              left: `${((c.x - 67 * c.s) / W) * 100}%`,
              top: `${(((c.y - 27 * c.s) / totalH - 0.1) / 0.44) * 100}%`,
              width: `${((135 * c.s) / W) * 100}%`,
              opacity: 0.9,
            }}
          >
            <CloudPuff />
          </svg>
        ))}
      </m.div>

      {/* summit block — goraikō sunrise and the trip-readiness meter */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 pt-2 text-center">
        <SummitScene />
        <div className="w-56 max-w-[70%]">
          <div className="h-2 overflow-hidden rounded-full bg-night-ink/20">
            <div className="h-full rounded-full bg-clay transition-[width] duration-700" style={{ width: `${summit.trip_ready_pct}%` }} />
          </div>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.08em] text-night-soft">
            TRIP-READY {summit.trip_ready_pct}%
            {summit.days_to_trip >= 0 && <> · {summit.days_to_trip} DAYS TO GO</>}
          </p>
        </div>
      </div>

      {/* unit headers + landmarks (HTML overlays; same geometry). Above the
          night line the sky is dark in both themes → night tokens. */}
      {unitMeta.map(({ unit: u, headerTopPct, headerSide, landmarkTopPct, landmarkSide, night }) => (
        <div key={u.id}>
          <div
            className={`absolute w-[30%] max-w-[230px] ${headerSide === 'left' ? 'left-[2%] text-left' : 'right-[2%] text-right'}`}
            style={{ top: `${headerTopPct}%` }}
            ref={u.lessons.some((l) => l.state === 'current') ? currentRef : undefined}
          >
            <p className={`font-mono text-[10px] uppercase tracking-[0.08em] ${night ? 'text-night-soft' : 'text-ink-soft'}`}>{u.kicker}</p>
            <h2 className={`font-display text-base font-semibold leading-tight ${night ? 'text-night-ink' : 'text-ink'}`}>{u.title}</h2>
            <p className={`mt-0.5 text-xs leading-snug ${night ? 'text-night-soft' : 'text-ink-soft'}`}>{u.summary}</p>
            {!u.authored && (
              <span className="mt-1 inline-block rounded-full bg-oat px-2 py-0.5 text-[10px] font-medium text-ink-mid">
                being written…
              </span>
            )}
          </div>
          {u.landmark !== 'fuji' /* the summit block owns the peak */ && (
            <div
              className="absolute -translate-x-1/2"
              style={{
                top: `${landmarkTopPct}%`,
                // anchored to the mountain's edge at this altitude — never
                // floating in the side sky beside the narrowing peak
                left: `${(() => {
                  const y = (landmarkTopPct / 100) * totalH + 20
                  const dir = landmarkSide === 'left' ? -1 : 1
                  const off = Math.max(96, Math.min(halfAtY(y) - 52, W / 2 - 44))
                  return ((CX + dir * off) / W) * 100
                })()}%`,
              }}
              aria-hidden
            >
              <Landmark kind={u.landmark} />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  /** Everything interactive at a node, rendered inside whichever segment
   * svg owns its y — extracted so the segment map above stays readable. */
  function renderSegmentNodes(within: (y: number, pad?: number) => boolean) {
    return (
      <>
        {nodes.filter((n) => within(n.y)).map((n) => {
          const { lesson: l } = n
          const isGate = l.kind === 'checkpoint'
          const clickable = l.state !== 'locked' && onSelectLesson
          const label = `${n.unit.title} — ${l.title} (${l.state}${l.stars ? `, ${l.stars} stars` : ''})`
          return (
            <g
              key={l.id}
              role="listitem"
              tabIndex={clickable ? 0 : -1}
              aria-label={label}
              onClick={clickable ? () => onSelectLesson(l.id, l.state) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectLesson(l.id, l.state)
                      }
                    }
                  : undefined
              }
              className={clickable ? 'cursor-pointer outline-none focus-visible:[&>circle:first-of-type]:stroke-clay' : ''}
            >
              <title>{l.state === 'locked' ? 'Finish the trail behind you first' : l.title}</title>
              {isGate ? (
                <Torii x={n.x} y={n.y} state={l.state} />
              ) : (
                <>
                  {l.state === 'current' && (
                    <circle cx={n.x} cy={n.y} r="34" className="fill-clay/20 motion-safe:animate-ping" style={{ animationDuration: '2s' }} />
                  )}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="28"
                    strokeWidth="2"
                    className={
                      l.state === 'done'
                        ? 'fill-olive stroke-olive'
                        : l.state === 'current'
                          ? 'fill-clay stroke-clay'
                          : l.state === 'available'
                            ? 'fill-paper stroke-line-strong'
                            : 'fill-paper-deep stroke-line'
                    }
                  />
                  <PawGlyph
                    x={n.x}
                    y={n.y}
                    className={
                      l.state === 'done' || l.state === 'current'
                        ? 'text-paper'
                        : l.state === 'available'
                          ? 'text-clay'
                          : 'text-cloud'
                    }
                  />
                </>
              )}
              {/* stars under done nodes */}
              {l.state === 'done' && !isGate && (
                <g>
                  {[0, 1, 2].map((s) => (
                    <Star key={s} cx={n.x - 12 + s * 12} cy={n.y + 38} filled={s < l.stars} />
                  ))}
                </g>
              )}
              {/* the kitsune, alive on the current node */}
              {l.state === 'current' && (
                <g transform={`translate(${n.x - 19} ${n.y - 62})`} aria-label="You are here">
                  <AnimatedKitsune mood={celebrating ? 'celebrating' : 'idle'} width={50} height={46} className="" />
                </g>
              )}
              {/* partner's ghost cat (sky), presence not competition */}
              {partnerNode?.lesson.id === l.id && partner && (
                <g transform={`translate(${n.x + 22} ${n.y - 50})`} opacity="0.75">
                  <title>{`${partner.display_name} is here`}</title>
                  <MichiMark variant="kitsune" width={37} height={34} className="text-sky" />
                </g>
              )}
            </g>
          )
        })}

        {/* the front door, where every journey starts (last segment only) */}
        {within(totalH - 108) && (
          <g transform={`translate(${nodes[0].x - 20} ${totalH - 108})`}>
            <rect x="4" y="18" width="32" height="40" rx="2" className="fill-paper-deep" />
            <path d="M0 20 L20 6 L40 20" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-ink-soft" stroke="currentColor" />
            <rect x="12" y="26" width="16" height="32" rx="1.5" className="fill-clay" />
            <circle cx="24.5" cy="42" r="1.6" className="fill-paper" />
          </g>
        )}
      </>
    )
  }
}
