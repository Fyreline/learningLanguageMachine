/** Michi's brand mark (docs/DESIGN.md §3): the household cat sitting inside a
 * torii gate — the gate you pass through onto the path. Used for the header,
 * login screen and favicon. The path WALKER is a separate character —
 * AnimatedKitsune.tsx — redrawn 2026-07-08 in Duolingo-mascot styling; it
 * used to be a `variant` of this component but earned its own file once it
 * became a fully animated, layered-shading character in its own right. */

export function MichiMark({
  className = 'h-9 w-9',
  width,
  height,
}: {
  className?: string
  /** Explicit SVG attributes for when the mark is nested inside another SVG
   * — CSS class sizing doesn't reach a nested <svg> reliably. */
  width?: number
  height?: number
}) {
  const colour = className.includes('text-') ? className : `text-clay ${className}`
  return (
    <svg viewBox="0 0 36 32" aria-hidden width={width} height={height} className={colour}>
      {/* kasagi — the curved top lintel, tips swept upward */}
      <path d="M1,6 Q18,1.6 35,6 L34.2,9.2 Q18,5.4 1.8,9.2 Z" fill="currentColor" />
      {/* nuki — the straight tie beam */}
      <rect x="4.5" y="11.6" width="27" height="2.6" fill="currentColor" />
      {/* pillars */}
      <rect x="5" y="8.6" width="3" height="23.4" rx="1" fill="currentColor" />
      <rect x="28" y="8.6" width="3" height="23.4" rx="1" fill="currentColor" />
      {/* the cat, sat in the gateway */}
      <g transform="translate(9.2,15.2) scale(0.55)">
        <path
          d="M4,9 L2,1.5 L10,7.5 Q16,4 22,7.5 L30,1.5 L28,9 Q30.5,14.5 28,20 Q24.5,26 16,26 Q7.5,26 4,20 Q1.5,14.5 4,9 Z"
          fill="currentColor"
        />
        <circle cx="12" cy="16.5" r="1.6" fill="var(--color-paper)" />
        <circle cx="20" cy="16.5" r="1.6" fill="var(--color-paper)" />
        <path d="M15,20 L17,20 L16,21.3 Z" fill="var(--color-paper)" />
      </g>
    </svg>
  )
}
