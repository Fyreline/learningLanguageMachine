/** The path, in three dimensions — round two, rebuilt to the household's
 * notes (2026-07-09):
 *
 * - The trail is CARVED INTO the mountain, not floating beside it: the
 *   mountain is one custom parametric mesh whose vertex rows follow the
 *   helix, with a sharp inward radius step forming a flat walkable shelf
 *   and a leaning back-wall above it — a terrace cut, Machu Picchu style.
 * - The camera lives on the path now: close third-person, roughly one
 *   lesson visible either side of yours (cut off by the frame edges), and
 *   the ONLY control is scroll/drag up-down, which walks the focus along
 *   the helix — the mountain spins past as you climb.
 * - Snow is painted onto the mountain's own polygons above a wobbly
 *   snowline (no separate white cone), and every face gets an altitude-
 *   banded colour with per-facet variance: grass skirts, rock mid, snow
 *   top, dirt shelf, dark cut-wall.
 * - Personality: a river winds down one face (ducking under the trail at
 *   little wooden bridges, ending in a pond), two dark cave mouths, an
 *   onsen with drifting steam, a sakura-and-pine village at the base, low
 *   clouds to climb through, and the shinkansen — now actually facing the
 *   way it travels — looping through a foothill tunnel.
 *
 * Still: primitives + one generated mesh only, colours read live from the
 * Aizome tokens, lazy-loaded behind the Path page's experimental toggle,
 * same {manifest, onSelectLesson} contract as the 2D scene. */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { PathManifest } from '../pathData'
import { useSettings } from '../settings'
import { PALETTE, type KitsuneTone } from './AnimatedKitsune'
import mountainPatchJson from '../mountainPatch.json'

/* ---------------- household patch & tuning (tools/mountain-editor) ------- */

/** The spiral's household-adjustable proportions: the trail still starts at
 * the trailhead (t=0, radius baseRadius) and ends at the summit centre —
 * everything between (mountain surface, camera, lesson stones, scenery,
 * even the train's track) derives from these three numbers. */
interface MountainShape {
  baseRadius: number
  topRadius: number
  height: number
}

/** Close-third-person camera feel. Purely presentational — safe to tune. */
interface CameraTuning {
  distMin: number
  distMax: number
  height: number
  azimuthBias: number
  lookAtHeight: number
}

/** The decorative dressing — every placeable object except the ones the
 * curriculum owns (lesson stones, checkpoint torii, kitsune, summit gate),
 * which keep deriving from the manifest. `angle` is plain rotation.y.
 * The second row are add-in variants with no procedural placements of
 * their own — swap-ins and extras for the household to scatter. */
type SceneryKind =
  | 'pine' | 'sakura' | 'rock' | 'lantern' | 'bridge'
  | 'house' | 'onsen' | 'torii' | 'hill' | 'pond'
  | 'cedar' | 'snowpine' | 'maple' | 'bamboo' | 'deadtree'
  | 'torii-worn' | 'torii-fallen' | 'torii-broken' | 'shrine' | 'toro'

interface SceneryItem {
  id: string
  kind: SceneryKind
  x: number
  y: number
  z: number
  angle: number
  scale: number
  variant?: number
}

/** Scenery edits ride the same patch: base items (procedurally placed, ids
 * stable for a given shape) can be removed or re-transformed; new items are
 * appended. */
interface SceneryPatch {
  removed: string[]
  moved: { id: string; x: number; y: number; z: number; angle: number; scale: number }[]
  added: { kind: SceneryKind; x: number; y: number; z: number; angle: number; scale: number; variant?: number }[]
}

/** Hand edits to the generated mountain, made in tools/mountain-editor and
 * saved over src/mountainPatch.json. A patch is a diff against the generator's
 * output, keyed by face index: vertex moves land BEFORE the paint pass (so
 * moved faces re-band by their new altitude and stay theme-aware), while
 * recolours name a PAINT ROLE — one of the pass's own colours or a grey —
 * that resolves from the live palette at build time, so hand-painted corners
 * follow light/dark mode too. Deletions/additions come last. Face indices
 * only mean something for the build they were saved against, hence the
 * baseFaceCount guard — if buildMountain changes shape, re-export the patch
 * from the editor after re-porting it there. (shape/camera overrides don't
 * disturb the guard: the grid's topology is fixed, only positions move, and
 * the editor always saves its mesh edits against its own shape.) */
interface MountainPatch {
  version: number
  baseFaceCount: number | null
  movedCorners: [number, number, number, number][]
  /** [cornerIndex, paintRole]; legacy absolute [ci, r, g, b] entries from
   * pre-role patches are still applied, but cannot re-theme. */
  recoloredCorners: ([number, string] | [number, number, number, number])[]
  deletedFaces: number[]
  /** roles, when present, override colors per corner and re-theme. */
  addedFaces: { positions: number[]; colors: number[]; roles?: (string | null)[] }[]
  shape?: Partial<MountainShape>
  camera?: Partial<CameraTuning>
  scenery?: SceneryPatch
}

const mountainPatch = mountainPatchJson as unknown as MountainPatch

const SHAPE: MountainShape = {
  baseRadius: 18.45,
  topRadius: 7.5,
  height: 22,
  ...mountainPatch.shape,
}
SHAPE.height = Math.min(60, Math.max(8, SHAPE.height))
SHAPE.baseRadius = Math.min(40, Math.max(12, SHAPE.baseRadius))
SHAPE.topRadius = Math.max(2.6, SHAPE.topRadius) // plateau must survive: RTOP = topRadius − 2
// The no-overhang staircase floor: each loop must shrink by at least
// LIP_OUT + WALL_IN (2.65) plus sloped-face/jitter margin, per turn — any
// less and a loop's lip juts over the shelf below.
const MIN_SHRINK_PER_TURN = 3.05
if (SHAPE.baseRadius - SHAPE.topRadius < MIN_SHRINK_PER_TURN * 3) {
  console.warn('michi: mountain shape would overhang the trail — clamping the top radius')
  SHAPE.topRadius = SHAPE.baseRadius - MIN_SHRINK_PER_TURN * 3
}

const CAM: CameraTuning = {
  distMin: 9,
  distMax: 12,
  height: 3.4,
  azimuthBias: 0.12,
  lookAtHeight: 0.6,
  ...mountainPatch.camera,
}

/* ------------------------------ geometry -------------------------------- */

const HPATH = SHAPE.height // trail summit height
const PLATEAU_Y = HPATH + 0.9 // the flat summit
// 3 revolutions: a loose spiral that climbs plenty per wrap. Integral, to
// keep the terrace grid's seam stitching clean.
const TURNS = 3
const THETA0 = -Math.PI / 2
const NIGHT_LINE = 0.55

// THE TERRACED CONE (household cross-section sketch, round ten). There is
// no longer a "natural silhouette" with a notch cut into it — the mountain
// surface IS a staircase derived from the trail spiral: each loop is a flat
// step whose OUTER edge (the lip) lies on the mountain's outline, a short
// riser climbs from the step's inner edge, and one sloped face runs up to
// the next loop's lip. Every horizontal slice is wider than every slice
// above it, so nothing can ever overhang the trail.
const LIP_OUT = 1.05 // shelf continues this far outside the path centreline
const WALL_IN = 1.6 // ...and this far inside, to the riser's foot
// (shelf width = 2.65; a torii spans ±0.73 and sits fully on it, centred)

// The trail is a CONSTANT-ARC spiral, not a linear helix: with dθ/dt fixed,
// arc-per-lesson shrinks with radius and the summit lessons bunched into a
// crowd (household note). Solve dθ/dt = C / r(t) with r(t) = A − B·t linear
// → θ(t) = θ0 + (C/B)·ln(A / (A − B·t)), and every lesson is the same
// stride apart from base to summit.
const SPIRAL_A = SHAPE.baseRadius // path radius at the trailhead (default 18.45)
// Default per-turn shrink of 3.65: each loop's OUTER edge sits inside the
// loop below's INNER edge, which is exactly the no-overhang staircase
// condition — MIN_SHRINK_PER_TURN above enforces the floor for overrides.
const SPIRAL_B = SPIRAL_A - SHAPE.topRadius

/** The path spiral's radius at height y — the terraced surface, scenery
 * and camera all derive from this envelope now. */
function pathR(y: number): number {
  return SPIRAL_A - (SPIRAL_B * Math.min(Math.max(y, 0), HPATH)) / HPATH
}

// plateau rim: just inside the top loop's riser
const RTOP = SPIRAL_A - SPIRAL_B - WALL_IN - 0.4

/** Legacy-named envelope used by scenery/camera placement: mid-face line
 * of the terraced surface at height y. */
function mountainR(y: number): number {
  return pathR(y) - 0.3
}

// the mountain's footprint (the trailhead lip) — base scenery rings, the
// train track and the ground plain all measure out from here
const R0 = SPIRAL_A + LIP_OUT
const SPIRAL_C =
  (TURNS * 2 * Math.PI * SPIRAL_B) / Math.log(SPIRAL_A / (SPIRAL_A - SPIRAL_B))

function trailAngle(t: number): number {
  return THETA0 + (SPIRAL_C / SPIRAL_B) * Math.log(SPIRAL_A / (SPIRAL_A - SPIRAL_B * t))
}

/** Inverse of trailAngle: progress t at a total unwrapped angle. */
function tAtAngle(thetaTotal: number): number {
  return (SPIRAL_A / SPIRAL_B) * (1 - Math.exp((-(thetaTotal - THETA0) * SPIRAL_B) / SPIRAL_C))
}

// slightly above the plateau's gently domed centre (the rings stack ~0.1)
const SUMMIT_CENTRE = new THREE.Vector3(0, PLATEAU_Y + 0.16, 0)
// After the second-to-last lesson the trail keeps bending round the
// mountain for another ~40° of wrap (nodes are compressed into t≤0.99·…,
// see NODE_T — the household liked the spiral continuing before the climb)
// and only THEN turns up to the centre of the plateau. The bend is a
// STRAIGHT line from a fixed anchor to the centre — blending from the
// still-moving spiral point curved the walkway ~30° off the camera's axis,
// which read as the path arriving off-centre of the gate.
const T_BEND = 0.9945
const BLEND0 = T_BEND - 0.0001

