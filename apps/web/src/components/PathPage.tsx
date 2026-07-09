/** Home tab: fetches the progress-merged course manifest and renders the
 * mountain — just the scene and the tab bar, nothing else (household ask,
 * 2026-07-09: a clean main page). 3D is the default; Settings offers the
 * 2D scroll for anyone who prefers it (localStorage `michi-path-3d`,
 * per-device like the theme). The kana side-trail card lives on the
 * Practice tab now. Lesson taps launch the LessonPlayer as a full-screen
 * takeover; completing one refreshes the path. `?mock` shows a dressed
 * preview and `?lesson=u01.l1` force-opens a lesson (dev route). */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { fetchManifest, isMockMode, type PathManifest } from '../pathData'
import { LessonPlayer } from './LessonPlayer'
import { PathScene } from './PathScene'

// lazy: the three.js chunk (~240KB gz) loads only when the 3D path renders
const PathScene3D = lazy(() =>
  import('./PathScene3D').then((m) => ({ default: m.PathScene3D })),
)

/** Per-device path style — 3D unless explicitly switched to 2D. */
export function pathIs3D(): boolean {
  return localStorage.getItem('michi-path-3d') !== '0'
}

export function PathPage() {
  const [manifest, setManifest] = useState<PathManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeLesson, setActiveLesson] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('lesson'),
  )
  const threeD = pathIs3D()

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

  return (
    <div className="relative">
      {isMockMode() && (
        <p className="mb-4 text-center">
          <span className="rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
            PREVIEW DATA — remove ?mock for your real path
          </span>
        </p>
      )}

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
