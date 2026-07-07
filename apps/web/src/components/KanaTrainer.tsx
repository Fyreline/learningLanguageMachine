// Kana side-trail trainer (docs/phases/PHASE-4-practice.md §2, docs/
// CURRICULUM.md §1): the hiragana/katakana lessons are already fully
// playable content (kana-glyph steps, hand-authored — engine/session.ts
// plays them verbatim) and never gate the main path (routers/curriculum.py
// `is_kana_lesson`). This component is pure composition: the trail lists
// reuse the manifest's merged kana_trail state and launch the ordinary
// LessonPlayer; the reference grid is a new (and only) bit of UI, backed by
// the Phase-4 item bank endpoint.
import { useEffect, useState } from 'react'
import { fetchAllItems } from '../curriculum/loader'
import type { BankItem } from '../curriculum/types'
import { fetchManifest, type PathManifest } from '../pathData'
import { speak } from '../audio/tts'
import { getSettings } from '../settings'
import { LessonPlayer } from './LessonPlayer'

type KanaTrail = PathManifest['kana_trail']

const TRAIL_LABEL: Record<string, string> = { hiragana: 'Hiragana', katakana: 'Katakana' }

export function KanaTrainer() {
  const [trail, setTrail] = useState<KanaTrail | null>(null)
  const [bank, setBank] = useState<BankItem[] | null>(null)
  const [activeLesson, setActiveLesson] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState<'hiragana' | 'katakana' | null>(null)

  const refresh = () => {
    fetchManifest().then((m) => setTrail(m.kana_trail), () => undefined)
  }

  useEffect(() => {
    refresh()
    fetchAllItems().then(setBank, () => undefined)
  }, [])

  if (!trail) {
    return (
      <div className="rounded-lg border border-line bg-paper-mid p-5 text-center">
        <p className="font-mono text-xs tracking-[0.08em] text-ink-soft">LOADING THE KANA TRAIL…</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-paper-mid p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">Side trail</p>
          <h2 className="font-display text-base font-semibold">
            Kana trainer <span className="font-jp text-clay">かな</span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">Optional — never blocks the main path.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {Object.entries(trail).map(([trailName, lessons]) => (
          <TrailRow
            key={trailName}
            name={TRAIL_LABEL[trailName] ?? trailName}
            lessons={lessons}
            onOpenLesson={setActiveLesson}
            onOpenGrid={
              trailName === 'hiragana' || trailName === 'katakana'
                ? () => setShowGrid(trailName as 'hiragana' | 'katakana')
                : undefined
            }
          />
        ))}
      </div>

      {showGrid && bank && (
        <ReferenceGrid trail={showGrid} items={bank} onClose={() => setShowGrid(null)} />
      )}

      {activeLesson && (
        <LessonPlayer
          lessonId={activeLesson}
          onClose={(completed) => {
            setActiveLesson(null)
            if (completed) {
              refresh()
              fetchAllItems({ fresh: true }).then(setBank, () => undefined)
            }
          }}
        />
      )}
    </div>
  )
}

function TrailRow({
  name,
  lessons,
  onOpenLesson,
  onOpenGrid,
}: {
  name: string
  lessons: { id: string; state: string; stars: number }[]
  onOpenLesson: (id: string) => void
  onOpenGrid?: () => void
}) {
  const done = lessons.filter((l) => l.state === 'done').length
  const next = lessons.find((l) => l.state !== 'done')

  return (
    <div className="rounded-md border border-line bg-paper p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="font-mono text-[11px] tracking-[0.08em] text-ink-soft">
            {done}/{lessons.length} DONE
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenGrid && (
            <button
              type="button"
              onClick={onOpenGrid}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-oat"
            >
              Reference grid
            </button>
          )}
          {next && (
            <button
              type="button"
              onClick={() => onOpenLesson(next.id)}
              className="rounded-lg bg-clay px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-clay-deep"
            >
              {done === 0 ? 'Start' : 'Continue'}
            </button>
          )}
        </div>
      </div>

      {/* stepping-stone row — tap any unlocked one to replay/take it */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lessons.map((l, i) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onOpenLesson(l.id)}
            title={l.id}
            aria-label={`Kana lesson ${i + 1}${l.state === 'done' ? ', done' : ''}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] transition ${
              l.state === 'done'
                ? 'bg-olive text-paper'
                : 'border border-line-strong bg-paper-mid text-ink-soft hover:border-clay'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Tap any kana to hear it" (docs/phases/PHASE-4-practice.md §2). */
function ReferenceGrid({
  trail,
  items,
  onClose,
}: {
  trail: 'hiragana' | 'katakana'
  items: BankItem[]
  onClose: () => void
}) {
  const kana = items.filter((i) => i.unit === trail)
  return (
    <div className="mt-4 rounded-md border border-line bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{TRAIL_LABEL[trail]} reference</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {kana.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => void speak(k.jp, { rate: getSettings().tts_rate })}
            aria-label={`Hear ${k.romaji}`}
            className="flex flex-col items-center gap-0.5 rounded-md border border-line bg-paper-mid p-2 transition hover:border-clay"
          >
            <span lang="ja" className="font-jp text-xl leading-none text-ink">
              {k.jp}
            </span>
            <span className="font-mono text-[10px] text-ink-soft">{k.romaji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