/** Where lesson i of n sits in t-space: the last lesson is the summit
 * centre (t=1); everyone else spreads over [0, 0.99·(n−2)/(n−1)] so the
 * spiral carries on past the final gate before the walkway turns up. */
function nodeT(i: number, n: number): number {
  if (i >= n - 1) return 1
  return (0.99 * i) / (n - 1)
}
const APPROACH_A = (() => {
  return trailAngle(T_BEND)
})()
const ANCHOR = (() => {
  const h = T_BEND * HPATH
  const r = pathR(h)
  return new THREE.Vector3(Math.cos(APPROACH_A) * r, h + 0.02, Math.sin(APPROACH_A) * r)
})()

/** Walk-level point on the carved shelf at progress t. */
function pathPoint(t: number): THREE.Vector3 {
  if (t > BLEND0) {
    const f = Math.min(1, (t - BLEND0) / (1 - BLEND0))
    const s = f * f * (3 - 2 * f)
    // height rises FASTER than the ground track: the bend climbs up over
    // the plateau rim and crosses ON TOP of it — lerping y at the same
    // rate dived the stepping stones underneath the summit's flat cap.
    // 3.4×: with the balcony anchor now well outside the rim, the climb
    // must clear the rim slope before crossing it.
    const sUp = Math.min(1, s * 3.4)
    return new THREE.Vector3(
      ANCHOR.x + (SUMMIT_CENTRE.x - ANCHOR.x) * s,
      ANCHOR.y + (SUMMIT_CENTRE.y - ANCHOR.y) * sUp,
      ANCHOR.z + (SUMMIT_CENTRE.z - ANCHOR.z) * s,
    )
  }
  const h = t * HPATH
  const a = trailAngle(t)
  const r = pathR(h)
  return new THREE.Vector3(Math.cos(a) * r, h + 0.02, Math.sin(a) * r)
}

