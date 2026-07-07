/** Michi's brand mark (docs/DESIGN.md §3): Mishka Hub's two-eared cat
 * silhouette (CatMark) under a small rising-sun disc — the cat on the road,
 * morning ahead. (Replaced the earlier "travel bindle" 2026-07-07: at mark
 * size the stick read as inexplicable clutter.) `currentColor` so it follows
 * clay and theme, same as Mishka's mark. */
export function MichiMark({
  className = 'h-9 w-10',
  width,
  height,
}: {
  className?: string
  /** Explicit SVG attributes for when the mark is nested inside another SVG
   * (PathScene) — CSS class sizing doesn't reach a nested <svg> reliably. */
  width?: number
  height?: number
}) {
  return (
    <svg
      viewBox="0 0 38 28"
      aria-hidden
      width={width}
      height={height}
      // default clay unless the caller brings its own text-* colour (the
      // partner's ghost cat is sky) — appending both risks stylesheet-order
      // roulette between two same-specificity utilities
      className={className.includes('text-') ? className : `text-clay ${className}`}
    >
      <path
        d="M4,9 L2,1.5 L10,7.5 Q16,4 22,7.5 L30,1.5 L28,9 Q30.5,14.5 28,20 Q24.5,26 16,26 Q7.5,26 4,20 Q1.5,14.5 4,9 Z"
        fill="currentColor"
      />
      <circle cx="12" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <circle cx="20" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <path d="M15,20 L17,20 L16,21.3 Z" fill="var(--color-paper)" />
      {/* the rising sun, up and to the right of the road ahead */}
      <circle cx="34.5" cy="5" r="3.1" fill="currentColor" />
    </svg>
  )
}
