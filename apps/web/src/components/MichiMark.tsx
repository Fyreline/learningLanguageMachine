/** Michi's brand mark (docs/DESIGN.md §3): the household cat sitting inside a
 * torii gate — the gate you pass through onto the path. Two variants:
 * `torii` (default; header, login, favicon) and `cat` (the bare walking cat
 * that treads the Path scene, and the partner's ghost). `currentColor`
 * throughout so both follow clay/sky and the theme, same as Mishka's mark. */

function CatFace() {
  return (
    <>
      <path
        d="M4,9 L2,1.5 L10,7.5 Q16,4 22,7.5 L30,1.5 L28,9 Q30.5,14.5 28,20 Q24.5,26 16,26 Q7.5,26 4,20 Q1.5,14.5 4,9 Z"
        fill="currentColor"
      />
      <circle cx="12" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <circle cx="20" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <path d="M15,20 L17,20 L16,21.3 Z" fill="var(--color-paper)" />
    </>
  )
}

export function MichiMark({
  className = 'h-9 w-9',
  width,
  height,
  variant = 'torii',
}: {
  className?: string
  /** Explicit SVG attributes for when the mark is nested inside another SVG
   * (PathScene) — CSS class sizing doesn't reach a nested <svg> reliably. */
  width?: number
  height?: number
  variant?: 'torii' | 'cat'
}) {
  // default clay unless the caller brings its own text-* colour (the
  // partner's ghost cat is sky) — appending both risks stylesheet-order
  // roulette between two same-specificity utilities
  const colour = className.includes('text-') ? className : `text-clay ${className}`
  if (variant === 'cat') {
    return (
      <svg viewBox="0 0 32 28" aria-hidden width={width} height={height} className={colour}>
        <CatFace />
      </svg>
    )
  }
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
      <g transform="translate(10.4,15.2) scale(0.55)">
        <CatFace />
      </g>
    </svg>
  )
}