function mulberry(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let x = Math.imul(s ^ (s >>> 15), 1 | s)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function angDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

// the river's wobbly course down the mountainside, and the two cave mouths
const riverPhi = (y: number) => 2.1 + 0.35 * Math.sin(y * 0.5 + 1)
// Cave mouths: painted dark + a SHALLOW recess only. A deep radius carve
// here spans the sparse between-turn vertex rows and rips a floor-to-ledge
// canyon into the base — shadow-painting reads better than honest geometry
// at this grid resolution.
const CAVES = [
  { phi: 5.7, y: 6.2, rp: 0.3, ry: 1.3 },
  { phi: 0.6, y: 10.8, rp: 0.24, ry: 1.1 },
]

/** dy from height y to the nearest pass of the spiral at azimuth phi. */
function nearestTurnDy(phi: number, y: number): number | null {
  const thetaOff = (((phi - THETA0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  let best: number | null = null
  for (let k = 0; k < TURNS; k++) {
    const h = tAtAngle(THETA0 + thetaOff + k * Math.PI * 2) * HPATH
    const dy = y - h
    if (best === null || Math.abs(dy) < Math.abs(best)) best = dy
  }
  return best
}

/* ------------------------------- theming -------------------------------- */

interface ScenePalette {
  paper: string
  ink: string
  clay: string
  olive: string
  kraft: string
  cloud: string
  trail: string
  trailDone: string
  liquid: string
  gold: string
}

function readToken(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function readPalette(): ScenePalette {
  return {
    paper: readToken('--color-paper', '#f7fbfa'),
    ink: readToken('--color-ink', '#1f2933'),
    clay: readToken('--color-clay', '#c33c54'),
    olive: readToken('--color-olive', '#788c5d'),
    kraft: readToken('--color-kraft', '#b08968'),
    cloud: readToken('--color-cloud', '#c3cdd5'),
    trail: readToken('--color-trail', '#8ee3ef'),
    trailDone: readToken('--color-trail-done', '#788c5d'),
    liquid: readToken('--color-liquid', '#37718e'),
    gold: '#e8b84b',
  }
}

function usePalette(): ScenePalette {
  const [pal, setPal] = useState(readPalette)
  useEffect(() => {
    const mo = new MutationObserver(() => setPal(readPalette()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return pal
}

/* --------------------------- the mountain mesh --------------------------- */

// Row offsets relative to each loop of the terrace staircase: a hair below
// the lip (the outline), the lip itself, the shelf's inner edge (the sharp
// radius drop between −0.06 and 0 IS the flat step), then two riser rows.
const ROW_OFFS = [-0.5, -0.06, 0, 0.9, 1.6]
// sloped-face rows running from the riser's top to the next loop's lip
const GAP_FRACS = [0.2, 0.4, 0.6, 0.8]
const ROWS_PER_TURN = ROW_OFFS.length + GAP_FRACS.length
// hoisted so capTriangles() can share it with buildMountain's per-column
// loop — both need the SAME column count to reference the SAME rim angles
const COLS = 112

/** Radius of a terrace row. `rp` is the path radius at the loop's height;
 * `ds` fades the step back into a plain cone face past the walkway anchor. */
function terraceRadius(rp: number, offIdx: number, ds: number): number {
  const face = rp // the melted (stepless) face just follows the envelope
  let step: number
  switch (offIdx) {
    case 0: step = rp + LIP_OUT + 0.07; break // outline just below the lip
    case 1: step = rp + LIP_OUT; break // the lip — the mountain's outline
    case 2: step = rp - WALL_IN; break // shelf inner edge / riser foot
    case 3: step = rp - WALL_IN - 0.06; break // riser
    case 4: step = rp - WALL_IN - 0.12; break // riser top
    default: step = rp
  }
  return face + (step - face) * ds
}

/** Exported for the patch-application test — the app always calls this with
 * the committed src/mountainPatch.json. */
export function buildMountain(
  pal: ScenePalette,
  patch: MountainPatch = mountainPatch,
): THREE.BufferGeometry {
  // per-column vertex rows, bottom→top, all columns sharing the same count
  const rows: { y: number; r: number }[][] = []
  for (let j = 0; j < COLS; j++) {
    const jj = j
    const phi = THETA0 + (jj / COLS) * Math.PI * 2
    const thetaNorm = jj / COLS
    // columns in the walkway's corridor drop their rim: the climbing
    // stairs pass through a notch in the mountain's edge instead of
    // clipping the lip on their way onto the plateau
    const inCorridor = angDiff(phi, APPROACH_A) < 0.16
    const clampY = inCorridor ? PLATEAU_Y - 0.5 : PLATEAU_Y - 0.012
    const col: { y: number; r: number }[] = []
    // Modest foot flare only — a big one (this was 2.6) sat at the exact
    // radius the low camera orbits, shoving a dark wall across the frame.
    col.push({ y: 0, r: R0 + 0.8 })
    // k = −1 is a virtual turn below the trailhead: the constant-arc spiral
    // makes the first real turn climb ~8 units by the time it wraps once,
    // and without these rows the whole base-to-first-shelf band was one
    // stretch of skyscraper quads (household note, round six). Virtual rows
    // clamp to ground where they'd dip below it — degenerate but uniform,
    // which is what the seam stitching needs.
    for (let k = -1; k < TURNS; k++) {
      const h = tAtAngle(THETA0 + (thetaNorm + k) * Math.PI * 2) * HPATH
      const hNext =
        k < TURNS - 1
          ? tAtAngle(THETA0 + (thetaNorm + k + 1) * Math.PI * 2) * HPATH
          : PLATEAU_Y + 0.5
      const tk = h / HPATH
      // the step melts back into a plain cone face past the walkway anchor
      // (T_BEND) — the straight climb takes over from there
      const ds = k < 0 ? 0 : 1 - Math.min(1, Math.max(0, (tk - T_BEND) / (1 - T_BEND)))
      const rp = pathR(h)
      const rpNext = pathR(Math.min(hNext, HPATH))
      // the sloped face between this loop's riser top and the next loop's
      // lip — always INWARD-going-up (the staircase condition), never an
      // overhang
      const faceFrom = { y: h + 1.6, r: rp - WALL_IN - 0.12 }
      const faceTo = { y: hNext - 0.5, r: rpNext + LIP_OUT + 0.07 }
      for (let oi = 0; oi < ROW_OFFS.length; oi++) {
        let y = h + ROW_OFFS[oi]
        // Jitter only on the outline row, seeded from (column, row) rather
        // than drawn from a running stream, or the seam's twins diverge.
        const jrnd = mulberry(jj * 7919 + (k + 1) * 131 + oi)
        if (oi === 0 || ds < 0.4) y += (jrnd() - 0.5) * 0.25 * (ds < 0.4 ? 0.6 : 1)
        y = Math.min(clampY, Math.max(0.02, y))
        let r = terraceRadius(rp, oi, ds)
        if (oi === 0) r += (jrnd() - 0.5) * 0.3
        // river groove + cave shadows live on the open faces, not the step
        if (angDiff(phi, riverPhi(y)) < 0.1 && (oi === 0 || ds === 0)) r -= 0.5
        for (const c of CAVES) {
          const e = (angDiff(phi, c.phi) / c.rp) ** 2 + ((y - c.y) / c.ry) ** 2
          if (e < 1 && (oi === 0 || ds === 0)) r -= 0.9 * (1 - e)
        }
        // rows squashed onto the rim JOIN it exactly
        if (y >= clampY - 0.02) r = RTOP
        col.push({ y, r: Math.max(0.05, r) })
      }
      // the open face up to the next loop's lip
      for (let gi = 0; gi < GAP_FRACS.length; gi++) {
        const jrnd = mulberry(jj * 6577 + (k + 1) * 149 + gi)
        const f = GAP_FRACS[gi]
        let y = faceFrom.y + f * (faceTo.y - faceFrom.y) + (jrnd() - 0.5) * 0.3
        y = Math.min(clampY, Math.max(0.02, y))
        // interpolate along the face line, by height
        const fy = Math.min(1, Math.max(0, (y - faceFrom.y) / Math.max(0.001, faceTo.y - faceFrom.y)))
        let r = faceFrom.r + fy * (faceTo.r - faceFrom.r) + (jrnd() - 0.5) * 0.4
        if (k < 0) r = pathR(y) + LIP_OUT + 0.07 + (jrnd() - 0.5) * 0.4
        if (angDiff(phi, riverPhi(y)) < 0.1) r -= 0.5
        for (const c of CAVES) {
          const e = (angDiff(phi, c.phi) / c.rp) ** 2 + ((y - c.y) / c.ry) ** 2
          if (e < 1) r -= 0.9 * (1 - e)
        }
        if (y >= clampY - 0.02) r = RTOP
        col.push({ y, r: Math.max(0.05, r) })
      }
    }
    // the grid stops AT the rim — the plateau's top face is triangulated
    // separately (see capTriangles) and welded on by reusing these exact
    // rim vertices, because any ring-to-centre topology here fans 112
    // spokes into one point
    col.push({ y: inCorridor ? PLATEAU_Y - 0.42 : PLATEAU_Y, r: RTOP })
    // enforce strictly climbing rows (clamps near the ground can stack)
    for (let i = 1; i < col.length; i++) {
      if (col[i].y <= col[i - 1].y + 0.015) col[i].y = col[i - 1].y + 0.015
    }
    rows.push(col)
  }

  // The rim row per column — captured here (rather than recomputed) so
  // capTriangles' outer ring shares BIT-IDENTICAL positions with the
  // cone's own rim: same {y, r} objects, same Math.cos/sin(phi) formula
  // below, so the editor's position-keyed vertex weld actually joins them
  // into one mesh instead of two that just sit flush.
  const rimRows = rows.map((col) => col[col.length - 1])

  // Stitching: within a column pair, rows align by index — EXCEPT across
  // the wrap-around seam, where the helix's turn index shifts by one. Row
  // (k, oi) on the last column continues as row (k+1, oi) on column 0, so
  // the seam pairs indices offset by one turn's worth of rows; pairing by
  // raw index there stretched every quad a full turn tall and tore a
  // ragged dark crack straight down the trailhead azimuth.
  const RPT = ROWS_PER_TURN
  const rowCount = rows[0].length
  const positions: number[] = []
  for (let j = 0; j < COLS; j++) {
    const seam = j === COLS - 1
    const phiA = THETA0 + (j / COLS) * Math.PI * 2
    const phiB = THETA0 + ((j + 1) / COLS) * Math.PI * 2
    const colA = rows[j]
    const colB = rows[(j + 1) % COLS]
    const shift = seam ? RPT : 0
    for (let i = 0; i < rowCount - 1; i++) {
      const a0 = colA[i], a1 = colA[i + 1]
      const b0 = colB[Math.min(i + shift, rowCount - 1)]
      const b1 = colB[Math.min(i + 1 + shift, rowCount - 1)]
      const pA0 = [Math.cos(phiA) * a0.r, a0.y, Math.sin(phiA) * a0.r]
      const pA1 = [Math.cos(phiA) * a1.r, a1.y, Math.sin(phiA) * a1.r]
      const pB0 = [Math.cos(phiB) * b0.r, b0.y, Math.sin(phiB) * b0.r]
      const pB1 = [Math.cos(phiB) * b1.r, b1.y, Math.sin(phiB) * b1.r]
      // counter-clockwise seen from OUTSIDE — the first cut of this mesh
      // wound the triangles inward, so with backface culling the renderer
      // drew the mountain's interior and culled the slope you were actually
      // looking at (the household spotted it: "renders the inside faces")
      positions.push(...pA0, ...pA1, ...pB0, ...pB0, ...pA1, ...pB1)
    }
    if (seam) {
      // bottom wedge: fan column 0's below-first-turn rows against the
      // last column's foot ring, closing the spiral where it meets ground
      const a0 = colA[0]
      const pA0 = [Math.cos(phiA) * a0.r, a0.y, Math.sin(phiA) * a0.r]
      for (let i = 0; i < RPT; i++) {
        const b0 = colB[i], b1 = colB[i + 1]
        const pB0 = [Math.cos(phiB) * b0.r, b0.y, Math.sin(phiB) * b0.r]
        const pB1 = [Math.cos(phiB) * b1.r, b1.y, Math.sin(phiB) * b1.r]
        positions.push(...pA0, ...pB1, ...pB0)
      }
    }
  }

  // Weld the plateau's top face onto the cone's own rim, rather than
  // rendering it as a visually-flush-but-topologically-separate mesh — see
  // capTriangles for how the outer ring shares the cone's exact vertices.
  const coneFaceCount = positions.length / 9
  positions.push(...capTriangles(rimRows))
  const capFaceCount = positions.length / 9 - coneFaceCount

  const patchOk =
    patch.baseFaceCount === null || patch.baseFaceCount * 9 === positions.length
  if (!patchOk) {
    console.warn('michi: mountainPatch.json was saved against a different mountain build — ignoring it')
  }
  if (patchOk) {
    for (const [ci, x, y, z] of patch.movedCorners) {
      positions[ci * 3] = x
      positions[ci * 3 + 1] = y
      positions[ci * 3 + 2] = z
    }
  }

  // per-face painting: altitude bands + carve/river/cave overrides
  const grass = new THREE.Color(pal.olive)
  const grassLight = grass.clone().lerp(new THREE.Color('#ffffff'), 0.12)
  const rock = new THREE.Color(pal.cloud).lerp(new THREE.Color(pal.ink), 0.42)
  const rockDark = new THREE.Color(pal.cloud).lerp(new THREE.Color(pal.ink), 0.42)
  const snow = new THREE.Color('#f3f6f5')
  const dirt = new THREE.Color(pal.kraft).lerp(new THREE.Color(pal.cloud), 0.08)
  const water = new THREE.Color(pal.liquid)
  const caveInk = new THREE.Color(pal.ink).lerp(new THREE.Color('#000000'), 0.35)

  // the paint roles the household can recolour with (tools/mountain-editor):
  // the pass's own colours plus a small grey ramp, all resolved from the
  // live palette here so hand recolours re-theme like everything else
  const roleColours: Record<string, THREE.Color> = {
    grass,
    'grass-light': grassLight,
    rock,
    snow,
    dirt,
    water,
    'cave-ink': caveInk,
    'grey-light': new THREE.Color(pal.cloud).lerp(new THREE.Color('#ffffff'), 0.3),
    grey: new THREE.Color(pal.cloud),
    'grey-dark': new THREE.Color(pal.cloud).lerp(new THREE.Color(pal.ink), 0.6),
  }

  const cRnd = mulberry(99)
  const colours: number[] = []
  // float32-rounded reads, exactly as the old read-back-from-the-attribute
  // gave — some band comparisons sit right on their thresholds
  const pos = new Float32Array(positions)
  const tmp = new THREE.Color()
  // altitude-banded painting is a CONE-body-only rule (snowline, shelf/wall
  // detection etc. are all trail-relative) — the cap's flat, wide faces
  // paint separately just below, same as when it was its own mesh
  for (let f = 0; f < coneFaceCount * 3; f += 3) {
    const cx = (pos[f * 3] + pos[(f + 1) * 3] + pos[(f + 2) * 3]) / 3
    const cy = (pos[f * 3 + 1] + pos[(f + 1) * 3 + 1] + pos[(f + 2) * 3 + 1]) / 3
    const cz = (pos[f * 3 + 2] + pos[(f + 1) * 3 + 2] + pos[(f + 2) * 3 + 2]) / 3
    const phi = Math.atan2(cz, cx)
    const dy = nearestTurnDy(phi, cy)
    const snowline = 16.4 + 1.5 * Math.sin(2.3 * phi + 0.8) + cRnd() * 1.1

    let inCave = false
    for (const c of CAVES) {
      if ((angDiff(phi, c.phi) / c.rp) ** 2 + ((cy - c.y) / c.ry) ** 2 < 0.8) inCave = true
    }
    const onShelf = dy !== null && dy > -0.22 && dy < 0.11 && cy < PLATEAU_Y - 0.35
    const onWall = dy !== null && dy >= 0.11 && dy < 1.3 && cy < PLATEAU_Y - 0.3
    const onRiver = angDiff(phi, riverPhi(cy)) < 0.11 && !(dy !== null && dy > -0.5 && dy < 1.3)

    if (inCave && !onShelf) tmp.copy(caveInk)
    else if (onShelf) tmp.copy(dirt)
    else if (onRiver) tmp.copy(water).lerp(new THREE.Color('#ffffff'), cy > snowline ? 0.45 : 0.08)
    else if (onWall) tmp.copy(rockDark)
    else if (cy > snowline || (cy > snowline - 2 && cRnd() < 0.3)) tmp.copy(snow)
    else if (cy < 8.5) tmp.copy(cRnd() < 0.5 ? grass : grassLight).lerp(rock, Math.max(0, (cy - 4) / 10))
    else tmp.copy(rock).lerp(grass, Math.max(0, (12 - cy) / 8) * 0.5)

    tmp.multiplyScalar(0.93 + cRnd() * 0.14)
    for (let v = 0; v < 3; v++) colours.push(tmp.r, tmp.g, tmp.b)
  }

  // the cap's own speckled snow/rock paint, unchanged from when it was a
  // separate mesh — same seed, so the summit keeps its look
  const capSnow = new THREE.Color('#f3f6f5')
  const capRock = new THREE.Color(pal.cloud).lerp(new THREE.Color(pal.ink), 0.35)
  const capRnd = mulberry(271)
  for (let i = 0; i < capFaceCount; i++) {
    tmp.copy(capRnd() < 0.15 ? capRock : capSnow).multiplyScalar(0.94 + capRnd() * 0.12)
    for (let v = 0; v < 3; v++) colours.push(tmp.r, tmp.g, tmp.b)
  }

  let finalPos: number[] = positions
  let finalCol: number[] = colours
  if (patchOk) {
    for (const rc of patch.recoloredCorners) {
      const ci = rc[0]
      let cr: number, cg: number, cb: number
      if (typeof rc[1] === 'string') {
        const c = roleColours[rc[1]] ?? roleColours.grey
        cr = c.r
        cg = c.g
        cb = c.b
      } else {
        const abs = rc as [number, number, number, number]
        cr = abs[1]
        cg = abs[2]
        cb = abs[3]
      }
      colours[ci * 3] = cr
      colours[ci * 3 + 1] = cg
      colours[ci * 3 + 2] = cb
    }
    if (patch.deletedFaces.length > 0 || patch.addedFaces.length > 0) {
      const drop = new Set(patch.deletedFaces)
      finalPos = []
      finalCol = []
      for (let f = 0; f * 9 < positions.length; f++) {
        if (drop.has(f)) continue
        for (let i = 0; i < 9; i++) {
          finalPos.push(positions[f * 9 + i])
          finalCol.push(colours[f * 9 + i])
        }
      }
      for (const af of patch.addedFaces) {
        finalPos.push(...af.positions)
        for (let k = 0; k < 3; k++) {
          const role = af.roles?.[k]
          const c = role ? roleColours[role] : undefined
          if (c) finalCol.push(c.r, c.g, c.b)
          else finalCol.push(af.colors[k * 3], af.colors[k * 3 + 1], af.colors[k * 3 + 2])
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(finalPos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(finalCol, 3))
  geo.computeVertexNormals()
  return geo
}

/** The plateau's top face — POSITIONS ONLY (buildMountain colours it,
 * having appended these onto the cone's own position array). Welded
 * straight onto the cone's rim: the outer ring reuses `rimRows`, the
 * SAME {y, r} pairs the per-column loop already computed for the cone's
 * top row, converted with the identical Math.cos/sin(phi) formula — so the
 * cap and cone are no longer two meshes that just sit flush, they share
 * real vertices at the seam (the editor's position-keyed weld joins them
 * automatically). Inner rings step down with FEWER segments toward the
 * middle, stitched by walking both rings' angles — so triangles stay
 * chunky and uniform instead of 112 spokes converging on a single centre
 * vertex (household notes, rounds five AND six). */
function capTriangles(rimRows: { y: number; r: number }[]): number[] {
  const outerRing = rimRows.map((rv, j) => {
    const phi = THETA0 + (j / COLS) * Math.PI * 2
    return new THREE.Vector3(Math.cos(phi) * rv.r, rv.y, Math.sin(phi) * rv.r)
  })
  const INNER_RINGS: { r: number; n: number; y: number }[] = [
    { r: RTOP * 0.72, n: 28, y: PLATEAU_Y + 0.05 },
    { r: RTOP * 0.44, n: 16, y: PLATEAU_Y + 0.08 },
    { r: RTOP * 0.2, n: 8, y: PLATEAU_Y + 0.1 },
  ]
  const rnd = mulberry(4831)
  const innerRings: THREE.Vector3[][] = INNER_RINGS.map(({ r, n, y }) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const wob = 1 + (rnd() - 0.5) * 0.14
      const vy = y + (rnd() - 0.5) * 0.045
      return new THREE.Vector3(Math.cos(a) * r * wob, vy, Math.sin(a) * r * wob)
    }),
  )
  const rings = [outerRing, ...innerRings]
  const centre = new THREE.Vector3(0, PLATEAU_Y + 0.11, 0)

  const positions: number[] = []
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    // force the upward winding regardless of walk order
    const crossY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
    if (crossY >= 0) positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    else positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
  }
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const outer = rings[ri]
    const inner = rings[ri + 1]
    let i = 0
    let j = 0
    while (i < outer.length || j < inner.length) {
      if (j >= inner.length || (i < outer.length && (i + 1) / outer.length <= (j + 1) / inner.length)) {
        tri(outer[i % outer.length], outer[(i + 1) % outer.length], inner[j % inner.length])
        i++
      } else {
        tri(inner[j % inner.length], inner[(j + 1) % inner.length], outer[i % outer.length])
        j++
      }
    }
  }
  const last = rings[rings.length - 1]
  for (let i = 0; i < last.length; i++) tri(last[i], last[(i + 1) % last.length], centre)
  return positions
}

/* ------------------------------ tiny models ----------------------------- */

function NumberSprite({ n, colour, position }: { n: number; colour: string; position: THREE.Vector3 }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    g.font = '600 34px "JetBrains Mono Variable", monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = colour
    g.fillText(String(n), 32, 34)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [n, colour])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={[position.x, position.y + 0.95, position.z]} scale={[0.72, 0.72, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

function Torii({ position, angle, scale = 1, colour }: { position: THREE.Vector3; angle: number; scale?: number; colour: string }) {
  return (
    <group position={position} rotation={[0, -angle, 0]} scale={scale}>
      <mesh position={[-0.62, 0.65, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 1.35, 6]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0.62, 0.65, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 1.35, 6]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <boxGeometry args={[1.85, 0.15, 0.22]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1.46, 0.1, 0.15]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
    </group>
  )
}

function Lantern({ position, lit, warm, post }: { position: THREE.Vector3; lit: boolean; warm: string; post: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.6, 5]} />
        <meshStandardMaterial color={post} flatShading />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[0.22, 0.26, 0.22]} />
        <meshStandardMaterial color={warm} emissive={lit ? warm : '#000000'} emissiveIntensity={lit ? 0.9 : 0} flatShading />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <coneGeometry args={[0.2, 0.14, 4]} />
        <meshStandardMaterial color={post} flatShading />
      </mesh>
    </group>
  )
}

function Pine({ position, scale, foliage, trunk }: { position: THREE.Vector3; scale: number; foliage: string; trunk: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 0.5, 5]} />
        <meshStandardMaterial color={trunk} flatShading />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <coneGeometry args={[0.42, 0.85, 6]} />
        <meshStandardMaterial color={foliage} flatShading />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <coneGeometry args={[0.28, 0.6, 6]} />
        <meshStandardMaterial color={foliage} flatShading />
      </mesh>
    </group>
  )
}

const SAKURA_PINK = '#e7a8b8'

function Sakura({ position, scale, trunk }: { position: THREE.Vector3; scale: number; trunk: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.32, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.06, 0.1, 0.64, 5]} />
        <meshStandardMaterial color={trunk} flatShading />
      </mesh>
      <mesh position={[0.1, 0.78, 0]}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={SAKURA_PINK} flatShading />
      </mesh>
      <mesh position={[-0.22, 0.62, 0.12]}>
        <dodecahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color={SAKURA_PINK} flatShading />
      </mesh>
    </group>
  )
}

function House({ position, rotation, wall, roof }: { position: THREE.Vector3; rotation: number; wall: string; roof: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[1.15, 0.76, 0.95]} />
        <meshStandardMaterial color={wall} flatShading />
      </mesh>
      <mesh position={[0, 0.98, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.95, 0.55, 4]} />
        <meshStandardMaterial color={roof} flatShading />
      </mesh>
    </group>
  )
}

/** Onsen: a steaming pool ringed with rocks — the steam puffs rise, drift
 * and fade on a loop. */
function Onsen({ position, pal }: { position: THREE.Vector3; pal: ScenePalette }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    puffs.current.forEach((m, i) => {
      if (!m) return
      const cycle = (clock.elapsedTime * 0.35 + i * 0.33) % 1
      m.position.y = 0.3 + cycle * 1.7
      m.position.x = Math.sin(clock.elapsedTime * 0.8 + i * 2) * 0.25
      const mat = m.material as THREE.MeshStandardMaterial
      mat.opacity = 0.42 * (1 - cycle)
      m.scale.setScalar(0.5 + cycle * 0.9)
    })
  })
  const rocks = useMemo(() => {
    const rnd = mulberry(31)
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return { x: Math.cos(a) * 1.9, z: Math.sin(a) * 1.9, s: 0.32 + rnd() * 0.25 }
    })
  }, [])
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.7, 1.8, 0.2, 10]} />
        <meshStandardMaterial color={pal.liquid} emissive={pal.liquid} emissiveIntensity={0.18} flatShading />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, 0.18, r.z]} scale={r.s}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={pal.cloud} flatShading />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m }} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.4, 6, 5]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Low clouds you climb through — slow orbit round the mid mountain. */
