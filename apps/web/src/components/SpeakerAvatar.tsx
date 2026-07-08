/** "Someone saying it" — a small cast of speaker avatars shown beside the
 * audio controls during lessons (docs/DESIGN.md §4), Duolingo-people styled:
 * the same eye construction as AnimatedKitsune's face (white oval, a
 * coloured crescent dipping over its top rim, black pupil, one catchlight
 * dot) applied to people this time, flat rounded shapes, one accent colour
 * per character's top. Six hand-illustrated presets — matches how
 * Duolingo's own cast actually works (each character is its own
 * illustration: hijab, turban+beard, glasses+buzzcut, cap, twin hair
 * styles), not a proceduraly-combined part-assembler.
 *
 * The mouth alternates closed/open while `speaking` is true — a simple
 * two-frame "talking" flicker driven by CSS, synced to the shared TTS
 * speaking-state pub/sub (see AudioStage in exercises/shared.tsx). Not real
 * lip-sync, just enough motion to read as "this person is the one saying
 * it," not a passport photo. */

import type { ReactElement } from 'react'

const INK = '#17293a'
const CREAM = '#fdf8f0'

/** Shared eye pair + the two-frame mouth — every preset renders this once,
 * at consistent coordinates, so only the hair/headwear/accessories vary. */
function Face({ mouthColour }: { mouthColour: string }) {
  return (
    <>
      <ellipse cx="40" cy="38" rx="7" ry="8.5" fill={CREAM} />
      <ellipse cx="60" cy="38" rx="7" ry="8.5" fill={CREAM} />
      <circle cx="41" cy="40" r="4.2" fill={INK} />
      <circle cx="61" cy="40" r="4.2" fill={INK} />
      <circle cx="43" cy="37.3" r="1.4" fill={CREAM} />
      <circle cx="63" cy="37.3" r="1.4" fill={CREAM} />
      <path
        className="spk-mouth-closed"
        d="M44,52 Q50,56 56,52"
        fill="none"
        stroke={mouthColour}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <ellipse className="spk-mouth-open" cx="50" cy="53" rx="4.5" ry="3.6" fill={mouthColour} opacity="0" />
    </>
  )
}

export interface SpeakerSpec {
  key: string
  render: () => ReactElement
}

