// §4.1 listen-pick: audio (+kana) -> 4 English meaning cards. Exact grading.
import { useState } from 'react'
import {
  AudioStage,
  ChoiceCards,
  JapaneseLine,
  PromptLine,
  useShuffledOnce,
  type ExerciseProps,
} from './shared'

export function ListenPick({ item, options, locked, onResult }: ExerciseProps) {
  const shuffledOptions = useShuffledOnce(options)
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    <div>
      <PromptLine>Listen, then pick the meaning</PromptLine>
      <AudioStage text={item.jp} />
      <div className="my-6">
        <JapaneseLine jp={item.jp} furigana={item.furigana} />
      </div>
      <ChoiceCards
        choices={shuffledOptions.map((o) => ({ key: o.id, label: <span className="text-base">{o.en}</span> }))}
        locked={locked}
        correctKey={item.id}
        chosenKey={chosen}
        onChoose={(key) => {
          setChosen(key)
          const picked = shuffledOptions.find((o) => o.id === key)
          onResult({
            verdict: key === item.id ? 'pass' : 'miss',
            given: picked?.en,
            mode: 'listen-pick',
          })
        }}
      />
    </div>
  )
}