function Clouds() {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.012
  })
  const puffs = useMemo(() => {
    const rnd = mulberry(55)
    return Array.from({ length: 7 }, () => ({
      a: rnd() * Math.PI * 2,
      y: 9.5 + rnd() * 5.5,
      out: 4.5 + rnd() * 3,
      s: 0.9 + rnd() * 1.1,
    }))
  }, [])
  return (
    <group ref={group}>
      {puffs.map((p, i) => {
        const r = mountainR(p.y) + p.out
        return (
          <group key={i} position={[Math.cos(p.a) * r, p.y, Math.sin(p.a) * r]} scale={[p.s * 1.7, p.s * 0.55, p.s]}>
            <mesh>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#f4f7f6" transparent opacity={0.85} flatShading />
            </mesh>
            <mesh position={[0.9, -0.1, 0.2]} scale={0.6}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#f4f7f6" transparent opacity={0.85} flatShading />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Kitsune3D({ position, angle, tone, ghost = false, scale = 1 }: {
  position: THREE.Vector3
  angle: number
  tone: KitsuneTone
  ghost?: boolean
  scale?: number
}) {
  const group = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const body = PALETTE[tone].body
  const shadow = PALETTE[tone].shadow
  const matProps = { flatShading: true, transparent: ghost, opacity: ghost ? 0.55 : 1 }

  useFrame(({ clock }) => {
    const s = clock.elapsedTime
    if (group.current) group.current.position.y = position.y + Math.sin(s * 2.1) * 0.035
    if (tail.current) tail.current.rotation.z = Math.sin(s * 2.6) * 0.14
  })

  return (
    // -angle, no half-turn: the household caught the foxes walking the
    // trail backwards
    <group ref={group} position={position} rotation={[0, -angle, 0]} scale={scale}>
      <mesh position={[0, 0.34, 0]}>
        <coneGeometry args={[0.34, 0.72, 7]} />
        <meshStandardMaterial color={body} {...matProps} />
      </mesh>
      <mesh position={[0, 0.3, 0.16]} scale={[0.7, 1, 0.7]}>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshStandardMaterial color="#f6efdf" {...matProps} />
      </mesh>
      <mesh position={[0, 0.78, 0.05]}>
        <dodecahedronGeometry args={[0.23, 0]} />
        <meshStandardMaterial color={body} {...matProps} />
      </mesh>
      <mesh position={[0, 0.72, 0.26]} rotation={[Math.PI / 2.6, 0, 0]}>
        <coneGeometry args={[0.09, 0.2, 5]} />
        <meshStandardMaterial color="#f6efdf" {...matProps} />
      </mesh>
      <mesh position={[-0.12, 1.0, 0.02]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.075, 0.24, 4]} />
        <meshStandardMaterial color={shadow} {...matProps} />
      </mesh>
      <mesh position={[0.12, 1.0, 0.02]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.075, 0.24, 4]} />
        <meshStandardMaterial color={shadow} {...matProps} />
      </mesh>
      {/* tail: narrow end ATTACHED at the rump, bushy wide end swept up and
          out behind — inverted from the first pass, which had the fat end
          on the body (household note, round ten) */}
      <group ref={tail} position={[0, 0.32, -0.22]}>
        <mesh position={[0, 0.2, -0.22]} rotation={[2.55, 0, 0]}>
          <coneGeometry args={[0.2, 0.62, 6]} />
          <meshStandardMaterial color={shadow} {...matProps} />
        </mesh>
        <mesh position={[0, 0.4, -0.4]}>
          <sphereGeometry args={[0.14, 6, 5]} />
          <meshStandardMaterial color="#f6efdf" {...matProps} />
        </mesh>
      </group>
    </group>
  )
}

/** The shinkansen — nose first this time (the first pass had the cars
 * rotated 90° to their own direction of travel). rotation.y = -a points
 * local +Z (the nose) along the track tangent. */
function Train({ pal }: { pal: ScenePalette }) {
  const group = useRef<THREE.Group>(null)
  const TRACK_R = R0 + 5
  useFrame(({ clock }) => {
    if (!group.current) return
    const a = clock.elapsedTime * 0.16
    group.current.position.set(Math.cos(a) * TRACK_R, 0.36, Math.sin(a) * TRACK_R)
    group.current.rotation.y = -a
  })
  const car = (z: number, nose = false) => (
    <group position={[0, 0, z]} key={z}>
      <mesh scale={nose ? [0.5, 0.48, 1.32] : [0.53, 0.5, 1.27]}>
        <boxGeometry />
        <meshStandardMaterial color="#eef2f1" flatShading />
      </mesh>
      <mesh position={[0, -0.07, 0]} scale={[0.55, 0.14, nose ? 1.3 : 1.25]}>
        <boxGeometry />
        <meshStandardMaterial color={pal.clay} flatShading />
      </mesh>
      {nose && (
        <mesh position={[0, -0.05, 0.82]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.6, 0.4]}>
          <coneGeometry args={[0.5, 1, 4]} />
          <meshStandardMaterial color="#eef2f1" flatShading />
        </mesh>
      )}
    </group>
  )
  return (
    <group ref={group}>
      {car(1.38, true)}
      {car(0)}
      {car(-1.38)}
    </group>
  )
}

