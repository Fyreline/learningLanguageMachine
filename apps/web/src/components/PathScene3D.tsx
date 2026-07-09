/** The path, in three dimensions — an experiment the household asked for
 * (2026-07-09): a Celeste hub-overview / Cult-of-the-Lamb-ish low-poly
 * mountain you wind around to the summit, instead of the 2D scroll.
 *
 * Same contract as PathScene ({manifest, onSelectLesson}) and lazy-loaded
 * behind a toggle on PathPage, so the three.js chunk costs nothing unless
 * the 3D path is actually switched on. Everything is modelled from
 * primitives in code — no GLB assets, nothing fetched — and every colour is
 * read from the live Aizome CSS tokens at mount (plus a MutationObserver on
 * the .dark class), so the scene follows the theme like the DOM does.
 *
 * Layout mirrors the 2D scene's storytelling: busy foothills (trees, the
 * bullet train looping through a tunnel), thinning scenery as you climb,
 * torii + lanterns + a night sky near the summit. One helix, one node per
 * lesson, torii on unit checkpoints, kitsune on your node, ghost kitsune on
 * your partner's.
 *
 * Controls: drag up/down (or wheel) climbs the camera along the path; drag
 * left/right orbits. Tap a node to open its lesson (drags don't count as
 * taps). The camera starts at, and gently chases, a focus point on the
 * path; azimuth follows the helix so climbing FEELS like winding around
 * the mountain.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { PathManifest } from '../pathData'
import { useSettings } from '../settings'
import { PALETTE, type KitsuneTone } from './AnimatedKitsune'

/* ------------------------------ geometry -------------------------------- */

const H = 17 // summit height
const R0 = 11 // mountain radius at the base
const TURNS = 5.25 // helix revolutions base → summit
const NIGHT_LINE = 0.55 // focus height where day hands over to night

/** Mountain silhouette: radius at height y (slightly concave cone). */
function mountainR(y: number): number {
  return R0 * Math.pow(Math.max(0, 1 - y / H), 0.82)
}

/** The path helix: node/scenery anchor at progress t ∈ [0,1]. */
function helixAt(t: number): THREE.Vector3 {
  const y = t * (H - 1.6)
  const theta = -Math.PI / 2 + t * TURNS * Math.PI * 2
  const r = mountainR(y) + 0.9
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r)
}

function helixAngle(t: number): number {
  return -Math.PI / 2 + t * TURNS * Math.PI * 2
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
  night: string
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
    // the upper mountain's night sky — the 2D scene's summit backdrop
    night: readToken('--color-paper-deep', '#dcebe8'),
    gold: '#e8b84b',
  }
}

