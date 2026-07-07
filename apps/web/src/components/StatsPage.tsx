/** The travel journal (docs/DESIGN.md §6) — streak, words known, minutes
 * practiced, the week's bars, the strength garden. Lands in a later phase
 * once there's real activity to show; this stub proves the tab routes. */
export function StatsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Stats</h1>
      <p className="mt-1 text-sm text-ink-soft">Your travel journal starts once there's a day to log.</p>
      <div className="mt-8 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper-mid p-6 text-center">
        <p className="text-sm text-ink-soft">No activity yet.</p>
      </div>
    </div>
  )
}