/* ----------------------- camera + harness plumbing ----------------------- */

interface Nav {
  focusT: number
}

function CameraRig({ nav }: { nav: React.MutableRefObject<Nav> }) {
  const { camera, size } = useThree()
  const smooth = useRef({ t: nav.current.focusT })
  useFrame(() => {
    const persp = camera as THREE.PerspectiveCamera
    const wantFov = size.width < size.height ? 58 : 48
    if (Math.abs(persp.fov - wantFov) > 0.5) {
      persp.fov = wantFov
      persp.updateProjectionMatrix()
    }
    const s = smooth.current
    s.t += (nav.current.focusT - s.t) * 0.08
    // Radial close-up: the camera floats straight out from the focus node,
    // so the trail runs across the frame and the mountain face is the
    // backdrop. Distance is solved from the fov/aspect so roughly one
    // lesson each side of yours spans the frame, clipped at the edges —
    // a tangent-following camera can't work here, the convex mountainside
    // always swings round to block the view ahead.
    const focus = pathPoint(s.t)
    const halfWidth = 3.2 // ~1.3 node spacings each side (3-turn spiral packs nodes tighter)
    const aspect = size.width / size.height
    // floor (default 9): any closer and the slope at eye height grazes the
    // frame edges on wide viewports (reads as clipping into the mountain).
    // ceiling (default 12): keeps the low camera orbit OUTSIDE the base
    // forest ring, whose trees otherwise end up edge-on across the lens.
    const dist = Math.min(CAM.distMax, Math.max(CAM.distMin, halfWidth / (Math.tan((wantFov * Math.PI) / 360) * aspect)))
    // bias the azimuth a touch toward what's ahead — fading to zero over
    // the final stretch so the camera comes to rest EXACTLY square to the
    // summit gate and the climbing bend, not drifted past it (household
    // note). Derived from the spiral, NOT atan2 of the focus point — at
    // the summit the focus is the plateau centre, where atan2(0, 0) has no
    // meaningful answer.
    const tc = Math.min(1, Math.max(0, s.t))
    const biasFade = 1 - Math.min(1, Math.max(0, (tc - 0.9) / 0.08))
    // clamp at T_BEND: past it the walkway runs straight and radial, and
    // the camera must rest exactly on its axis, square to the gate
    const a = trailAngle(Math.min(tc, T_BEND)) + CAM.azimuthBias * biasFade
    // never orbit inside the terrain's local bulge below the eye — the
    // lower mountain widens toward the foot, and an orbit radius chosen
    // only from the path's radius clips through that flank
    const bulge = mountainR(Math.max(0, focus.y - 3)) + 4
    const rEye = Math.max(Math.hypot(focus.x, focus.z) + dist, bulge)
    camera.position.set(Math.cos(a) * rEye, focus.y + CAM.height, Math.sin(a) * rEye)
    camera.lookAt(focus.x, focus.y + CAM.lookAtHeight, focus.z)
  })
  return null
}

// the summit gate: on the plateau, a stride inward from where the trail
// tops out, facing the arriving walker
// dead centre of the plateau — the straight walkway delivers you here,
// under the gate, and the resting camera (parked on the walkway's axis at
// APPROACH_A) sees it face-on
const GATE_A = APPROACH_A
const GATE_POS = SUMMIT_CENTRE.clone()

/** Procedural placement of every decoration, exactly as the r10 scene laid
 * them out — but as a flat item list with stable ids, so the household can
 * remove/move any of them (or add more) through mountainPatch.json. Ids are
 * per-kind counters in generation order: stable for a given shape, since
 * the keep-out tests depend on the spiral. */
