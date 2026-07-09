/** Home tab: fetches the progress-merged course manifest and renders the
 * PathScene (docs/DESIGN.md §5), with the kana side-trail as a card by the
 * front door. Lesson taps launch the LessonPlayer as a full-screen takeover;
 * completing one refreshes the path. `?mock` shows a dressed preview and
 * `?lesson=u01.l1` force-opens a lesson (dev route). */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { fetchManifest, isMockMode, type PathManifest } from '../pathData'
import { LessonPlayer } from './LessonPlayer'
import { PathScene } from './PathScene'

// The experimental 3D mountain (household ask, 2026-07-09) — lazy so the
// three.js chunk (~150KB gz) downloads only if the toggle is ever switched on.
const PathScene3D = lazy(() =>
  import('./PathScene3D').then((m) => ({ default: m.PathScene3D })),
)

export function PathPage() {
  const [manifest, setManifest] = useState<PathManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeLesson, setActiveLesson] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('lesson'),
  )
  const [threeD, setThreeD] = useState(() => localStorage.getItem('michi-path-3d') === '1')

  const refresh = useCallback(() => {
    fetchManifest().then(setManifest, (e) => setError(e.message))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (error) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <p className="font-serif text-xl text-ink">The path is mist right now.</p>
        <p className="mt-2 text-sm text-ink-soft">{error}</p>
      </div>
    )
  }
  if (!manifest) {
    return <div className="pt-16 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">LAYING THE STONES…</div>
  }

  const kana = manifest.kana_trail
  const kanaDone = Object.values(kana).flat().filter((l) => l.state === 'done').length
  const kanaTotal = Object.values(kana).flat().length
  const nextKana = Object.values(kana)
    .flat()
    .find((l) => l.state !== 'done')

  return (
    <div className="relative">
      {isMockMode() && (
        <p className="mb-4 text-center">
          <span className="rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
            PREVIEW DATA — remove ?mock for your real path
          </span>
        </p>
      )}

      <div className="mb-3 flex justify-center">
        <button
          type="button"
          aria-pressed={threeD}
          onClick={() => {
            const next = !threeD
            setThreeD(next)
            localStorage.setItem('michi-path-3d', next ? '1' : '0')
          }}
          className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.08em] transition ${
            threeD
              ? 'border-clay bg-clay/15 text-clay'
              : 'border-line-strong text-ink-soft hover:bg-oat'
          }`}
        >
          3D · EXPERIMENTAL
        </button>
      </div>

      {threeD ? (
        <Suspense
          fallback={
            <div className="py-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">
              RAISING THE MOUNTAIN…
            </div>
          }
        >
          <PathScene3D
            manifest={manifest}
            onSelectLesson={(id, state) => {
              if (state === 'locked') return
              setActiveLesson(id)
            }}
          />
        </Suspense>
      ) : (
        <PathScene
          manifest={manifest}
          onSelectLesson={(id, state) => {
            if (state === 'locked') return
            setActiveLesson(id)
          }}
        />
      )}

      {/* kana side-trail — a spur by the front door (CURRICULUM §1) */}
      <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-paper-mid p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">Side trail</p>
            <h2 className="font-display text-base font-semibold">
              Kana <span className="font-jp text-clay">かな</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Optional — recognising the symbols. Never blocks the main path.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
              {kanaDone}/{kanaTotal}
            </span>
            {nextKana && (
              <button
                type="button"
                onClick={() => setActiveLesson(nextKana.id)}
                className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-oat"
              >
                Next kana lesson
              </button>
            )}
          </div>
        </div>
      </div>

      {activeLesson && (
        <LessonPlayer
          lessonId={activeLesson}
          onClose={(completed) => {
            setActiveLesson(null)
            if (completed) refresh()
          }}
        />
      )}
    </div>
  )
}
