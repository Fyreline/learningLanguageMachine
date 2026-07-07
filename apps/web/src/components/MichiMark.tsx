/** Michi's brand mark (docs/DESIGN.md §3): Mishka Hub's two-eared cat
 * silhouette (CatMark), copied as a placeholder per docs/phases/
 * PHASE-1-scaffold.md, plus one extra path drawing a tiny knotted travel
 * bindle over one shoulder — the one addition that makes the mark Michi's
 * own. `currentColor` so it follows clay and theme, same as Mishka's mark. */
export function MichiMark({ className = 'h-9 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 28" aria-hidden className={`text-clay ${className}`}>
      <path
        d="M4,9 L2,1.5 L10,7.5 Q16,4 22,7.5 L30,1.5 L28,9 Q30.5,14.5 28,20 Q24.5,26 16,26 Q7.5,26 4,20 Q1.5,14.5 4,9 Z"
        fill="currentColor"
      />
      <circle cx="12" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <circle cx="20" cy="16.5" r="1.6" fill="var(--color-paper)" />
      <path d="M15,20 L17,20 L16,21.3 Z" fill="var(--color-paper)" />
      {/* the bindle: a stick over one shoulder, a knotted bundle at its tip */}
      <path
        d="M26,10.5 L35,2.5 M35,2.5 m-2.4,0 a2.4,2.4 0 1,0 4.8,0 a2.4,2.4 0 1,0 -4.8,0 M33.2,2.5 L36.8,2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