function baseScenery(): SceneryItem[] {
  const items: SceneryItem[] = []
  const counters = new Map<SceneryKind, number>()
  const put = (kind: SceneryKind, p: THREE.Vector3, angle = 0, scale = 1, variant?: number) => {
    const n = counters.get(kind) ?? 0
    counters.set(kind, n + 1)
    items.push({ id: `${kind}-${n}`, kind, x: p.x, y: p.y, z: p.z, angle, scale, variant })
  }

  const rnd = mulberry(20260709)
  // slope pines, low-to-mid altitudes, clear of trail/river/caves
  for (let i = 0; i < 95; i++) {
    const y = Math.pow(rnd(), 1.9) * 12
    const phi = rnd() * Math.PI * 2
    const dy = nearestTurnDy(phi, y)
    // generous keep-out above the trail — the camera flies through there
    if (dy !== null && dy > -1.4 && dy < 2.6) continue
    if (angDiff(phi, riverPhi(y)) < 0.22) continue
    if (CAVES.some((c) => (angDiff(phi, c.phi) / (c.rp * 2)) ** 2 + ((y - c.y) / (c.ry * 2)) ** 2 < 1)) continue
    const r = mountainR(y) + 0.15
    put('pine', new THREE.Vector3(Math.cos(phi) * r, y - 0.1, Math.sin(phi) * r), 0, 0.9 + rnd() * 0.9)
  }
  // base-plain flora — a skirt of forest and blossom INSIDE the camera's
  // low orbit (which stays ≥ path radius + 9), height-capped so treetops
  // always pass well under the lens
  for (let i = 0; i < 46; i++) {
    const phi = rnd() * Math.PI * 2
    const r = R0 + 3.5 + rnd() * 4.5
    const p = new THREE.Vector3(Math.cos(phi) * r, 0, Math.sin(phi) * r)
    if (rnd() < 0.32) put('sakura', p, 0, 0.9 + rnd() * 0.5)
    else put('pine', p, 0, 0.9 + rnd() * 0.5)
  }
  for (let i = 0; i < 22; i++) {
    const y = rnd() * 14
    const phi = rnd() * Math.PI * 2
    const dy = nearestTurnDy(phi, y)
    if (dy !== null && dy > -1.2 && dy < 1.8) continue
    const r = y < 0.5 ? R0 + 3.5 + rnd() * 4.5 : mountainR(y) + 0.1
    put('rock', new THREE.Vector3(Math.cos(phi) * r, Math.max(0.1, y - 0.15), Math.sin(phi) * r), 0, 0.3 + rnd() * 0.55)
  }
  // rubble scattered across the summit plateau (kept clear of the gate)
  let pr = 0
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2
    const d = rnd() * RTOP * 0.82
    const p = new THREE.Vector3(Math.cos(a) * d, PLATEAU_Y + 0.07, Math.sin(a) * d)
    if (p.distanceTo(GATE_POS) < 1.1) continue
    put('rock', p, pr * 1.3, 0.1 + rnd() * 0.32)
    pr++
  }
  // lanterns line the trail's top third + greet you at the trailhead —
  // just off the stones' line toward the shelf's outer half, hugging the
  // trail rather than perched on the lip (household note, round seven)
  for (let i = 0; i < 11; i++) {
    const t = 0.68 + (i / 11) * 0.28
    const p = pathPoint(t + 0.006)
    const outward = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.45)
    put('lantern', p.clone().add(outward))
  }
  for (const t of [0.006, 0.018]) {
    const p = pathPoint(t)
    const outward = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.8)
    put('lantern', p.clone().add(outward))
  }

  // bridges where the river ducks under the trail, one per crossing —
  // fixed-point iteration through the spiral's inverse, since the river's
  // course wobbles with height
  const crossT = (phi: number, k: number) => {
    const off = (((phi - THETA0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    return tAtAngle(THETA0 + off + k * Math.PI * 2)
  }
  for (let k = 0; k < TURNS; k++) {
    let h = ((k + 0.5) / TURNS) * HPATH
    let t = 0
    for (let it = 0; it < 4; it++) {
      t = crossT(riverPhi(h), k)
      h = t * HPATH
    }
    if (t > 0.02 && t < 0.97) {
      const p = pathPoint(t)
      put('bridge', new THREE.Vector3(p.x, p.y + 0.1, p.z), -trailAngle(t) - Math.PI / 2)
    }
  }

  // the base village + onsen + the shinkansen's tunnel foothill + pond
  for (const i of [0, 1, 2]) {
    const phi = 5.35 + i * 0.22
    const r = R0 + 8 + (i % 2) * 1.6
    put('house', new THREE.Vector3(Math.cos(phi) * r, 0, Math.sin(phi) * r), -phi + Math.PI / 2 + (i - 1) * 0.3, 1, i === 1 ? 1 : 0)
  }
  put('onsen', new THREE.Vector3(Math.cos(0.8) * (R0 + 8.5), 0, Math.sin(0.8) * (R0 + 8.5)))
  put('hill', new THREE.Vector3(Math.cos(3.6) * (R0 + 5), 0, Math.sin(3.6) * (R0 + 5)), -3.6)
  put('pond', new THREE.Vector3(Math.cos(riverPhi(0)) * (R0 + 3.2), 0.06, Math.sin(riverPhi(0)) * (R0 + 3.2)))
  return items
}

/** Exported for the scenery-patch test — the app applies the committed
 * patch's scenery section over the procedural base. */
export function applyScenery(items: SceneryItem[], patch?: SceneryPatch): SceneryItem[] {
  if (!patch) return items
  const removed = new Set(patch.removed ?? [])
  const moved = new Map((patch.moved ?? []).map((m) => [m.id, m]))
  const out = items
    .filter((it) => !removed.has(it.id))
    .map((it) => {
      const m = moved.get(it.id)
      return m ? { ...it, x: m.x, y: m.y, z: m.z, angle: m.angle, scale: m.scale } : it
    })
  ;(patch.added ?? []).forEach((a, i) => out.push({ id: `add-${i}`, ...a }))
  return out
}

const DECOR: SceneryItem[] = applyScenery(baseScenery(), mountainPatch.scenery)

/** The reward for the last lesson: a hinomaru sun rising behind the summit
 * gate. It lives on the eye→gate ray, so it is centred in the gate's frame
 * from wherever the camera stands, and it climbs into place over the final
 * stretch of the scroll — below the plateau rim until you're nearly there,
 * then up behind the torii. Only rendered once the final lesson is done. */
function SummitSun({ nav, show, clay }: { nav: React.MutableRefObject<Nav>; show: boolean; clay: string }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    // The dawn belongs to the final approach: the sun only starts climbing
    // as you round the SECOND-TO-LAST torii gate (t≈0.918) and reaches its
    // place in the gate as the camera comes to rest (household note, round
    // nine). It still starts deep behind the mountain, so its first sign
    // is a glow cresting the rim, never a pop.
    const rise = Math.min(1, Math.max(0, (nav.current.focusT - 0.918) / 0.082))
    g.visible = show && rise > 0
    if (!g.visible) return
    const gateCentre = GATE_POS.clone().setY(PLATEAU_Y + 1.3)
    const dir = gateCentre.clone().sub(camera.position).normalize()
    const p = camera.position.clone().add(dir.multiplyScalar(camera.position.distanceTo(gateCentre) + 26))
    p.y -= (1 - rise) * 13 // deep dawn: fully behind the mountain at first
    g.position.copy(p)
    g.quaternion.copy(camera.quaternion) // billboard
  })
  return (
    <group ref={group} visible={false}>
      <mesh>
        <circleGeometry args={[4.6, 40]} />
        <meshStandardMaterial color={clay} emissive={clay} emissiveIntensity={1.1} fog={false} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[7.2, 40]} />
        <meshStandardMaterial color="#e8b84b" emissive="#e8b84b" emissiveIntensity={0.5} transparent opacity={0.28} fog={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** The sun follows the camera round the mountain — with a fixed key light
 * half the orbit would sit in its own shadow, and the close-up camera lives
 * at every azimuth. Slightly offset so facets still shade directionally. */
function SunRig({ nav }: { nav: React.MutableRefObject<Nav> }) {
  const key = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const focus = pathPoint(nav.current.focusT)
    // spiral-derived azimuth (atan2 of the focus degenerates at the summit
    // centre, where the trail's final bend ends)
    const a = trailAngle(Math.min(T_BEND, Math.max(0, nav.current.focusT)))
    key.current?.position.set(Math.cos(a + 0.35) * 34, focus.y + 13, Math.sin(a + 0.35) * 34)
    // soft fill raking the TRAILING limb (the slope sliding past the left
    // frame edge) — between the key and true backlight it read as a black
    // slab; the far side hides in fog anyway
    fill.current?.position.set(Math.cos(a - 1.1) * 34, focus.y + 6, Math.sin(a - 1.1) * 34)
  })
  return (
    <>
      <directionalLight ref={key} position={[14, 26, 8]} intensity={1.3} />
      <directionalLight ref={fill} position={[-14, 12, -8]} intensity={0.5} />
    </>
  )
}

function SkyFade({ nav, onShade }: { nav: React.MutableRefObject<Nav>; onShade: (n: number) => void }) {
  const last = useRef(-1)
  useFrame(() => {
    const n = Math.min(1, Math.max(0, (nav.current.focusT - NIGHT_LINE) / (1 - NIGHT_LINE)))
    if (Math.abs(n - last.current) > 0.02) {
      last.current = n
      onShade(n)
    }
  })
  return null
}


/* ------------------------------- the scene ------------------------------ */

interface Node3D {
  id: string
  state: string
  stars: number
  isGate: boolean
  t: number
  pos: THREE.Vector3
  angle: number
  unitIndex: number
}

export interface PathScene3DProps {
  manifest: PathManifest
  onSelectLesson?: (lessonId: string, state: string) => void
}