/** Live theme tokens: re-read when the .dark class flips. */
function usePalette(): ScenePalette {
  const [pal, setPal] = useState(readPalette)
  useEffect(() => {
    const mo = new MutationObserver(() => setPal(readPalette()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return pal
}

/* ------------------------------ tiny models ----------------------------- */

/** Number label that always faces the camera — a little canvas texture. */
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
    <sprite position={[position.x, position.y + 0.72, position.z]} scale={[0.62, 0.62, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

function Torii({ position, angle, scale = 1, colour }: { position: THREE.Vector3; angle: number; scale?: number; colour: string }) {
  return (
    <group position={position} rotation={[0, -angle, 0]} scale={scale}>
      <mesh position={[-0.55, 0.6, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 1.25, 6]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0.55, 0.6, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 1.25, 6]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <boxGeometry args={[1.7, 0.14, 0.2]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[1.34, 0.1, 0.14]} />
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
        <meshStandardMaterial
          color={warm}
          emissive={lit ? warm : '#000000'}
          emissiveIntensity={lit ? 0.9 : 0}
          flatShading
        />
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

/** Low-poly kitsune from primitives — same silhouette story as the 2D
 * sticker (sitting, big tail curled up) at toy-figure fidelity. */
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
  const opacity = ghost ? 0.55 : 1
  const matProps = { flatShading: true, transparent: ghost, opacity }

  useFrame(({ clock }) => {
    const s = clock.elapsedTime
    if (group.current) group.current.position.y = position.y + Math.sin(s * 2.1) * 0.035
    if (tail.current) tail.current.rotation.z = 0.5 + Math.sin(s * 2.6) * 0.16
  })

  return (
    <group ref={group} position={position} rotation={[0, -angle + Math.PI, 0]} scale={scale}>
      {/* haunches + body */}
      <mesh position={[0, 0.34, 0]}>
        <coneGeometry args={[0.34, 0.72, 7]} />
        <meshStandardMaterial color={body} {...matProps} />
      </mesh>
      {/* cream chest */}
      <mesh position={[0, 0.3, 0.16]} scale={[0.7, 1, 0.7]}>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshStandardMaterial color="#f6efdf" {...matProps} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.78, 0.05]}>
        <dodecahedronGeometry args={[0.23, 0]} />
        <meshStandardMaterial color={body} {...matProps} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.72, 0.26]} rotation={[Math.PI / 2.6, 0, 0]}>
        <coneGeometry args={[0.09, 0.2, 5]} />
        <meshStandardMaterial color="#f6efdf" {...matProps} />
      </mesh>
      {/* ears */}
      <mesh position={[-0.12, 1.0, 0.02]} rotation={[0, 0, 0.22]}>
        <coneGeometry args={[0.075, 0.24, 4]} />
        <meshStandardMaterial color={shadow} {...matProps} />
      </mesh>
      <mesh position={[0.12, 1.0, 0.02]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.075, 0.24, 4]} />
        <meshStandardMaterial color={shadow} {...matProps} />
      </mesh>
      {/* tail — a fat cone swept up behind, white tip */}
      <group ref={tail} position={[0, 0.28, -0.26]} rotation={[0, 0, 0.5]}>
        <mesh position={[0, 0.26, -0.08]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.16, 0.62, 6]} />
          <meshStandardMaterial color={shadow} {...matProps} />
        </mesh>
        <mesh position={[0, 0.56, -0.22]}>
          <sphereGeometry args={[0.11, 6, 5]} />
          <meshStandardMaterial color="#f6efdf" {...matProps} />
        </mesh>
      </group>
    </group>
  )
}

/** The shinkansen: three flat-shaded cars sliding round the base loop,
 * ducking through a foothill tunnel once per lap. */
function Train({ pal }: { pal: ScenePalette }) {
  const group = useRef<THREE.Group>(null)
  const TRACK_R = R0 + 3.6
  useFrame(({ clock }) => {
    if (!group.current) return
    const a = clock.elapsedTime * 0.21
    group.current.position.set(Math.cos(a) * TRACK_R, 0.32, Math.sin(a) * TRACK_R)
    group.current.rotation.y = -a - Math.PI / 2
  })
  const car = (z: number, nose = false) => (
    <group position={[0, 0, z]} key={z}>
      <mesh scale={nose ? [0.42, 0.4, 1.1] : [0.44, 0.42, 1.06]}>
        <boxGeometry />
        <meshStandardMaterial color="#eef2f1" flatShading />
      </mesh>
      <mesh position={[0, -0.06, 0]} scale={[0.46, 0.12, nose ? 1.08 : 1.04]}>
        <boxGeometry />
        <meshStandardMaterial color={pal.clay} flatShading />
      </mesh>
      {nose && (
        <mesh position={[0, -0.04, 0.68]} rotation={[Math.PI / 2, 0, 0]} scale={[0.42, 0.5, 0.34]}>
          <coneGeometry args={[0.5, 1, 4]} />
          <meshStandardMaterial color="#eef2f1" flatShading />
        </mesh>
      )}
    </group>
  )
  return (
    <group ref={group}>
      {car(1.15, true)}
      {car(0)}
      {car(-1.15)}
    </group>
  )
}

/** Dev-only escape hatch: the preview harness runs the tab hidden, which
 * starves requestAnimationFrame and with it the whole R3F frameloop — the
 * canvas never paints a single frame. Exposing the store lets test tooling
 * call state.advance() to force frames. Compiled out of production builds. */
function DevHook() {
  const state = useThree()
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __michi3d?: unknown }).__michi3d = state
    }
  }, [state])
  return null
}

/* -------------------------------- camera -------------------------------- */

