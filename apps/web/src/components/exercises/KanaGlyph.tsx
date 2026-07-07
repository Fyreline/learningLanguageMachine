// §4.8 kana-glyph (kana trail only): glyph -> 4 sounds, or sound -> 4 glyphs.
// Direction is chosen per mount; grading exact.
import { useMemo, useState } from 'react'
import { speak } from '../../audio/tts'
import { getSettings } from '../../settings'
import { AudioStage, ChoiceCards, PromptLine, useShuffledOnce, type ExerciseProps } from './shared'

export function KanaGlyph({ item, options, locked, onResult }: ExerciseProps) {
  const direction = useMemo<'glyph-to-sound' | 'sound-to-glyph'>(
    () => (Math.random() < 0.5 ? 'glyph-to-sound' : 'sound-to-glyph'),
    [],
  )
  const shuffledOptions = useShuffledOnce(options)
  const [chosen, setChosen] = useState<string | null>(null)

  function choose(key: string) {
    setChosen(key)
    const picked = shuffledOptions.find((o) => o.id === key)
    onResult({
      verdict: key === item.id ? 'pass' : 'miss',
      given: direction === 'glyph-to-sound' ? picked?.romaji : picked?.jp,
      mode: 'kana-glyph',
    })
  }

  if (direction === 'glyph-to-sound') {
    return (
      <div>
        <PromptLine>Which sound is this</PromptLine>
        <p lang="ja" className="mb-8 text-center font-jp text-[64px] leading-none text-ink">
          {item.jp}
        </p>
        <ChoiceCards
          choices={shuffledOptions.map((o) => ({
            key: o.id,
            label: <span className="font-sans text-lg">{o.romaji}</span>,
          }))}
          locked={locked}
          correctKey={item.id}
          chosenKey={chosen}
          onChoose={choose}
        />
      </div>
    )
  }

  return (
    <div>
      <PromptLine>Listen — which kana is it</PromptLine>
      <AudioStage text={item.jp} />
      <div className="mt-8">
        <ChoiceCards
          choices={shuffledOptions.map((o) => ({
            key: o.id,
            speakText: undefined,
            label: (
              <span lang="ja" className="block text-center font-jp text-[34px] leading-none">
                {o.jp}
              </span>
            ),
          }))}
          locked={locked}
          correctKey={item.id}
          chosenKey={chosen}
          onChoose={(key) => {
            const picked = shuffledOptions.find((o) => o.id === key)
            if (picked) void speak(picked.jp, { rate: getSettings().tts_rate })
            choose(key)
          }}
        />
      </div>
    </div>
  )
}
