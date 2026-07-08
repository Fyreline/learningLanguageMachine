/** The living path walker (docs/DESIGN.md §5), redrawn 2026-07-08 (v2, same
 * day) per household reference images — the Duolingo owl, Overwatch
 * Kiriko's spirit-fox, and a doodle of a fox sitting cat-style. Forward-
 * facing head with the genuine Duo/Kiriko eye construction (a big white
 * oval, the head's OWN body colour dipping down over its top rim to read as
 * a brow — no separate eyebrow stroke, exactly how Duo's face is built —
 * a black pupil, one catchlight dot), sitting posture (haunches on the
 * ground, tail curling from behind round to the front) rather than the
 * standing-bipedal v1 redesign from earlier today.
 *
 * Colour is a FIXED per-tone two-tone palette (body + shadow), not
 * currentColor/theme tokens — the mascot's identity shouldn't repaint with
 * the UI theme, and the app's `clay-deep` token inverts (brightens) in dark
 * mode for hover states, which would break the shading illusion here.
 *
 * Idle: breathing, tail sway, blinks, occasional tilt. Walking: a bouncy
 * toddling waddle — the sitting silhouette doesn't have articulated legs, so
 * "walking" is the whole body hopping forward with the two front paws
 * alternating a small lift, tail swishing faster (for the future path-
 * advance transit animation). Celebrating: a big squash-and-stretch hop,
 * closed happy eyes, a small open smile. All motion behind
 * prefers-reduced-motion. */

export type KitsuneMood = 'idle' | 'walking' | 'celebrating'
export type KitsuneTone = 'clay' | 'sky'

const PALETTE: Record<KitsuneTone, { body: string; shadow: string }> = {
  clay: { body: '#c33c54', shadow: '#a03349' },
  sky: { body: '#37718e', shadow: '#2b5a71' },
}
const CREAM = '#fdf8f0'
const INK = '#17293a'

