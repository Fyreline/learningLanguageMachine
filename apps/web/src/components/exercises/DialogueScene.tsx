// §4.7 dialogue: a scripted scene with stakes. Partner lines are TTS-spoken
// at 0.85; the learner's turns are pick or speak steps. Per-turn grades flow
// up via onTurnResult; the scene completes when the last turn lands.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dialogue, DialogueTurnNpc, DialogueTurnYou, Item } from '../../curriculum/types'
import { speak } from '../../audio/tts'
import { detectSttCapability, startListening, type SttSession } from '../../audio/stt'
import { gradeSpeech, shuffled } from '../../engine/grading'
import { ChoiceCards, JapaneseLine, type Verdict } from './shared'

const NPC_RATE = 0.85

export interface DialogueSceneProps {
  dialogue: Dialogue
  itemsById: Map<string, Item>
  /** distractor pool for pick turns (same-lesson items) */
  pool: Item[]
  onTurnResult: (itemId: string, verdict: Verdict, mode: string) => void
  onComplete: () => void
}

export function DialogueScene({ dialogue, itemsById, pool, onTurnResult, onComplete }: DialogueSceneProps) {
  const [turnIndex, setTurnIndex] = useState(0)
  const [history, setHistory] = useState<{ speaker: 'npc' | 'you'; jp: string; en: string }[]>([])
  const spokenFor = useRef(-1)

  const turns = dialogue.turns
  const current = turns[turnIndex]
  const done = turnIndex >= turns.length

  // npc turns speak themselves, then hand over
  useEffect(() => {
    if (done || !current || current.speaker !== 'npc') return
    if (spokenFor.current === turnIndex) return
    spokenFor.current = turnIndex
    const npc = current as DialogueTurnNpc
    void speak(npc.jp, { rate: NPC_RATE })
  }, [current, done, turnIndex])

  useEffect(() => {
    if (done) onComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function advanceNpc(npc: DialogueTurnNpc) {
    setHistory((h) => [...h, { speaker: 'npc', jp: npc.jp, en: npc.en }])
    setTurnIndex((i) => i + 1)
  }

  function landYourTurn(item: Item, verdict: Verdict, mode: string) {
    onTurnResult(item.id, verdict, mode)
    setHistory((h) => [...h, { speaker: 'you', jp: item.jp, en: item.en }])
    setTurnIndex((i) => i + 1)
  }

  if (done) {
    return (
      <p className="text-center text-sm text-ink-soft">The scene is over — nicely handled.</p>
    )
  }

  return (
    <div>
      <p className="mb-4 rounded-lg bg-oat px-4 py-3 text-center font-serif text-sm text-ink-mid">
        {dialogue.scene}
      </p>

      {/* what has been said so far */}
      {history.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {history.slice(-4).map((h, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg border border-line px-3 py-2 ${
                h.speaker === 'you' ? 'self-end bg-clay/10' : 'self-start bg-paper-mid'
              }`}
            >
              <p lang="ja" className="font-jp text-base leading-[1.4] text-ink">
                {h.jp}
              </p>
              <p className="text-xs text-ink-soft">{h.en}</p>
            </div>
          ))}
        </div>
      )}

      {current.speaker === 'npc' ? (
        <NpcTurn npc={current as DialogueTurnNpc} onContinue={() => advanceNpc(current as DialogueTurnNpc)} />
      ) : (
        <YourTurn
          key={turnIndex}
          turn={current as DialogueTurnYou}
          itemsById={itemsById}
          pool={pool}
          onLand={landYourTurn}
        />
      )}
    </div>
  )
}

function NpcTurn({ npc, onContinue }: { npc: DialogueTurnNpc; onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center">
        <button
          type="button"
          onClick={() => void speak(npc.jp, { rate: NPC_RATE })}
          aria-label="Hear the line again"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-clay text-paper transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" aria-hidden width="22" height="22">
            <path d="M4 9.5v5h3.4l4.1 3.6V5.9L7.4 9.5H4Z" fill="currentColor" />
            <path d="M14.5 8.6a4.4 4.4 0 0 1 0 6.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <JapaneseLine jp={npc.jp} furigana={npc.furigana} romaji={npc.romaji} size="md" />
      <p className="mt-1 text-sm text-ink-soft">{npc.en}</p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-5 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:opacity-90"
      >
        Continue
      </button>
    </div>
  )
}

function YourTurn({
  turn,
  itemsById,
  pool,
  onLand,
}: {
  turn: DialogueTurnYou
  itemsById: Map<string, Item>
  pool: Item[]
  onLand: (item: Item, verdict: Verdict, mode: string) => void
}) {
  const item = itemsById.get(turn.expect_item)
  const canListen = detectSttCapability()
  const mode: 'pick' | 'speak' = turn.mode === 'speak' && canListen ? 'speak' : 'pick'

  const options = useMemo(() => {
    if (!item) return []
    const others = shuffled(pool.filter((p) => p.id !== item.id)).slice(0, 3)
    return shuffled([item, ...others])
  }, [item, pool])

  const [answered, setAnswered] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)

  if (!item) return null

  if (mode === 'pick') {
    return (
      <div>
        <p className="mb-4 text-center text-sm text-ink-mid">{turn.stakes}</p>
        <ChoiceCards
          confirm="explicit"
          choices={options.map((o) => ({
            key: o.id,
            speakText: o.jp,
            label: <JapaneseLine jp={o.jp} furigana={o.furigana} size="md" showRomaji={false} />,
          }))}
          locked={answered}
          correctKey={item.id}
          chosenKey={chosen}
          onChoose={(key) => {
            setChosen(key)
            setAnswered(true)
            // brief beat so the olive/fig state is visible before moving on
            const verdict: Verdict = key === item.id ? 'pass' : 'miss'
            setTimeout(() => onLand(item, verdict, 'dialogue-pick'), 900)
          }}
        />
      </div>
    )
  }

  return <DialogueSpeak item={item} stakes={turn.stakes} onLand={onLand} />
}

function DialogueSpeak({
  item,
  stakes,
  onLand,
}: {
  item: Item
  stakes: string
  onLand: (item: Item, verdict: Verdict, mode: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [retried, setRetried] = useState(false)
  const sessionRef = useRef<SttSession | null>(null)
  const finalRef = useRef('')

  useEffect(() => () => sessionRef.current?.stop(), [])

  function start() {
    if (listening) return
    finalRef.current = ''
    setTranscript('')
    const session = startListening(
      (r) => {
        setTranscript(r.transcript)
        if (r.isFinal) finalRef.current = r.transcript
      },
      () => {
        setListening(false)
        const heard = finalRef.current
        if (!heard) return
        const { verdict } = gradeSpeech(item.jp, heard)
        if (verdict === 'close' && !retried) {
          setRetried(true)
          return
        }
        onLand(item, verdict, 'dialogue-speak')
      },
    )
    if (!session) return
    sessionRef.current = session
    setListening(true)
  }

  return (
    <div className="text-center">
      <p className="mb-3 text-sm text-ink-mid">{stakes}</p>
      <JapaneseLine jp={item.jp} furigana={item.furigana} romaji={item.romaji} size="md" />
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={() => sessionRef.current?.stop()}
        aria-label={listening ? 'Stop listening' : 'Hold to talk'}
        className={`mt-5 inline-flex h-[72px] w-[72px] items-center justify-center rounded-full text-paper transition active:scale-95 ${
          listening ? 'animate-pulse bg-clay motion-reduce:animate-none' : 'bg-ink'
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden width="28" height="28">
          <rect x="9" y="4" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M6.5 12a5.5 5.5 0 0 0 11 0M12 17.5V20.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {retried && !listening && (
        <p className="mt-3 text-sm text-ink-mid" aria-live="polite">
          Close — one more try?
        </p>
      )}
      {transcript && (
        <p lang="ja" className="mt-3 font-jp text-lg text-ink" aria-live="polite">
          {transcript}
        </p>
      )}
    </div>
  )
}
