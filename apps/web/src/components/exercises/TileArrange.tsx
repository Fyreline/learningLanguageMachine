// §4.3 tile-arrange: audio + English -> arrange kana tiles into the sentence.
// Order-exact = pass; particle slips are close (shown, not failed).
// Tap-to-place with keyboard support: 1-9 places the nth remaining tile,
// Backspace withdraws the last placed one.
import { useEffect, useMemo, useState } from 'react'
import { gradeTiles, shuffled, tilesFor } from '../../engine/grading'
import { AudioStage, PromptLine, type ExerciseProps } from './shared'

export function TileArrange({ item, locked, onResult }: ExerciseProps) {
  const answer = useMemo(() => tilesFor(item.jp), [item.jp])
  // tiles carry an index so duplicated words stay distinct
  const bank = useMemo(
    () => shuffled(answer.map((text, i) => ({ id: i, text }))),
    [answer],
  )
  const [placed, setPlaced] = useState<{ id: number; text: string }[]>([])
  const remaining = bank.filter((t) => !placed.some((p) => p.id === t.id))

  function place(tile: { id: number; text: string }) {
    if (locked) return
    setPlaced((p) => [...p, tile])
  }
  function withdraw(id: number) {
    if (locked) return
    setPlaced((p) => p.filter((t) => t.id !== id))
  }
  function check() {
    if (locked || placed.length !== answer.length) return
    const verdict = gradeTiles(answer, placed.map((t) => t.text))
    onResult({ verdict, given: placed.map((t) => t.text).join(' '), mode: 'tile-arrange' })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return
      const n = Number(e.key)
      if (n >= 1 && n <= remaining.length) {
        e.preventDefault()
        place(remaining[n - 1])
      } else if (e.key === 'Backspace' && placed.length > 0) {
        e.preventDefault()
        withdraw(placed[placed.length - 1].id)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        check()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div>
      <PromptLine>Arrange the tiles to say it</PromptLine>
      <AudioStage text={item.jp} />
      <p className="my-6 text-center font-serif text-xl text-ink">“{item.en}”</p>

      {/* the dashed answer row */}
      <div
        aria-label="Your answer, in order"
        className="mb-6 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong p-3"
      >
        {placed.length === 0 && (
          <span className="text-sm text-ink-soft">Tap the tiles below, in order</span>
        )}
        {placed.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={locked}
            onClick={() => withdraw(t.id)}
            aria-label={`Remove ${t.text}`}
            className="rounded-md border border-clay bg-paper-mid px-3 py-2 font-jp text-[21px] leading-[1.4] text-ink transition hover:border-clay-deep"
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* the tile bank */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {remaining.map((t, i) => (
          <button
            key={t.id}
            type="button"
            disabled={locked}
            onClick={() => place(t)}
            className="rounded-md border border-line bg-paper-mid px-3 py-2 font-jp text-[21px] leading-[1.4] text-ink transition hover:border-line-strong"
          >
            <span className="mr-1.5 font-mono text-[10px] text-ink-soft">{i + 1}</span>
            {t.text}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={locked || placed.length !== answer.length}
        onClick={check}
        className="mt-6 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:opacity-40"
      >
        Check
      </button>
    </div>
  )
}