export function PathScene3D({ manifest, onSelectLesson }: PathScene3DProps) {
  const pal = usePalette()
  const { kitsune_tone: myTone } = useSettings()
  const { units, summit, partner } = manifest

  const nodes = useMemo<Node3D[]>(() => {
    const all = units.flatMap((u, ui) => u.lessons.map((l) => ({ l, ui })))
    return all.map(({ l, ui }, i) => {
      const t = nodeT(i, all.length)
      return {
        id: l.id,
        state: l.state,
        stars: l.stars,
        isGate: l.kind === 'checkpoint',
        t,
        pos: pathPoint(t),
        angle: trailAngle(t),
        unitIndex: ui,
      }
    })
  }, [units])

  const currentNode = nodes.find((n) => n.state === 'current') ?? nodes.find((n) => n.state === 'available')
  const partnerNode = partner ? nodes.find((n) => n.id === partner.current_lesson_id) : undefined
  const currentIndex = currentNode ? nodes.indexOf(currentNode) : 0

  const mountain = useMemo(() => buildMountain(pal), [pal])
  useEffect(() => () => mountain.dispose(), [mountain])

  // The summit walkway: constant width, built from a polyline that STARTS
  // on the spiral shelf (two pre-anchor samples follow the trail's curve),
  // so the join with the main trail is a smooth curve rather than a straight
  // ribbon jutting off it (household note, round ten). Side vectors are
  // per-segment, so the width holds through the bend.
  const walkway = useMemo(() => {
    const N = 10
    const climb = (u: number) => {
      const s = u * u * (3 - 2 * u)
      const sUp = Math.min(1, s * 3.4) // must match pathPoint's climb curve
      return new THREE.Vector3(
        ANCHOR.x + (SUMMIT_CENTRE.x - ANCHOR.x) * s,
        ANCHOR.y + (SUMMIT_CENTRE.y - ANCHOR.y) * sUp + 0.06,
        ANCHOR.z + (SUMMIT_CENTRE.z - ANCHOR.z) * s,
      )
    }
    const pts: THREE.Vector3[] = [
      pathPoint(T_BEND - 0.007).setY(pathPoint(T_BEND - 0.007).y + 0.06),
      pathPoint(T_BEND - 0.0035).setY(pathPoint(T_BEND - 0.0035).y + 0.06),
    ]
    for (let i = 0; i <= N; i++) pts.push(climb(i / N))
    const positions: number[] = []
    const HALF = 1.15
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      const dir = new THREE.Vector3().subVectors(p1, p0)
      dir.y = 0
      if (dir.lengthSq() < 1e-6) continue
      dir.normalize()
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(HALF)
      const l0 = p0.clone().sub(side), r0 = p0.clone().add(side)
      const l1 = p1.clone().sub(side), r1 = p1.clone().add(side)
      positions.push(l0.x, l0.y, l0.z, r0.x, r0.y, r0.z, l1.x, l1.y, l1.z)
      positions.push(l1.x, l1.y, l1.z, r0.x, r0.y, r0.z, r1.x, r1.y, r1.z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
  useEffect(() => () => walkway.dispose(), [walkway])

  // the lead-in: before lesson one the trail doesn't just stop — it bends
  // away across the plain and carries on out of frame (household note)
  const leadIn = useMemo(() => {
    const positions: number[] = []
    const N = 16
    const a0 = trailAngle(0)
    const rate = (SPIRAL_C / SPIRAL_A) * 0.85
    const at = (u: number) => ({ a: a0 + u * rate, r: SPIRAL_A - u * 26 })
    for (let i = 0; i < N; i++) {
      const p0 = at(-0.15 + (0.15 * i) / N)
      const p1 = at(-0.15 + (0.15 * (i + 1)) / N)
      const y = 0.06
      const l0 = [(p0.r - 0.85) * Math.cos(p0.a), y, (p0.r - 0.85) * Math.sin(p0.a)]
      const r0 = [(p0.r + 0.85) * Math.cos(p0.a), y, (p0.r + 0.85) * Math.sin(p0.a)]
      const l1 = [(p1.r - 0.85) * Math.cos(p1.a), y, (p1.r - 0.85) * Math.sin(p1.a)]
      const r1 = [(p1.r + 0.85) * Math.cos(p1.a), y, (p1.r + 0.85) * Math.sin(p1.a)]
      positions.push(...l0, ...r0, ...l1, ...l1, ...r0, ...r1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
    return geo
  }, [])
  useEffect(() => () => leadIn.dispose(), [leadIn])

  const stars = useMemo(() => {
    const rnd = mulberry(42)
    const pts: number[] = []
    for (let i = 0; i < 170; i++) {
      const a = rnd() * Math.PI * 2
      const r = 26 + rnd() * 34
      pts.push(Math.cos(a) * r, 15 + rnd() * 32, Math.sin(a) * r)
    }
    return new Float32Array(pts)
  }, [])

  const nav = useRef<Nav>({ focusT: currentNode?.t ?? 0 })
  const drag = useRef({ active: false, y: 0, moved: 0 })
  const [shade, setShade] = useState(0)

  useEffect(() => {
    nav.current.focusT = currentNode?.t ?? 0
    if (import.meta.env.DEV) {
      ;(window as unknown as { __michiNav?: unknown }).__michiNav = nav.current
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode?.id])

  const stateColour = (n: Node3D) =>
    n.state === 'done' ? pal.trailDone : n.state === 'current' ? pal.clay : n.state === 'available' ? pal.trail : pal.cloud

  const unitOfFocus = units[nodes[Math.min(nodes.length - 1, Math.max(0, currentIndex))]?.unitIndex ?? 0]

  // Fill the whole viewport between the header and the mobile tab bar
  // (household ask, 2026-07-09) — measured live, so any header height or
  // breakpoint change stays correct. Negative margins on the wrapper eat
  // the main element's paddings.
  const [sceneH, setSceneH] = useState(() => Math.max(340, window.innerHeight - 121))
  useEffect(() => {
    const compute = () => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 57
      const bottomBar = window.matchMedia('(max-width: 639px)').matches ? 64 : 0
      setSceneH(Math.max(340, window.innerHeight - header - bottomBar))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return (
    <div
      className="relative left-1/2 -mt-8 -mb-24 w-screen -translate-x-1/2 select-none overflow-hidden sm:-mb-10"
      style={{
        height: sceneH,
        touchAction: 'none',
        background: `linear-gradient(color-mix(in oklab, ${pal.ink} ${Math.round(shade * 82)}%, ${pal.paper}), ${pal.paper})`,
        transition: 'background 600ms',
      }}
      onPointerDown={(e) => {
        drag.current = { active: true, y: e.clientY, moved: 0 }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d.active) return
        const dy = e.clientY - d.y
        d.y = e.clientY
        d.moved += Math.abs(dy)
        // finger up (dy negative) climbs — the only control there is
        nav.current.focusT = Math.max(0, Math.min(1, nav.current.focusT - dy * 0.00028))
      }}
      onPointerUp={() => {
        drag.current.active = false
      }}
      onPointerLeave={() => {
        drag.current.active = false
      }}
      onWheel={(e) => {
        nav.current.focusT = Math.max(0, Math.min(1, nav.current.focusT + e.deltaY * 0.00013))
      }}
    >
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        camera={{ fov: 58, near: 0.3, far: 80 }}
        onCreated={(state) => {
          // dev-only escape hatch: the preview harness runs its tab hidden,
          // starving rAF — R3F never paints. Exposing the store lets test
          // tooling call state.advance() to force frames.
          if (import.meta.env.DEV) {
            ;(window as unknown as { __michi3d?: unknown }).__michi3d = state
          }
        }}
      >
        <fog attach="fog" args={[pal.paper, 18, 45]} />
        <hemisphereLight args={['#dff3f0', pal.kraft, 0.55]} />
        <ambientLight intensity={0.5} />
        <SunRig nav={nav} />

        <CameraRig nav={nav} />
        <SkyFade nav={nav} onShade={setShade} />

        {/* the mountain — trail, river, caves, snow AND the plateau cap are
            all IN this one mesh; the cap is welded onto the cone's own rim
            (see capTriangles), not a separate flush-fitted mesh */}
        <mesh geometry={mountain}>
          <meshStandardMaterial vertexColors flatShading />
        </mesh>

        {/* ground plain */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[R0 + 15, R0 + 16, 1, 36]} />
          <meshStandardMaterial color={pal.olive} flatShading />
        </mesh>

        {/* the lead-in trail, bending away out of frame before lesson one */}
        <mesh geometry={leadIn}>
          <meshStandardMaterial color={pal.kraft} flatShading side={THREE.DoubleSide} />
        </mesh>

        {/* the summit walkway — straight, constant-width, camera-centred —
            with stepping stones laid along it */}
        <mesh geometry={walkway}>
          <meshStandardMaterial color={pal.kraft} flatShading side={THREE.DoubleSide} />
        </mesh>
        {[0.996, 0.9975, 0.999].map((t) => {
          const p = pathPoint(t)
          return (
            <mesh key={t} position={[p.x, p.y + 0.1, p.z]}>
              <cylinderGeometry args={[0.3, 0.34, 0.1, 6]} />
              <meshStandardMaterial color={pal.cloud} flatShading />
            </mesh>
          )
        })}

        {/* lesson stones — set into the carved shelf */}
        {nodes.map((n, i) => (
          <group key={n.id}>
            <mesh
              position={[n.pos.x, n.pos.y + 0.09, n.pos.z]}
              onClick={() => {
                if (drag.current.moved > 8) return
                onSelectLesson?.(n.id, n.state)
              }}
              onPointerOver={() => {
                document.body.style.cursor = n.state === 'locked' ? 'default' : 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default'
              }}
            >
              <cylinderGeometry args={[0.55, 0.62, 0.2, 7]} />
              <meshStandardMaterial
                color={stateColour(n)}
                emissive={n.state === 'current' ? pal.clay : '#000000'}
                emissiveIntensity={n.state === 'current' ? 0.3 : 0}
                flatShading
              />
            </mesh>
            {/* three stars = one BIG star in place of the number; one or
                two sit in a semicircle round the platform's outward base
                (household layout, round ten) */}
            {!n.isGate && !(n.state === 'done' && n.stars >= 3) && (
              <NumberSprite n={i + 1} colour={n.state === 'locked' ? pal.cloud : pal.ink} position={n.pos} />
            )}
            {n.state === 'done' && n.stars >= 3 && (
              <mesh position={[n.pos.x, n.pos.y + 0.62, n.pos.z]} rotation={[0, 0.5, 0]}>
                <octahedronGeometry args={[0.24, 0]} />
                <meshStandardMaterial color={pal.gold} emissive={pal.gold} emissiveIntensity={0.5} flatShading />
              </mesh>
            )}
            {n.state === 'done' &&
              n.stars > 0 &&
              n.stars < 3 &&
              Array.from({ length: n.stars }, (_, k) => {
                const out = new THREE.Vector3(n.pos.x, 0, n.pos.z).normalize()
                const spread = n.stars === 1 ? 0 : k === 0 ? -0.5 : 0.5
                const dir = out
                  .clone()
                  .applyAxisAngle(new THREE.Vector3(0, 1, 0), spread)
                  .multiplyScalar(0.85)
                return (
                  <mesh
                    key={k}
                    position={[n.pos.x + dir.x, n.pos.y + 0.12, n.pos.z + dir.z]}
                    rotation={[0, k * 0.7, 0]}
                  >
                    <octahedronGeometry args={[0.1, 0]} />
                    <meshStandardMaterial color={pal.gold} emissive={pal.gold} emissiveIntensity={0.4} flatShading />
                  </mesh>
                )
              })}
            {/* checkpoint torii — except the last lesson, whose gate IS the
                big summit gate. Centred on the trail again (round seven):
                the round-six outward nudge kept them clear of the wall but
                left them straddling the shelf edge and clipping the lesson
                stones; the residual terrace-out now provides the wall
                clearance instead. */}
            {n.isGate && i < nodes.length - 1 && (
              <Torii position={n.pos} angle={n.angle} scale={1} colour={pal.clay} />
            )}
          </group>
        ))}

        {/* you + your partner */}
        {currentNode && (
          <Kitsune3D
            position={currentNode.pos.clone().setY(currentNode.pos.y + 0.19)}
            angle={currentNode.angle}
            tone={myTone}
            scale={1.1}
          />
        )}
        {partnerNode && partner && (
          <Kitsune3D
            position={partnerNode.pos.clone().setY(partnerNode.pos.y + 0.19)}
            angle={partnerNode.angle}
            tone={partner.tone}
            ghost
            scale={0.9}
          />
        )}

        {/* The summit gate at the plateau's centre + the earned sunrise
            behind it. Angle is GATE_A − π/2: path torii point their crossbar
            radially (you walk through them along the trail), but the final
            approach arrives RADIALLY across the plateau, so this gate turns
            a quarter to face the walker — and the camera — square on. */}
        <Torii position={GATE_POS} angle={GATE_A - Math.PI / 2} scale={2.2} colour={pal.clay} />
        <SummitSun
          nav={nav}
          show={
            (nodes.length > 0 && nodes[nodes.length - 1].state === 'done') ||
            // ?sunrise: preview the earned moment without earning it
            new URLSearchParams(window.location.search).has('sunrise')
          }
          clay={pal.clay}
        />

        {/* the decorative dressing — every item placeable/removable via the
            patch's scenery section (tools/mountain-editor) */}
        {DECOR.map((it) => {
          const pos = new THREE.Vector3(it.x, it.y, it.z)
          // weathered timber: clay washed toward stone-grey; cedar darker
          // than pine so the two species read apart at a glance
          const worn = `#${new THREE.Color(pal.clay).lerp(new THREE.Color(pal.cloud), 0.55).getHexString()}`
          const cedarGreen = `#${new THREE.Color(pal.olive).lerp(new THREE.Color(pal.ink), 0.3).getHexString()}`
          const bambooLight = `#${new THREE.Color(pal.olive).lerp(new THREE.Color('#ffffff'), 0.18).getHexString()}`
          const snow = '#f3f6f5'
          switch (it.kind) {
            case 'pine':
              return <Pine key={it.id} position={pos} scale={it.scale} foliage={pal.olive} trunk={pal.kraft} />
            case 'sakura':
              return <Sakura key={it.id} position={pos} scale={it.scale} trunk={pal.kraft} />
            case 'rock':
              return (
                <mesh key={it.id} position={pos} scale={it.scale} rotation={[0, it.angle, 0]}>
                  <icosahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial color={pal.cloud} flatShading />
                </mesh>
              )
            case 'lantern':
              return <Lantern key={it.id} position={pos} lit={shade > 0.15} warm={pal.gold} post={pal.ink} />
            case 'bridge':
              return (
                <mesh key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <boxGeometry args={[2.4, 0.14, 1.2]} />
                  <meshStandardMaterial color={pal.kraft} flatShading />
                </mesh>
              )
            case 'house':
              return (
                <group key={it.id} position={pos} scale={it.scale}>
                  <House
                    position={new THREE.Vector3(0, 0, 0)}
                    rotation={it.angle}
                    wall="#efe7d6"
                    roof={it.variant === 1 ? pal.clay : pal.ink}
                  />
                </group>
              )
            case 'onsen':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <Onsen position={new THREE.Vector3(0, 0, 0)} pal={pal} />
                </group>
              )
            case 'torii':
              return <Torii key={it.id} position={pos} angle={-it.angle} scale={it.scale} colour={pal.clay} />
            case 'hill':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.6, 0]}>
                    <coneGeometry args={[3, 2.8, 8]} />
                    <meshStandardMaterial color={pal.olive} flatShading />
                  </mesh>
                  <group position={[0, 0.45, 0]}>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry args={[0.75, 0.75, 4, 10, 1, true]} />
                      <meshStandardMaterial color={pal.ink} side={THREE.DoubleSide} flatShading />
                    </mesh>
                  </group>
                </group>
              )
            case 'pond':
              return (
                <mesh key={it.id} position={pos} scale={it.scale}>
                  <cylinderGeometry args={[2.5, 2.7, 0.14, 12]} />
                  <meshStandardMaterial color={pal.liquid} flatShading />
                </mesh>
              )
            case 'cedar':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.35, 0]}>
                    <cylinderGeometry args={[0.06, 0.09, 0.7, 5]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  {([[0.32, 0.7, 0.9], [0.25, 0.6, 1.32], [0.17, 0.52, 1.72]] as const).map(([r, h, y], i) => (
                    <mesh key={i} position={[0, y, 0]}>
                      <coneGeometry args={[r, h, 6]} />
                      <meshStandardMaterial color={cedarGreen} flatShading />
                    </mesh>
                  ))}
                </group>
              )
            case 'snowpine':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.25, 0]}>
                    <cylinderGeometry args={[0.07, 0.1, 0.5, 5]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  <mesh position={[0, 0.72, 0]}>
                    <coneGeometry args={[0.42, 0.8, 6]} />
                    <meshStandardMaterial color={pal.olive} flatShading />
                  </mesh>
                  <mesh position={[0, 1.02, 0]}>
                    <coneGeometry args={[0.34, 0.32, 6]} />
                    <meshStandardMaterial color={snow} flatShading />
                  </mesh>
                  <mesh position={[0, 1.24, 0]}>
                    <coneGeometry args={[0.26, 0.55, 6]} />
                    <meshStandardMaterial color={pal.olive} flatShading />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                    <coneGeometry args={[0.2, 0.28, 6]} />
                    <meshStandardMaterial color={snow} flatShading />
                  </mesh>
                </group>
              )
            case 'maple':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.3, 0]}>
                    <cylinderGeometry args={[0.07, 0.11, 0.6, 5]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  <mesh position={[0.05, 0.85, 0]}>
                    <dodecahedronGeometry args={[0.45, 0]} />
                    <meshStandardMaterial color={pal.clay} flatShading />
                  </mesh>
                  <mesh position={[-0.27, 0.62, 0.1]}>
                    <dodecahedronGeometry args={[0.28, 0]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  <mesh position={[0.22, 0.58, -0.16]}>
                    <dodecahedronGeometry args={[0.24, 0]} />
                    <meshStandardMaterial color={pal.gold} flatShading />
                  </mesh>
                </group>
              )
            case 'bamboo':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  {([[-0.13, 1.45, 0.05, 0.06], [0.02, 1.7, -0.03, -0.03], [0.15, 1.3, 0.02, 0.08]] as const).map(
                    ([x, h, z, tilt], i) => (
                      <group key={i} position={[x, 0, z]} rotation={[0, 0, tilt]}>
                        <mesh position={[0, h / 2, 0]}>
                          <cylinderGeometry args={[0.035, 0.04, h, 5]} />
                          <meshStandardMaterial color={i === 1 ? bambooLight : pal.olive} flatShading />
                        </mesh>
                        <mesh position={[0.05, h + 0.08, 0]}>
                          <dodecahedronGeometry args={[0.16, 0]} />
                          <meshStandardMaterial color={pal.olive} flatShading />
                        </mesh>
                      </group>
                    ),
                  )}
                </group>
              )
            case 'deadtree':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.45, 0]}>
                    <cylinderGeometry args={[0.05, 0.1, 0.9, 5]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  <mesh position={[0.16, 0.82, 0]} rotation={[0, 0, -0.85]}>
                    <cylinderGeometry args={[0.02, 0.04, 0.45, 4]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                  <mesh position={[-0.12, 0.66, 0.05]} rotation={[0.2, 0, 0.75]}>
                    <cylinderGeometry args={[0.02, 0.035, 0.35, 4]} />
                    <meshStandardMaterial color={pal.kraft} flatShading />
                  </mesh>
                </group>
              )
            case 'torii-worn':
              return (
                <group key={it.id} position={pos} rotation={[0.02, it.angle, 0.06]} scale={it.scale}>
                  <Torii position={new THREE.Vector3(0, 0, 0)} angle={0} colour={worn} />
                </group>
              )
            case 'torii-fallen':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[-0.62, 0.16, 0]} rotation={[0, 0, 0.08]}>
                    <cylinderGeometry args={[0.09, 0.11, 0.32, 6]} />
                    <meshStandardMaterial color={worn} flatShading />
                  </mesh>
                  <mesh position={[0.62, 0.12, 0]} rotation={[0.06, 0, -0.1]}>
                    <cylinderGeometry args={[0.09, 0.11, 0.24, 6]} />
                    <meshStandardMaterial color={worn} flatShading />
                  </mesh>
                  <mesh position={[0.14, 0.08, 0.78]} rotation={[0, 0.28, 0]}>
                    <boxGeometry args={[1.85, 0.15, 0.22]} />
                    <meshStandardMaterial color={worn} flatShading />
                  </mesh>
                  <mesh position={[-0.2, 0.05, 1.06]} rotation={[0, 0.55, 0]}>
                    <boxGeometry args={[1.46, 0.1, 0.15]} />
                    <meshStandardMaterial color={worn} flatShading />
                  </mesh>
                </group>
              )
            case 'torii-broken':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[-0.62, 0.65, 0]}>
                    <cylinderGeometry args={[0.09, 0.11, 1.35, 6]} />
                    <meshStandardMaterial color={pal.clay} flatShading />
                  </mesh>
                  <mesh position={[0.62, 0.24, 0]} rotation={[0, 0, -0.07]}>
                    <cylinderGeometry args={[0.09, 0.105, 0.48, 6]} />
                    <meshStandardMaterial color={pal.clay} flatShading />
                  </mesh>
                  <mesh position={[0.95, 0.1, 0.4]} rotation={[1.45, 0, 0.5]}>
                    <cylinderGeometry args={[0.08, 0.095, 0.72, 6]} />
                    <meshStandardMaterial color={pal.clay} flatShading />
                  </mesh>
                  <mesh position={[-0.05, 0.78, 0.1]} rotation={[0.1, 0.1, -0.5]}>
                    <boxGeometry args={[1.85, 0.15, 0.22]} />
                    <meshStandardMaterial color={pal.clay} flatShading />
                  </mesh>
                </group>
              )
            case 'shrine':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.1, 0]}>
                    <boxGeometry args={[0.7, 0.2, 0.6]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                  <mesh position={[0, 0.42, 0]}>
                    <boxGeometry args={[0.5, 0.45, 0.42]} />
                    <meshStandardMaterial color="#efe7d6" flatShading />
                  </mesh>
                  <mesh position={[0, 0.42, 0.215]}>
                    <boxGeometry args={[0.18, 0.26, 0.02]} />
                    <meshStandardMaterial color={pal.ink} flatShading />
                  </mesh>
                  <mesh position={[0, 0.76, 0]} rotation={[0, Math.PI / 4, 0]}>
                    <coneGeometry args={[0.52, 0.34, 4]} />
                    <meshStandardMaterial color={pal.ink} flatShading />
                  </mesh>
                </group>
              )
            case 'toro':
              return (
                <group key={it.id} position={pos} rotation={[0, it.angle, 0]} scale={it.scale}>
                  <mesh position={[0, 0.06, 0]}>
                    <cylinderGeometry args={[0.16, 0.2, 0.12, 6]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                  <mesh position={[0, 0.3, 0]}>
                    <cylinderGeometry args={[0.07, 0.09, 0.36, 6]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                  <mesh position={[0, 0.52, 0]}>
                    <cylinderGeometry args={[0.15, 0.11, 0.08, 6]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                  <mesh position={[0, 0.66, 0]}>
                    <boxGeometry args={[0.22, 0.2, 0.22]} />
                    <meshStandardMaterial color="#efe7d6" emissive={pal.gold} emissiveIntensity={shade > 0.15 ? 0.6 : 0} flatShading />
                  </mesh>
                  <mesh position={[0, 0.82, 0]}>
                    <coneGeometry args={[0.24, 0.16, 6]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                  <mesh position={[0, 0.94, 0]}>
                    <sphereGeometry args={[0.05, 6, 5]} />
                    <meshStandardMaterial color={pal.cloud} flatShading />
                  </mesh>
                </group>
              )
          }
        })}

        {/* night sky, fading in with altitude */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[stars, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.24} color="#fdf8e7" transparent opacity={Math.min(0.95, shade * 1.3)} sizeAttenuation fog={false} />
        </points>

        <Clouds />

        {/* the shinkansen loop (its tunnel foothill is a scenery item) */}
        <Train pal={pal} />
      </Canvas>

      {/* HTML overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <span className="rounded-full bg-paper/85 px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid backdrop-blur">
          TRIP-READY {summit.trip_ready_pct}% · {summit.days_to_trip} DAYS TO GO
        </span>
      </div>
      {unitOfFocus && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-paper/85 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mid backdrop-blur">
            {unitOfFocus.kicker}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 right-4 hidden sm:block">
        <span className="font-mono text-[10px] tracking-[0.08em] text-ink-soft">SCROLL TO CLIMB · TAP A STONE</span>
      </div>
    </div>
  )
}
