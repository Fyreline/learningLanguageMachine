/** Every item learned so far, browsable and searchable (docs/ARCHITECTURE.md).
 * Lands in a later phase once there's an item bank to browse; this stub
 * proves the tab routes. */
export function PhrasebookPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Phrasebook</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Words and phrases you've learned will collect here.
      </p>
      <div className="mt-8 flex min-h-64 items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper-mid p-6 text-center">
        <p className="text-sm text-ink-soft">Nothing learned yet — the first lesson comes next.</p>
      </div>
    </div>
  )
}
