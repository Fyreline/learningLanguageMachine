/** Home tab: fetches the progress-merged course manifest and renders the
 * PathScene (docs/DESIGN.md §5), with the kana side-trail as a card by the
 * front door. Lesson taps hand off to the lesson player once phase 3 lands —
 * until then, a quiet toast-line explains. `?mock` shows a dressed preview. */

import { useEffect, useState } from 'react'
import { fetchManifest, isMockMode, type PathManifest } from '../pathData'
import { PathScene } from './PathScene'

export function PathPage() {
  const [manifest, setManifest] = useState<PathManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    fetchManifest().then(setManifest, (e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

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

  return (
    <div className="relative">
      {isMockMode() && (
        <p className="mb-4 text-center">
          <span className="rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
            PREVIEW DATA — remove ?mock for your real path
          </span>
        </p>
      )}

      <PathScene
        manifest={manifest}
        onSelectLesson={(id, state) =>
          setNotice(
            state === 'done'
              ? 'Replay practice arrives with the lesson player (phase 3).'
              : `“${id}” opens once the lesson player lands (phase 3).`,
          )
        }
      />

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
          <span className="shrink-0 rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
            {kanaDone}/{kanaTotal}
          </span>
        </div>
      </div>

      {notice && (
        <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-sm text-paper shadow-float sm:bottom-6">
          {notice}
        </div>
      )}
    </div>
  )
}
