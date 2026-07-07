// Shared exercise chrome (docs/DESIGN.md §4): the audio + turtle buttons,
// Japanese typography, choice cards, and the one result contract every
// exercise reports through.

import { useEffect, useRef, useState } from 'react'
import type { Item } from '../../curriculum/types'
import { speak, subscribeSpeaking } from '../../audio/tts'

export type Verdict = 'pass' | 'close' | 'miss'

export interface ExerciseResult {
  verdict: Verdict
  /** what the learner offered — the feedback strip shows it on close/miss */
  given?: string
  mode: string
}

export interface ExerciseProps {
  item: Item
  /** the full option set for pick-style exercises (item included, unshuffled) */
  options: Item[]
  /** answered — inputs freeze until the learner continues */
  locked: boolean
  onResult: (result: ExerciseResult) => void
}

/* ------------------------------- audio ---------------------------------- */

const TURTLE_RATE = 0.65

function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="34" height="34">
      <path
        d="M4 9.5v5h3.4l4.1 3.6V5.9L7.4 9.5H4Z"
        fill="currentColor"
      />
      <path
        d="M14.5 8.6a4.4 4.4 0 0 1 0 6.8M16.8 6.2a7.6 7.6 0 0 1 0 11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TurtleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="22" height="22">
      <ellipse cx="11" cy="12" rx="6" ry="4.4" fill="currentColor" />
      <circle cx="18.2" cy="10.6" r="1.9" fill="currentColor" />
      <path d="M5.5 15.5l-1.3 2M9.5 16.5l-.4 2M13 16.3l.6 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** The 88px clay audio circle + 44px turtle replay (docs/DESIGN.md §4.3).
 * Auto-plays once on mount (never re-steals focus); a ring pulses while TTS
 * speaks. Turtle replays at 0.65. */
export function AudioStage({ text, autoPlay = true, size = 'lg' }: { text: string; autoPlay?: boolean; size?: 'lg' | 'sm' }) {
  const [speaking, setSpeaking] = useState(false)
  const played = useRef(false)

  useEffect(() => subscribeSpeaking(setSpeaking), [])
  useEffect(() => {
    if (autoPlay && !played.current) {
      played.current = true
      void speak(text)
    }
  }, [autoPlay, text])

  const big = size === 'lg'
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="relative inline-flex">
        {speaking && (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-clay/25 motion-reduce:hidden"
            style={{ animationDuration: '1s' }}
          />
        )}
        <button
          type="button"
          onClick={() => void speak(text)}
          aria-label="Play the Japanese audio"
          className={`relative inline-flex items-center justify-center rounded-full bg-clay text-paper transition active:scale-95 ${
            big ? 'h-[88px] w-[88px]' : 'h-12 w-12'
          }`}
        >
          <SpeakerGlyph />
        </button>
      </span>
      <button
        type="button"
        onClick={() => void speak(text, { rate: TURTLE_RATE })}
        aria-label="Replay slowly"
        title="Replay slowly"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper-mid text-ink-mid transition hover:border-line-strong active:scale-95"
      >
        <TurtleGlyph />
      </button>
    </div>
  )
}

/** Small inline replay pair for the feedback strip ("listen again"). */
export function InlineReplay({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void speak(text)}
        className="underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        listen again
      </button>
      <button
        type="button"
        onClick={() => void speak(text, { rate: TURTLE_RATE })}
        aria-label="Replay slowly"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-ink-mid"
      >
        <svg viewBox="0 0 24 24" aria-hidden width="14" height="14">
          <ellipse cx="11" cy="12" rx="6" ry="4.4" fill="currentColor" />
          <circle cx="18.2" cy="10.6" r="1.9" fill="currentColor" />
        </svg>
      </button>
    </span>
  )
}

/* --------------------------- Japanese text ------------------------------- */

/** Kana/kanji line per docs/DESIGN.md §2: font-jp, larger than UI text,
 * real <ruby> furigana when the item has kanji, romaji italic below. */
export function JapaneseLine({
  jp,
  furigana,
  romaji,
  size = 'lg',
  showRomaji = true,
}: {
  jp: string
  furigana?: string
  romaji?: string
  size?: 'lg' | 'md'
  showRomaji?: boolean
}) {
  const jpClass = size === 'lg' ? 'text-[34px]' : 'text-[22px]'
  return (
    <div className="text-center">
      <p lang="ja" className={`font-jp ${jpClass} leading-[1.4] text-ink`}>
        {furigana ? (
          <ruby>
            {jp}
            <rt className="text-[50%] text-ink-soft">{furigana}</rt>
          </ruby>
        ) : (
          jp
        )}
      </p>
      {showRomaji && romaji && (
        <p className="mt-1 font-sans text-sm italic text-ink-soft">{romaji}</p>
      )}
    </div>
  )
}

/* ---------------------------- choice cards ------------------------------- */

export interface Choice {
  key: string
  label: React.ReactNode
  /** spoken when tapped (listen-pick-jp cards play their audio) */
  speakText?: string
}

/** 2x2 answer grid (docs/DESIGN.md §4.4), keyboard-operable: keys 1-4 select,
 * Enter confirms when `confirm` mode is explicit. */
export function ChoiceCards({
  choices,
  locked,
  correctKey,
  chosenKey,
  onChoose,
  confirm = 'immediate',
}: {
  choices: Choice[]
  locked: boolean
  correctKey?: string
  chosenKey?: string | null
  onChoose: (key: string) => void
  confirm?: 'immediate' | 'explicit'
}) {
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return
      const n = Number(e.key)
      if (n >= 1 && n <= choices.length) {
        e.preventDefault()
        handleTap(choices[n - 1].key)
      }
      if (confirm === 'explicit' && e.key === 'Enter' && selected) {
        e.preventDefault()
        onChoose(selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function handleTap(key: string) {
    const choice = choices.find((c) => c.key === key)
    if (choice?.speakText) void speak(choice.speakText)
    if (confirm === 'immediate') {
      onChoose(key)
    } else {
      setSelected(key)
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Answer choices" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((c, i) => {
          const isChosen = chosenKey === c.key || selected === c.key
          const showCorrect = locked && correctKey === c.key
          const showWrong = locked && chosenKey === c.key && correctKey !== c.key
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={locked}
              onClick={() => handleTap(c.key)}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay ${
                showCorrect
                  ? 'border-olive bg-olive/15'
                  : showWrong
                    ? 'border-fig bg-fig/10'
                    : isChosen
                      ? 'border-clay ring-1 ring-clay bg-paper-mid'
                      : 'border-line bg-paper-mid hover:border-line-strong'
              }`}
            >
              <span className="mr-2 font-mono text-[11px] text-ink-soft">{i + 1}</span>
              {c.label}
            </button>
          )
        })}
      </div>
      {confirm === 'explicit' && !locked && (
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onChoose(selected)}
          className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          Check
        </button>
      )}
    </div>
  )
}

/** Deterministic-per-mount shuffled options: the item + up to 3 distractors. */
export function useShuffledOnce<T>(values: T[]): T[] {
  const ref = useRef<T[] | null>(null)
  if (ref.current === null || ref.current.length !== values.length) {
    const arr = [...values]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    ref.current = arr
  }
  return ref.current
}

/** The prompt line above the stage ("Listen, then pick the meaning"). */
export function PromptLine({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 text-center text-sm text-ink-soft">{children}</p>
}