export const SPEAKERS: SpeakerSpec[] = [
  {
    key: 'a', // short dark hair, headband-line, steel top
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#37718e" />
        <rect x="41" y="58" width="18" height="14" fill="#dba374" />
        <circle cx="50" cy="40" r="24" fill="#dba374" />
        <path d="M26,36 Q25,14 50,14 Q75,14 74,36 Q74,26 50,26 Q26,26 26,36 Z" fill="#2b2118" />
        <path d="M32,34 Q40,25 48,34 Q40,30 32,34 Z" fill="#2b2118" />
        <path d="M52,34 Q60,25 68,34 Q60,30 52,34 Z" fill="#2b2118" />
        <Face mouthColour="#8a4a3a" />
      </>
    ),
  },
  {
    key: 'b', // long centre-parted hair, plum top, deep skin
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#9c3f6d" />
        <rect x="41" y="58" width="18" height="14" fill="#6b4128" />
        <circle cx="50" cy="40" r="24" fill="#6b4128" />
        <path
          d="M24,40 Q20,12 50,10 Q80,12 76,40 Q80,54 72,62 Q76,42 66,28 Q58,18 50,18 Q42,18 34,28
             Q24,42 28,62 Q20,54 24,40 Z"
          fill="#161009"
        />
        <path d="M32,34 Q40,25 48,34 Q40,30 32,34 Z" fill="#161009" />
        <path d="M52,34 Q60,25 68,34 Q60,30 52,34 Z" fill="#161009" />
        <Face mouthColour="#5a3018" />
      </>
    ),
  },
  {
    key: 'c', // glasses, buzzcut, teal top, light skin
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#2e8b74" />
        <rect x="41" y="58" width="18" height="14" fill="#f0c8a0" />
        <circle cx="50" cy="40" r="24" fill="#f0c8a0" />
        <path d="M26,32 Q25,15 50,15 Q75,15 74,32 Q74,24 50,24 Q26,24 26,32 Z" fill="#5a3c28" />
        <Face mouthColour="#9a5a3a" />
        <circle cx="40" cy="38" r="10" fill="none" stroke={INK} strokeWidth="2" />
        <circle cx="60" cy="38" r="10" fill="none" stroke={INK} strokeWidth="2" />
        <path d="M30,38 L24,36 M70,38 L76,36" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    key: 'd', // hijab, cyan top, warm mid skin
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#3d9db3" />
        <rect x="41" y="58" width="18" height="10" fill="#c88a5c" />
        <path
          d="M18,52 Q12,20 50,14 Q88,20 82,52 Q84,70 74,80 L70,66 Q76,50 72,34 Q66,20 50,20
             Q34,20 28,34 Q24,50 30,66 L26,80 Q16,70 18,52 Z"
          fill="#c33c54"
        />
        <circle cx="50" cy="42" r="21" fill="#c88a5c" />
        <ellipse cx="41" cy="40" rx="7" ry="8.5" fill={CREAM} />
        <ellipse cx="59" cy="40" rx="7" ry="8.5" fill={CREAM} />
        <path d="M33,36 Q41,27 49,36 Q41,32 33,36 Z" fill="#3d2a1c" />
        <path d="M51,36 Q59,27 67,36 Q59,32 51,36 Z" fill="#3d2a1c" />
        <circle cx="42" cy="42" r="4.2" fill={INK} />
        <circle cx="60" cy="42" r="4.2" fill={INK} />
        <circle cx="44" cy="39.3" r="1.4" fill={CREAM} />
        <circle cx="62" cy="39.3" r="1.4" fill={CREAM} />
        <path
          className="spk-mouth-closed"
          d="M44,54 Q50,58 56,54"
          fill="none"
          stroke="#8a4a2a"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <ellipse className="spk-mouth-open" cx="50" cy="55" rx="4.5" ry="3.6" fill="#8a4a2a" opacity="0" />
      </>
    ),
  },
  {
    key: 'e', // turban, beard, mustard top
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#d4a24f" />
        <rect x="41" y="58" width="18" height="12" fill="#c88a5c" />
        <circle cx="50" cy="42" r="22" fill="#c88a5c" />
        <path
          d="M22,38 Q18,10 50,8 Q82,10 78,38 Q78,26 72,20 Q76,26 74,32 L26,32 Q24,26 28,20 Q22,26 22,38 Z"
          fill="#788c5d"
        />
        <path d="M46,8 Q50,4 54,8 L54,16 L46,16 Z" fill="#788c5d" />
        <ellipse cx="41" cy="42" rx="7" ry="8.5" fill={CREAM} />
        <ellipse cx="59" cy="42" rx="7" ry="8.5" fill={CREAM} />
        <circle cx="42" cy="44" r="4.2" fill={INK} />
        <circle cx="60" cy="44" r="4.2" fill={INK} />
        <circle cx="44" cy="41.3" r="1.4" fill={CREAM} />
        <circle cx="62" cy="41.3" r="1.4" fill={CREAM} />
        <path d="M32,50 Q32,64 50,66 Q68,64 68,50 Q68,60 50,60 Q32,60 32,50 Z" fill="#2b2118" />
        <path
          className="spk-mouth-closed"
          d="M44,56 Q50,59 56,56"
          fill="none"
          stroke="#8a4a2a"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <ellipse className="spk-mouth-open" cx="50" cy="57" rx="3.6" ry="2.8" fill="#2b2118" opacity="0" />
      </>
    ),
  },
  {
    key: 'f', // cap worn backwards, freckles, coral top
    render: () => (
      <>
        <path d="M14,100 Q14,74 32,68 Q50,74 68,68 Q86,74 86,100 Z" fill="#c46686" />
        <rect x="41" y="58" width="18" height="14" fill="#f0c8a0" />
        <circle cx="50" cy="40" r="24" fill="#f0c8a0" />
        <path d="M25,30 Q24,12 50,10 Q76,12 75,30 Q76,20 50,18 Q24,20 25,30 Z" fill="#241a12" />
        <path d="M23,25 Q23,4 50,4 Q77,4 77,25 Q65,15 50,15 Q35,15 23,25 Z" fill="#d97757" />
        <ellipse cx="40" cy="42" rx="1.6" ry="1.6" fill="#c88a5c" opacity="0.6" />
        <ellipse cx="45" cy="45" rx="1.4" ry="1.4" fill="#c88a5c" opacity="0.6" />
        <ellipse cx="60" cy="42" rx="1.6" ry="1.6" fill="#c88a5c" opacity="0.6" />
        <ellipse cx="55" cy="45" rx="1.4" ry="1.4" fill="#c88a5c" opacity="0.6" />
        <Face mouthColour="#9a5a3a" />
      </>
    ),
  },
]

/** Deterministic per-item pick — the same phrase always shows the same
 * speaker (a recurring cast, not a randomiser on every render). */
export function speakerFor(itemId: string): SpeakerSpec {
  let h = 0
  for (let i = 0; i < itemId.length; i++) h = (h * 31 + itemId.charCodeAt(i)) >>> 0
  return SPEAKERS[h % SPEAKERS.length]
}

const TALK_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .spk-talking .spk-mouth-closed { animation: spk-flap-closed 0.32s steps(1) infinite; }
  .spk-talking .spk-mouth-open { animation: spk-flap-open 0.32s steps(1) infinite; }
}
@keyframes spk-flap-closed { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes spk-flap-open { 0%, 49% { opacity: 0; } 50%, 100% { opacity: 1; } }
`

export function SpeakerAvatar({
  spec,
  speaking = false,
  width = 56,
  height = 56,
  className = '',
}: {
  spec: SpeakerSpec
  speaking?: boolean
  width?: number
  height?: number
  className?: string
}) {
  return (
    <svg
      viewBox="14 0 72 72"
      width={width}
      height={height}
      className={`${speaking ? 'spk-talking' : ''} ${className}`}
      aria-hidden
    >
      <style>{TALK_CSS}</style>
      {spec.render()}
    </svg>
  )
}
