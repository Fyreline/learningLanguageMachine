/** The living path walker (docs/DESIGN.md §5): the MichiMark kitsune, brought
 * to life Duolingo-style — always faintly in motion, never demanding. Idle:
 * breathing, tail swish, blinks, an occasional glance and head-tilt. Walking:
 * a quick trot bob. Celebrating: squash-and-stretch hops with happy ^-^ eyes.
 * Pure CSS keyframes (scoped `kit-` names, style tag local to the component)
 * so it works nested inside PathScene's SVG; everything sits behind
 * prefers-reduced-motion, where the kitsune simply stands still.
 * Shares its geometry with MichiMark's `kitsune` variant — if you change one
 * silhouette, change both. */

export type KitsuneMood = 'idle' | 'walking' | 'celebrating'

const KIT_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .kit-root, .kit-tail, .kit-body, .kit-head, .kit-eyes, .kit-eye {
    transform-box: view-box;
  }
  .kit-eye { transform-box: fill-box; transform-origin: center; }
  .kit-tail { transform-origin: 16px 29px; animation: kit-swish 3.4s ease-in-out infinite; }
  .kit-body { transform-box: fill-box; transform-origin: 50% 100%; animation: kit-breath 3.2s ease-in-out infinite; }
  .kit-head { transform-origin: 34px 20px; animation: kit-tilt 7.2s ease-in-out infinite; }
  .kit-eyes { animation: kit-glance 9s ease-in-out infinite; }
  .kit-eye { animation: kit-blink 4.6s linear infinite; }
  .kit-walking .kit-root { transform-origin: 28px 41px; animation: kit-trot 0.5s ease-in-out infinite; }
  .kit-walking .kit-tail { animation-duration: 1.4s; }
  .kit-celebrating .kit-root { transform-origin: 28px 41px; animation: kit-hop 1.3s ease-in-out infinite; }
  .kit-celebrating .kit-tail { animation: kit-swish 0.8s ease-in-out infinite; }
  .kit-celebrating .kit-head { animation: none; transform: rotate(3deg); }
}
@keyframes kit-swish { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(7deg); } }
@keyframes kit-breath { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.025); } }
@keyframes kit-tilt { 0%, 76%, 100% { transform: rotate(0deg); } 83%, 92% { transform: rotate(-4deg); } }
@keyframes kit-glance { 0%, 54%, 100% { transform: translateX(0); } 60%, 71% { transform: translateX(-0.9px); } 77%, 90% { transform: translateX(0.7px); } }
@keyframes kit-blink { 0%, 93.9%, 98.1%, 100% { transform: scaleY(1); } 95%, 97% { transform: scaleY(0.12); } }
@keyframes kit-trot {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-1.6px) rotate(-1.2deg); }
  75% { transform: translateY(-0.8px) rotate(1deg); }
}
@keyframes kit-hop {
  0%, 82%, 100% { transform: translateY(0) scaleY(1); }
  10% { transform: translateY(1.5px) scaleY(0.9); }
  32% { transform: translateY(-7px) scaleY(1.06); }
  50% { transform: translateY(0) scaleY(0.94); }
  62% { transform: translateY(-4px) scaleY(1.04); }
}
`

export function AnimatedKitsune({
  mood = 'idle',
  width,
  height,
  className = '',
}: {
  mood?: KitsuneMood
  /** Explicit attributes for nesting inside another SVG (PathScene). */
  width?: number
  height?: number
  className?: string
}) {
  const colour = className.includes('text-') ? className : `text-clay ${className}`
  const happy = mood === 'celebrating'
  return (
    <svg viewBox="0 0 46 42" aria-hidden width={width} height={height} className={`kit-${mood} ${colour}`}>
      <style>{KIT_CSS}</style>
      <g className="kit-root">
        {/* tail — the kitsune's flag, pale-tipped */}
        <g className="kit-tail">
          <path d="M16,31 Q3,30 2,18 Q2,8 10,4.5 Q9,11.5 12.5,15 Q18.5,19.5 17.5,28 Z" fill="currentColor" />
          <path d="M10,4.5 Q9.4,10.5 12,13.8 Q14.5,10.8 13.2,7.4 Q11.8,5.4 10,4.5 Z" fill="var(--color-paper)" opacity="0.9" />
        </g>
        {/* body + legs breathe as one */}
        <g className="kit-body">
          <path d="M15,32 Q14.5,23 22,20 Q28,18.5 34,20 L39,22 Q42,24 42,28 L42,32 Q42,36 38,36 L19,36 Q15,36 15,32 Z" fill="currentColor" />
          <rect x="18" y="33" width="3.4" height="8" rx="1.6" fill="currentColor" />
          <rect x="26.5" y="34" width="3.4" height="7" rx="1.6" fill="currentColor" />
          <rect x="35" y="33" width="3.4" height="8" rx="1.6" fill="currentColor" />
        </g>
        <g className="kit-head">
          <g transform="translate(28.5,3) scale(0.92)">
            <path
              d="M2,8 L1,1 L7,5.5 Q10,4 13,5.5 L19,1 L18,8 Q21,12 18,16 Q15,20 10,20 Q4.5,20 2.5,15.5 Q0.5,11.5 2,8 Z"
              fill="currentColor"
            />
            {happy ? (
              <g fill="none" stroke="var(--color-paper)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6.2,12.6 Q7.5,10.9 8.8,12.6" />
                <path d="M12.2,12.6 Q13.5,10.9 14.8,12.6" />
              </g>
            ) : (
              <g className="kit-eyes">
                <circle className="kit-eye" cx="7.5" cy="12" r="1.3" fill="var(--color-paper)" />
                <circle className="kit-eye" cx="13.5" cy="12" r="1.3" fill="var(--color-paper)" />
              </g>
            )}
            <path d="M9.5,15.5 L11.5,15.5 L10.5,16.7 Z" fill="var(--color-paper)" />
          </g>
        </g>
      </g>
    </svg>
  )
}
