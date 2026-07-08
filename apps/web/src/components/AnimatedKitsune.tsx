/** The living path walker (docs/DESIGN.md §5), redrawn 2026-07-08 in
 * Duolingo-mascot styling by explicit household request: a big-headed,
 * anthropomorphic, chunky-rounded character built from layered flat shapes
 * (a base tone + one darker "shadow" shape per body part, no gradients),
 * huge expressive eyes, and a fox's ears + tail as the one signature feature
 * that makes it ours rather than a reskinned owl.
 *
 * Colour is a FIXED two-tone palette per `tone`, not the page's currentColor/
 * theme tokens — the mascot's own identity shouldn't repaint with the UI
 * theme, and critically the app's `clay-deep` token INVERTS in dark mode
 * (it's a hover-brighten value there, lighter than clay, not darker) which
 * would break the shading illusion if reused here.
 *
 * Idle: breathing, tail swish, blinks, occasional glance/tilt. Walking: a
 * bouncy hop-step (this is a chibi mascot, not a gait study) with alternating
 * foot lift and arm swing. Celebrating: a big squash-and-stretch hop, arms
 * thrown up, closed happy eyes, a small open smile. Everything sits behind
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
  .kit-tail { transform-box: fill-box; transform-origin: 15% 92%; animation: kit-tail-idle 3.6s ease-in-out infinite; }
  .kit-body { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-breath 3.2s ease-in-out infinite; }
  .kit-head { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-tilt 7.4s ease-in-out infinite; }
  .kit-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: kit-blink 4.8s linear infinite; }
  .kit-arm-l { transform-box: fill-box; transform-origin: 90% 15%; animation: kit-arm-l-idle 5s ease-in-out infinite; }
  .kit-arm-r { transform-box: fill-box; transform-origin: 10% 15%; animation: kit-arm-r-idle 5s ease-in-out infinite; }

  .kit-walking .kit-root { animation: kit-hop-walk 0.62s ease-in-out infinite; }
  .kit-walking .kit-tail { animation: kit-tail-walk 0.62s ease-in-out infinite; }
  .kit-walking .kit-foot-l { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-foot-l 0.62s ease-in-out infinite; }
  .kit-walking .kit-foot-r { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-foot-r 0.62s ease-in-out infinite; }
  .kit-walking .kit-arm-l { animation: kit-arm-l-walk 0.62s ease-in-out infinite; }
  .kit-walking .kit-arm-r { animation: kit-arm-r-walk 0.62s ease-in-out infinite; }

  .kit-celebrating .kit-root { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-hop-cheer 1.1s ease-in-out infinite; }
  .kit-celebrating .kit-tail { animation: kit-tail-walk 0.55s ease-in-out infinite; }
  .kit-celebrating .kit-arm-l { animation: kit-arm-l-cheer 1.1s ease-in-out infinite; }
  .kit-celebrating .kit-arm-r { animation: kit-arm-r-cheer 1.1s ease-in-out infinite; }
  .kit-celebrating .kit-head { animation: none; transform: rotate(2deg); }
}
@keyframes kit-tail-idle { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(6deg); } }
@keyframes kit-tail-walk { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(12deg); } }
@keyframes kit-breath { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.025); } }
@keyframes kit-tilt { 0%, 76%, 100% { transform: rotate(0deg); } 83%, 92% { transform: rotate(-3deg); } }
@keyframes kit-blink { 0%, 93.9%, 98.1%, 100% { transform: scaleY(1); } 95%, 97% { transform: scaleY(0.12); } }
@keyframes kit-arm-l-idle { 0%, 100% { transform: rotate(-16deg); } 50% { transform: rotate(-10deg); } }
@keyframes kit-arm-r-idle { 0%, 100% { transform: rotate(16deg); } 50% { transform: rotate(10deg); } }
@keyframes kit-hop-walk {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-5px) rotate(-2deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-5px) rotate(2deg); }
}
@keyframes kit-foot-l { 0%, 50%, 100% { transform: translateY(0); } 25% { transform: translateY(-9px); } }
@keyframes kit-foot-r { 0%, 50%, 100% { transform: translateY(0); } 75% { transform: translateY(-9px); } }
@keyframes kit-arm-l-walk { 0%, 100% { transform: rotate(-28deg); } 50% { transform: rotate(-4deg); } }
@keyframes kit-arm-r-walk { 0%, 100% { transform: rotate(4deg); } 50% { transform: rotate(28deg); } }
@keyframes kit-hop-cheer {
  0%, 100% { transform: translateY(0) scaleY(1); }
  15% { transform: translateY(2px) scaleY(0.88); }
  45% { transform: translateY(-16px) scaleY(1.08); }
  65% { transform: translateY(0) scaleY(0.94); }
  82% { transform: translateY(-6px) scaleY(1.03); }
}
@keyframes kit-arm-l-cheer { 0%, 100% { transform: rotate(-150deg); } 50% { transform: rotate(-170deg); } }
@keyframes kit-arm-r-cheer { 0%, 100% { transform: rotate(150deg); } 50% { transform: rotate(170deg); } }
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
    <svg viewBox="-14 -14 150 132" aria-hidden width={width} height={height} className={`kit-${mood} ${className}`}>
      <style>{KIT_CSS}</style>
      <g className="kit-root">
        {/* tail: a big comma sweep draping up from behind the body, cream tip */}
        <g className="kit-tail">
          <path
            d="M62,98 C86,96 106,80 108,54 C110,30 96,10 76,4 C92,10 100,26 98,44
               C96,62 82,74 66,74 C80,70 88,58 88,44 C88,54 80,64 68,66
               C78,64 84,54 84,44 C84,58 72,68 60,66 C68,80 66,90 62,98 Z"
            fill={p.shadow}
          />
          <path
            d="M76,4 C92,10 100,26 98,44 C97,52 93,60 87,65 C92,54 92,38 84,24 C80,16 78,10 76,4 Z"
            fill={CREAM}
          />
        </g>

        {/* arms — no baked-in transform attribute; CSS drives the resting
            angle so celebrating can override it cleanly */}
        <g className="kit-arm-l">
          <ellipse cx="15" cy="68" rx="9.5" ry="14" fill={p.body} />
          <path d="M9,60 Q7,69 13,80 Q8,73 7,64 Q7,60 9,60 Z" fill={p.shadow} opacity="0.6" />
        </g>
        <g className="kit-arm-r">
          <ellipse cx="85" cy="68" rx="9.5" ry="14" fill={p.body} />
        </g>

        {/* body */}
        <g className="kit-body">
          <path
            d="M50,2 C68,2 81,15 81,33 C81,42 78,49 73,54 C81,60 86,71 86,83
               C86,100 70,108 50,108 C30,108 14,100 14,83 C14,71 19,60 27,54
               C22,49 19,42 19,33 C19,15 32,2 50,2 Z"
            fill={p.body}
          />
          <path
            d="M86,83 C86,100 70,108 50,108 C60,104 70,95 72,80 C74,64 68,53 60,50
               C72,52 82,62 85,73 Z"
            fill={p.shadow}
            opacity="0.55"
          />
          <path d="M81,33 C81,42 78,49 73,54 C77,45 77,29 70,18 C76,20 81,26 81,33 Z" fill={p.shadow} opacity="0.45" />
          {/* feet, animated independently for the walk cycle */}
          <g className="kit-foot-l">
            <ellipse cx="37" cy="107" rx="12" ry="7.5" fill={p.shadow} />
          </g>
          <g className="kit-foot-r">
            <ellipse cx="63" cy="107" rx="12" ry="7.5" fill={p.shadow} />
          </g>
        </g>

        {/* head */}
        <g className="kit-head">
          <path d="M23,20 Q15,-4 34,5 Q41,14 34,28 Q27,26 23,20 Z" fill={p.body} />
          <path d="M26,16 Q22,1 32,7 Q36,14 31,21 Q28,19 26,16 Z" fill={CREAM} opacity="0.9" />
          <path d="M77,20 Q85,-4 66,5 Q59,14 66,28 Q73,26 77,20 Z" fill={p.body} />
          <path d="M74,16 Q78,1 68,7 Q64,14 69,21 Q72,19 74,16 Z" fill={CREAM} opacity="0.9" />
          <path
            d="M50,20 C65,20 73,30 71,43 C69,56 61,62 50,62 C39,62 31,56 29,43 C27,30 35,20 50,20 Z"
            fill={CREAM}
          />
          {happy ? (
            <>
              <path d="M31,35 Q37,26 45,33" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
              <path d="M69,35 Q63,26 55,33" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
              <path d="M44,53 Q50,58 56,53" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M30,26 Q36,19 44,23" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              <path d="M70,26 Q64,19 56,23" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              <g className="kit-eyes">
                <circle cx="41" cy="39" r="9.5" fill={INK} />
                <circle cx="59" cy="39" r="9.5" fill={INK} />
                <circle cx="44.2" cy="35" r="3" fill={CREAM} />
                <circle cx="62.2" cy="35" r="3" fill={CREAM} />
              </g>
            </>
          )}
          <path d="M46,52 L54,52 L50,58 Z" fill={INK} />
        </g>
      </g>
    </svg>
  )
}
