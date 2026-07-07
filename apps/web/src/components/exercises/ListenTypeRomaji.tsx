// §4.5 listen-type-romaji: audio only -> type what you heard, in romaji.
// Macron-optional normalized compare; Levenshtein <= 1 = close.
import { useState } from 'react'
import { gradeRomaji } from '../../engine/grading'
import { AudioStage, PromptLine, type ExerciseProps } from './shared'

export function ListenTypeRomaji({ item, locked, onResult }: ExerciseProps) {
  const [typed, setTyped] = useState('')

  function check() {
    if (locked || !typed.trim()) return
    onResult({
      verdict: gradeRomaji(item.romaji, typed),
      given: typed.trim(),
      mode: 'listen-type-romaji',
    })
  }

  return (
    <div>
      <PromptLine>Listen, then type what you heard — in romaji</PromptLine>
      <AudioStage text={item.jp} />
      <div className="mt-8">
        <label htmlFor="romaji-input" className="sr-only">
          What you heard, in romaji
        </label>
        <input
          id="romaji-input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={locked}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              check()
            }
          }}
          placeholder="e.g. sumimasen"
          className="w-full rounded-lg border border-line bg-paper px-4 py-3 text-center font-sans text-lg text-ink outline-none transition focus:border-clay focus:ring-1 focus:ring-clay"
        />
        <p className="mt-2 text-center text-xs text-ink-soft">
          Long vowels are forgiving — ou, ō and o all count.
        </p>
        <button
          type="button"
          disabled={locked || !typed.trim()}
          onClick={check}
          className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          Check
        </button>
      </div>
    </div>
  )
}
