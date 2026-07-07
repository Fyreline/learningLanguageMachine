// §4.6 match-pairs: 5 audio/kana chips ⇄ 5 English chips. Per-pair
// first-attempt correctness feeds each item's stats; the step completes when
// every pair is matched.
import { useMemo, useState } from 'react'
import type { Item } from '../../curriculum/types'
import { speak } from '../../audio/tts'
import { shuffled } from '../../engine/grading'
import { getSettings } from '../../settings'
import { PromptLine } from './shared'

export interface MatchPairsProps {
  items: Item[]
  locked: boolean
  onComplete: (perItem: { itemId: string; correct: boolean }[]) => void
}

export function MatchPairs({ items, locked, onComplete }: MatchPairsProps) {
  const left = useMemo(() => shuffled(items), [items])
  const right = useMemo(() => shuffled(items), [items])
  const [pickedJp, setPickedJp] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [missed, setMissed] = useState<Set<string>>(new Set()) // wrong at least once
  const [flash, setFlash] = useState<string | null>(null) // brief fig flash on the en side

  function tapJp(item: Item) {
    if (locked || matched.has(item.id)) return
    void speak(item.jp, { rate: getSettings().tts_rate })
    setPickedJp(item.id)
  }

  function tapEn(item: Item) {
    if (locked || matched.has(item.id) || !pickedJp) return
    if (item.id === pickedJp) {
      const next = new Set(matched)
      next.add(item.id)
      setMatched(next)
      setPickedJp(null)
      if (next.size === items.length) {
        onComplete(items.map((i) => ({ itemId: i.id, correct: !missed.has(i.id) })))
      }
    } else {
      // the mismatch marks BOTH ends as fumbled — that pairing was wrong
      setMissed((m) => new Set(m).add(pickedJp).add(item.id))
      setFlash(item.id)
      setTimeout(() => setFlash(null), 350)
      setPickedJp(null)
    }
  }

  const chip = (active: boolean, done: boolean, wrongFlash = false) =>
    `w-full rounded-lg border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay ${
      done
        ? 'border-olive bg-olive/15 text-ink-soft'
        : wrongFlash
          ? 'border-fig bg-fig/10'
          : active
            ? 'border-clay ring-1 ring-clay bg-paper-mid'
            : 'border-line bg-paper-mid hover:border-line-strong'
    }`

  return (
    <div>
      <PromptLine>Match the pairs — tap a Japanese chip to hear it</PromptLine>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {left.map((i) => (
            <button
              key={i.id}
              type="button"
              disabled={locked || matched.has(i.id)}
              onClick={() => tapJp(i)}
              className={chip(pickedJp === i.id, matched.has(i.id))}
            >
              <span lang="ja" className="font-jp text-[20px] leading-[1.4]">
                {i.jp}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {right.map((i) => (
            <button
              key={i.id}
              type="button"
              disabled={locked || matched.has(i.id)}
              onClick={() => tapEn(i)}
              className={chip(false, matched.has(i.id), flash === i.id)}
            >
              <span className="text-sm">{i.en}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
