/** SRS reviews + free drills (docs/ARCHITECTURE.md). The due-queue UI and
 * kana trainer land in a later phase; this stub proves the tab routes. */
export function PracticePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Practice</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Reviews and kana drills will show up here once there's anything due.
      </p>
      <div className="mt-8 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper-mid p-6 text-center">
        <p className="text-sm text-ink-soft">Nothing due yet.</p>
      </div>
    </div>
  )
}