interface Nav {
  focusT: number
  azimuth: number
}

function CameraRig({ nav }: { nav: React.MutableRefObject<Nav> }) {
  const { camera, size } = useThree()
  const smooth = useRef({ t: nav.current.focusT, az: nav.current.azimuth })
  useFrame(() => {
    // A portrait phone crushes the horizontal field of view — widen the
    // vertical FOV there so the mountain still reads as a mountain.
    const persp = camera as THREE.PerspectiveCamera
    const wantFov = size.width < size.height ? 64 : 48
    if (Math.abs(persp.fov - wantFov) > 0.5) {
      persp.fov = wantFov
      persp.updateProjectionMatrix()
    }
    const s = smooth.current
    s.t += (nav.current.focusT - s.t) * 0.07
    s.az += (nav.current.azimuth - s.az) * 0.09
    const p = helixAt(s.t)
    const baseAngle = helixAngle(s.t) + s.az
    // Far enough out that the mountain reads as a mountain (the hub-overview
    // framing), creeping closer near the summit where the cone narrows.
    const dist = 20 - s.t * 5
    const camY = p.y + 5.2
    camera.position.set(
      Math.cos(baseAngle) * (mountainR(p.y) + dist),
      camY,
      Math.sin(baseAngle) * (mountainR(p.y) + dist),
    )
    // Aim between the focus node and the mountain's axis, tilted up — keeps
    // the path in the lower half and the peak silhouette in frame.
    camera.lookAt(p.x * 0.35, p.y + 3.2, p.z * 0.35)
  })
  return null
}

