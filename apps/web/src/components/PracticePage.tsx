/** SRS reviews + free drills (docs/phases/PHASE-4-practice.md §1). Composition
 * over ReviewPlayer (the session runner) and KanaTrainer (the side trail) —
 * this page is just the menu: what's due, the two free drills, and the
 * clearly-labelled timed lightning round. */
import { useCallback, useEffect, useState } from 'react'
import { fetchReviewsDue } from '../curriculum/loader'
import type { ReviewsDue } from '../curriculum/types'
import { KanaTrainer } from './KanaTrainer'
import { ReviewPlayer, type ReviewMode } from './ReviewPlayer'

export function PracticePage() {
  const [due, setDue] = useState<ReviewsDue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<ReviewMode | null>(null)

  const refresh = useCallback(() => {
    fetchReviewsDue().then(setDue, (e) => setError(e.message))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const dueToday = due?.counts.today ?? 0

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Practice</h1>
      <p className="mt-1 text-sm text-ink-soft">Reviews, free drills, and the kana side trail.</p>

      {error && <p className="mt-4 text-sm text-ink-soft">{error}</p>}

      {/* due review */}
      <div className="mt-6 rounded-lg border border-line bg-paper-mid p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-medium text-ink">Review</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {due === null
                ? 'Checking what’s due…'
                : dueToday === 0
                  ? 'Nothing due — well kept.'
                  : `Weakest items first — up to ${Math.min(dueToday, 20)} in this session.`}
            </p>
          </div>
          {dueToday > 0 && (
            <span className="shrink-0 rounded-full bg-clay/15 px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-clay">
              {dueToday > 20 ? '20+' : dueToday}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={dueToday === 0}
          onClick={() => setActiveMode('due')}
          className="mt-4 min-h-11 w-full rounded-lg bg-clay px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-clay-deep disabled:opacity-40"
        >
          Start review session
        </button>
      </div>

      {/* free drills */}
      <div className="mt-4 rounded-lg border border-line bg-paper-mid p-6">
        <h2 className="font-display text-base font-medium text-ink">Free drills</h2>
        <p className="mt-1 text-sm text-ink-soft">Practice anything already learned — no pressure, no due date.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveMode('listening-drill')}
            className="min-h-11 rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-oat"
          >
            Listening drill
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('speaking-drill')}
            className="min-h-11 rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-oat"
          >
            Speaking drill
          </button>
        </div>
      </div>

      {/* lightning review — the app's only timed mode */}
      <div className="mt-4 rounded-lg border border-line bg-paper-mid p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-medium text-ink">Lightning review</h2>
          <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
            Timed
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          A fast, 60-second round. The only timed mode in Michi — everywhere else, tempo is
          yours.
        </p>
        <button
          type="button"
          onClick={() => setActiveMode('lightning')}
          className="mt-4 min-h-11 w-full rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-oat"
        >
          Start lightning review
        </button>
      </div>

      {/* kana side trail */}
      <div className="mt-4">
        <KanaTrainer />
      </div>

      {activeMode && (
        <ReviewPlayer
          mode={activeMode}
          onClose={(completed) => {
            setActiveMode(null)
            if (completed) refresh()
          }}
        />
      )}
    </div>
  )
}
