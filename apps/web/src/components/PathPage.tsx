/** The Path (home) — Michi's signature surface (docs/DESIGN.md §5): the
 * winding trail from the front door to Mt. Fuji. The SVG scene, node states,
 * torii checkpoints, and summit meter land in a later phase; this stub
 * proves the tab routes and renders on the shell. */
export function PathPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Path</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The trail from the front door to Mt. Fuji starts here — units, lessons, and the
        walking cat land in a later phase.
      </p>
      <div className="mt-8 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper-mid p-6 text-center">
        <p className="text-sm text-ink-soft">Nothing to walk yet — the course content ships next.</p>
      </div>
    </div>
  )
}