/** Drives the DOM sky + fog with the day→night handover as you climb. */
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
  title: string
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
    const flat: Node3D[] = []
    const all = units.flatMap((u, ui) => u.lessons.map((l) => ({ l, ui })))
    all.forEach(({ l, ui }, i) => {
      const t = all.length === 1 ? 0 : i / (all.length - 1)
      flat.push({
        id: l.id,
        title: l.title,
        state: l.state,
        stars: l.stars,
        isGate: l.kind === 'checkpoint',
        t,
        pos: helixAt(t),
        angle: helixAngle(t),
        unitIndex: ui,
      })
    })
    return flat
  }, [units])

  const currentNode = nodes.find((n) => n.state === 'current') ?? nodes.find((n) => n.state === 'available')
  const partnerNode = partner ? nodes.find((n) => n.id === partner.current_lesson_id) : undefined

  // scenery — deterministic pseudo-random (mulberry32) so the mountain is
  // the same mountain every visit
  const scenery = useMemo(() => {
    let s = 20260709
    const rnd = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0
      let x = Math.imul(s ^ (s >>> 15), 1 | s)
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296
    }
    const trees: { pos: THREE.Vector3; scale: number }[] = []
    const rocks: { pos: THREE.Vector3; scale: number }[] = []
    const lanterns: THREE.Vector3[] = []
    // trees crowd the skirts, thin out with height (the 2D density story)
    for (let i = 0; i < 90; i++) {
      const y = Math.pow(rnd(), 2.4) * H * 0.62
      const a = rnd() * Math.PI * 2
      const r = mountainR(y) * (0.35 + rnd() * 0.5)
      const helix = helixAngle(y / (H - 1.6))
      // keep clear of the path ledge
      if (Math.abs(Math.atan2(Math.sin(a - helix), Math.cos(a - helix))) < 0.35) continue
      trees.push({ pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), scale: 0.7 + rnd() * 0.8 })
    }
    for (let i = 0; i < 26; i++) {
      const y = rnd() * H * 0.82
      const a = rnd() * Math.PI * 2
      const r = mountainR(y) * (0.3 + rnd() * 0.55)
      rocks.push({ pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), scale: 0.25 + rnd() * 0.5 })
    }
    // lanterns line the top third of the path itself
    for (let i = 0; i < 12; i++) {
      const t = 0.68 + (i / 12) * 0.3
      const p = helixAt(t + 0.012)
      const inward = new THREE.Vector3(-p.x, 0, -p.z).normalize().multiplyScalar(0.55)
      lanterns.push(p.clone().add(inward))
    }
    return { trees, rocks, lanterns }
  }, [])

  const stars = useMemo(() => {
    const pts: number[] = []
    let s = 42
    const rnd = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0
      let x = Math.imul(s ^ (s >>> 15), 1 | s)
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296
    }
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2
      const r = 18 + rnd() * 26
      const y = H * 0.5 + rnd() * 26
      pts.push(Math.cos(a) * r, y, Math.sin(a) * r)
    }
    return new Float32Array(pts)
  }, [])

  // navigation state lives in a ref — the camera rig reads it every frame,
  // React never re-renders for a drag
  const nav = useRef<Nav>({ focusT: currentNode?.t ?? 0, azimuth: 0 })
  const drag = useRef({ active: false, x: 0, y: 0, moved: 0 })
  const [shade, setShade] = useState(0)

  useEffect(() => {
    nav.current.focusT = currentNode?.t ?? 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode?.id])

  const stateColour = (n: Node3D) =>
    n.state === 'done' ? pal.trailDone : n.state === 'current' ? pal.clay : n.state === 'available' ? pal.trail : pal.cloud

  const unitOfFocus = currentNode ? units[currentNode.unitIndex] : units[0]

  return (
    <div
      className="relative left-1/2 w-screen -translate-x-1/2 select-none overflow-hidden"
      style={{
        height: 'min(78vh, 720px)',
        touchAction: 'none',
        // day→night: the canvas is transparent; this DOM gradient is the sky
        background: `linear-gradient(${pal.night === pal.paper ? pal.paper : `color-mix(in oklab, ${pal.ink} ${Math.round(shade * 82)}%, ${pal.paper})`}, ${pal.paper})`,
        transition: 'background 600ms',
      }}
      onPointerDown={(e) => {
        drag.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d.active) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        d.x = e.clientX
        d.y = e.clientY
        d.moved += Math.abs(dx) + Math.abs(dy)
        nav.current.azimuth = Math.max(-2.4, Math.min(2.4, nav.current.azimuth - dx * 0.006))
        // finger up (dy negative) climbs — you push the mountain down past you
        nav.current.focusT = Math.max(0, Math.min(1, nav.current.focusT - dy * 0.0016))
      }}
      onPointerUp={() => {
        drag.current.active = false
      }}
      onPointerLeave={() => {
        drag.current.active = false
      }}
      onWheel={(e) => {
        nav.current.focusT = Math.max(0, Math.min(1, nav.current.focusT + e.deltaY * 0.00045))
      }}
    >
      <Canvas gl={{ antialias: true, alpha: true }} dpr={[1, 2]} camera={{ fov: 50, near: 0.5, far: 120 }}>
        <fog attach="fog" args={[pal.paper, 34, 78]} />
        <hemisphereLight args={['#dff3f0', pal.kraft, 0.55]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[14, 22, 8]} intensity={1.0} />

        <CameraRig nav={nav} />
        <SkyFade nav={nav} onShade={setShade} />
        {import.meta.env.DEV && <DevHook />}

        {/* the mountain */}
        <mesh position={[0, H / 2 - 0.6, 0]}>
          <coneGeometry args={[R0, H, 24, 5]} />
          <meshStandardMaterial color={pal.olive} flatShading />
        </mesh>
        {/* snow cap */}
        <mesh position={[0, H - 1.7, 0]}>
          <coneGeometry args={[mountainR(H - 3.4) + 0.12, 3.4, 24, 2]} />
          <meshStandardMaterial color="#f4f8f7" flatShading />
        </mesh>
        {/* grassy skirt + ground */}
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[R0 + 7.5, R0 + 8.4, 1.1, 28]} />
          <meshStandardMaterial color={pal.olive} flatShading />
        </mesh>

        {/* the walked trail: small stepping stones between nodes */}
        {nodes.map((n, i) => {
          if (i === 0) return null
          const stones = []
          for (let k = 1; k < 4; k++) {
            const t = nodes[i - 1].t + ((n.t - nodes[i - 1].t) * k) / 4
            const p = helixAt(t)
            stones.push(
              <mesh key={k} position={[p.x, p.y + 0.03, p.z]} rotation={[0, -helixAngle(t), 0]}>
                <cylinderGeometry args={[0.12, 0.14, 0.07, 5]} />
                <meshStandardMaterial
                  color={nodes[i].state === 'done' || nodes[i].state === 'current' ? pal.trailDone : pal.cloud}
                  flatShading
                />
              </mesh>,
            )
          }
          return <group key={`seg-${n.id}`}>{stones}</group>
        })}

        {/* lesson nodes */}
        {nodes.map((n, i) => (
          <group key={n.id}>
            <mesh
              position={n.pos}
              onClick={() => {
                if (drag.current.moved > 8) return
                onSelectLesson?.(n.id, n.state)
              }}
              onPointerOver={(e) => {
                if (n.state !== 'locked') (e.object as THREE.Mesh & { cursor?: string }).cursor = 'pointer'
                document.body.style.cursor = n.state === 'locked' ? 'default' : 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default'
              }}
            >
              <cylinderGeometry args={[0.42, 0.5, 0.22, 7]} />
              <meshStandardMaterial color={stateColour(n)} flatShading />
            </mesh>
            {!n.isGate && <NumberSprite n={i + 1} colour={n.state === 'locked' ? pal.cloud : pal.ink} position={n.pos} />}
            {/* earned stars hover over done nodes */}
            {n.state === 'done' &&
              Array.from({ length: n.stars }, (_, k) => (
                <mesh key={k} position={[n.pos.x, n.pos.y + 0.42 + k * 0.26, n.pos.z]} rotation={[0, k * 0.7, 0]}>
                  <octahedronGeometry args={[0.09, 0]} />
                  <meshStandardMaterial color={pal.gold} emissive={pal.gold} emissiveIntensity={0.35} flatShading />
                </mesh>
              ))}
            {/* torii over unit checkpoints */}
            {n.isGate && <Torii position={n.pos} angle={n.angle} colour={pal.clay} />}
          </group>
        ))}

        {/* you + your partner */}
        {currentNode && <Kitsune3D position={currentNode.pos.clone().setY(currentNode.pos.y + 0.12)} angle={currentNode.angle} tone={myTone} />}
        {partnerNode && partner && (
          <Kitsune3D
            position={partnerNode.pos.clone().setY(partnerNode.pos.y + 0.12)}
            angle={partnerNode.angle}
            tone={partner.tone}
            ghost
            scale={0.85}
          />
        )}

        {/* summit torii + the goal */}
        <Torii position={new THREE.Vector3(0, H - 1.15, 0)} angle={Math.PI / 2} scale={1.6} colour={pal.clay} />

        {/* foothill scenery */}
        {scenery.trees.map((tr, i) => (
          <Pine key={i} position={tr.pos} scale={tr.scale} foliage={pal.olive} trunk={pal.kraft} />
        ))}
        {scenery.rocks.map((r, i) => (
          <mesh key={i} position={r.pos} scale={r.scale}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={pal.cloud} flatShading />
          </mesh>
        ))}
        {scenery.lanterns.map((p, i) => (
          <Lantern key={i} position={p} lit={shade > 0.15} warm={pal.gold} post={pal.ink} />
        ))}

        {/* night sky — fades in with altitude */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[stars, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.16} color="#fdf8e7" transparent opacity={Math.min(0.95, shade * 1.3)} sizeAttenuation />
        </points>

        {/* the shinkansen loop + its tunnel foothill */}
        <Train pal={pal} />
        <group position={[Math.cos(2.2) * (R0 + 3.6), 0, Math.sin(2.2) * (R0 + 3.6)]}>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[2.6, 2.4, 8]} />
            <meshStandardMaterial color={pal.olive} flatShading />
          </mesh>
          {/* tunnel mouths, tangent to the track */}
          <mesh position={[0, 0.42, 0]} rotation={[0, -2.2 + Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 3.4, 10, 1, true]} />
            <meshStandardMaterial color={pal.ink} side={THREE.DoubleSide} flatShading />
          </mesh>
        </group>
      </Canvas>

      {/* HTML overlays — same voice as the 2D scene */}
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
        <span className="font-mono text-[10px] tracking-[0.08em] text-ink-soft">DRAG TO CLIMB · TAP A STONE</span>
      </div>
    </div>
  )
}