const KIT_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .kit-tail { transform-box: fill-box; transform-origin: 85% 90%; animation: kit-tail-idle 3.6s ease-in-out infinite; }
  .kit-body { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-breath 3.2s ease-in-out infinite; }
  .kit-head { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-tilt 7.4s ease-in-out infinite; }
  .kit-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: kit-blink 4.8s linear infinite; }

  .kit-walking .kit-root { animation: kit-waddle 0.6s ease-in-out infinite; }
  .kit-walking .kit-tail { animation: kit-tail-walk 0.6s ease-in-out infinite; }
  .kit-walking .kit-paw-l { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-paw-l 0.6s ease-in-out infinite; }
  .kit-walking .kit-paw-r { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-paw-r 0.6s ease-in-out infinite; }

  .kit-celebrating .kit-root { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-hop-cheer 1.1s ease-in-out infinite; }
  .kit-celebrating .kit-tail { animation: kit-tail-walk 0.5s ease-in-out infinite; }
  .kit-celebrating .kit-head { animation: none; transform: rotate(2deg); }
}
@keyframes kit-tail-idle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(4deg); } }
@keyframes kit-tail-walk { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(9deg); } }
@keyframes kit-breath { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
@keyframes kit-tilt { 0%, 76%, 100% { transform: rotate(0deg); } 83%, 92% { transform: rotate(-3deg); } }
@keyframes kit-blink { 0%, 93.9%, 98.1%, 100% { transform: scaleY(1); } 95%, 97% { transform: scaleY(0.12); } }
@keyframes kit-waddle {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-4px) rotate(-3deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-4px) rotate(3deg); }
}
@keyframes kit-paw-l { 0%, 50%, 100% { transform: translateY(0); } 25% { transform: translateY(-6px); } }
@keyframes kit-paw-r { 0%, 50%, 100% { transform: translateY(0); } 75% { transform: translateY(-6px); } }
@keyframes kit-hop-cheer {
  0%, 100% { transform: translateY(0) scaleY(1); }
  15% { transform: translateY(2px) scaleY(0.88); }
  45% { transform: translateY(-16px) scaleY(1.08); }
  65% { transform: translateY(0) scaleY(0.94); }
  82% { transform: translateY(-6px) scaleY(1.03); }
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
  const p = PALETTE[tone]
  const happy = mood === 'celebrating'
  return (
    <svg viewBox="-20 -35 140 155" aria-hidden width={width} height={height} className={`kit-${mood} ${className}`}>
      <style>{KIT_CSS}</style>
      <g className="kit-root">
        {/* tail: curls from behind, around the right side, resting in front — cream tip */}
        <g className="kit-tail">
          <path
            d="M78,95 Q100,90 104,66 Q106,44 90,30 Q78,20 62,22 Q78,26 86,40 Q92,54 84,66
               Q94,64 98,52 Q96,70 82,80 Q92,80 98,74 Q88,92 62,100 Q70,98 78,95 Z"
            fill={p.shadow}
          />
          <path d="M60,20 Q80,24 90,42 Q94,54 90,64 Q90,50 82,36 Q74,24 60,20 Z" fill={CREAM} />
        </g>

        {/* body: big rounded sitting mass, wider at the base */}
        <g className="kit-body">
          <path
            d="M50,10 C72,10 86,26 86,48 C86,64 80,74 70,80 C82,84 90,94 90,106
               L10,106 C10,94 18,84 30,80 C20,74 14,64 14,48 C14,26 28,10 50,10 Z"
            fill={p.body}
          />
          <path
            d="M90,106 L70,106 C78,98 84,88 84,76 C86,66 86,54 82,44 C86,52 88,62 86,72
               C90,82 92,94 90,106 Z"
            fill={p.shadow}
            opacity="0.5"
          />
          <path
            d="M86,48 C86,64 80,74 70,80 C76,70 78,56 74,42 C78,32 82,20 76,14 C82,20 86,32 86,48 Z"
            fill={p.shadow}
            opacity="0.4"
          />
          {/* front paws, animated independently for the walk cycle */}
          <g className="kit-paw-l">
            <ellipse cx="38" cy="103" rx="10" ry="7" fill={CREAM} />
          </g>
          <g className="kit-paw-r">
            <ellipse cx="62" cy="103" rx="10" ry="7" fill={CREAM} />
          </g>
        </g>

        {/* head: forward-facing, Duo/Kiriko-style eyes */}
        <g className="kit-head">
          <path d="M20,22 Q11,-6 32,4 Q40,14 33,26 Q25,25 20,22 Z" fill={p.body} />
          <path d="M23,17 Q18,0 30,7 Q34,14 29,21 Q26,19 23,17 Z" fill={CREAM} opacity="0.9" />
          <path d="M80,22 Q89,-6 68,4 Q60,14 67,26 Q75,25 80,22 Z" fill={p.body} />
          <path d="M77,17 Q82,0 70,7 Q66,14 71,21 Q74,19 77,17 Z" fill={CREAM} opacity="0.9" />

          <path
            d="M50,26 C64,26 71,35 69,47 C67,58 60,64 50,64 C40,64 33,58 31,47 C29,35 36,26 50,26 Z"
            fill={CREAM}
          />

          {happy ? (
            <>
              <path d="M31,42 Q40,32 49,41" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
              <path d="M51,41 Q60,32 69,42" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
              <path d="M43,58 Q50,63 57,58" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            </>
          ) : (
            <g className="kit-eyes">
              <ellipse cx="40" cy="43" rx="11" ry="13" fill={CREAM} />
              <path d="M29.5,40 Q40,29.5 50.5,40 Q40,35.5 29.5,40 Z" fill={p.body} />
              <circle cx="41" cy="45.5" r="6.6" fill={INK} />
              <circle cx="43.8" cy="41.8" r="2.2" fill={CREAM} />

              <ellipse cx="60" cy="43" rx="11" ry="13" fill={CREAM} />
              <path d="M49.5,40 Q60,29.5 70.5,40 Q60,35.5 49.5,40 Z" fill={p.body} />
              <circle cx="61" cy="45.5" r="6.6" fill={INK} />
              <circle cx="63.8" cy="41.8" r="2.2" fill={CREAM} />
            </g>
          )}

          <path d="M46,54 L54,54 L50,59 Z" fill={INK} />
          {!happy && (
            <path d="M42,60 Q46,64 50,60.5 Q54,64 58,60" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          )}
        </g>
      </g>
    </svg>
  )
}
