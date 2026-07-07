// §4.2 listen-pick-jp: English -> 4 Japanese cards (kana, audio on tap).
// Tap selects and plays; Check confirms — so hearing an option is never
// punished. Exact grading.
import { useState } from 'react'
import {
  ChoiceCards,
  JapaneseLine,
  PromptLine,
  useShuffledOnce,
  type ExerciseProps,
} from './shared'

export function ListenPickJp({ item, options, locked, onResult }: ExerciseProps) {
  const shuffledOptions = useShuffledOnce(options)
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    <div>
      <PromptLine>How would you say it in Japanese</PromptLine>
      <p className="mb-8 text-center font-serif text-2xl text-ink">“{item.en}”</p>
      <ChoiceCards
        confirm="explicit"
        choices={shuffledOptions.map((o) => ({
          key: o.id,
          speakText: o.jp,
          label: <JapaneseLine jp={o.jp} furigana={o.furigana} size="md" showRomaji={false} />,
        }))}
        locked={locked}
        correctKey={item.id}
        chosenKey={chosen}
        onChoose={(key) => {
          setChosen(key)
          const picked = shuffledOptions.find((o) => o.id === key)
          onResult({
            verdict: key === item.id ? 'pass' : 'miss',
            given: picked?.jp,
            mode: 'listen-pick-jp',
          })
        }}
      />
    </div>
  )
}
