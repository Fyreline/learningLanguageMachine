// §4.4 speak: kana + audio -> hold-to-talk, say it. Speech similarity per
// §4.8 (pass >= 0.75, close 0.55-0.75 with one free retry). On devices
// without SpeechRecognition (Safari/Firefox/no-mic) this silently becomes
// shadow mode: listen, say it aloud, reveal, self-grade — never a dead end.
import { useEffect, useRef, useState } from 'react'
import { detectSttCapability, startListening, type SttSession } from '../../audio/stt'
import { gradeSpeech } from '../../engine/grading'
import { getSettings } from '../../settings'
import { AudioStage, JapaneseLine, PromptLine, type ExerciseProps, type Verdict } from './shared'

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="34" height="34">
      <rect x="9" y="4" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6.5 12a5.5 5.5 0 0 0 11 0M12 17.5V20.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function Speak({ item, locked, onResult }: ExerciseProps) {
  // Settings: STT mode "shadow" forces the ungraded listen-and-repeat flow
  // even on capable devices — an override for anyone who finds the mic
  // fiddly rather than helpful (docs/phases/PHASE-4-practice.md §4).
  const canListen = getSettings().stt_mode !== 'shadow' && detectSttCapability()
  return canListen ? (
    <MicMode item={item} locked={locked} onResult={onResult} />
  ) : (
    <ShadowMode item={item} locked={locked} onResult={onResult} />
  )
}

function MicMode({ item, locked, onResult }: Pick<ExerciseProps, 'item' | 'locked' | 'onResult'>) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [retried, setRetried] = useState(false)
  const [closeOnce, setCloseOnce] = useState<string | null>(null)
  const sessionRef = useRef<SttSession | null>(null)
  const finalRef = useRef('')

  useEffect(() => () => sessionRef.current?.stop(), [])

  function start() {
    if (locked || listening) return
    finalRef.current = ''
    setTranscript('')
    const session = startListening(
      (r) => {
        setTranscript(r.transcript)
        if (r.isFinal) finalRef.current = r.transcript
      },
      () => {
        setListening(false)
        settle()
      },
    )
    if (!session) return
    sessionRef.current = session
    setListening(true)
  }

  function stop() {
    sessionRef.current?.stop()
  }

  function settle() {
    const heard = finalRef.current || transcript
    if (!heard) return
    const { verdict } = gradeSpeech(item.jp, heard)
    if (verdict === 'close' && !retried) {
      // one free retry (§4.4) — surface the near-miss, keep the mic open
      setRetried(true)
      setCloseOnce(heard)
      return
    }
    onResult({ verdict, given: heard, mode: 'speak' })
  }

  return (
    <div>
      <PromptLine>Say it aloud</PromptLine>
      <div className="mb-6">
        <JapaneseLine jp={item.jp} furigana={item.furigana} romaji={item.romaji} strength={item.strength} />
      </div>
      <AudioStage text={item.jp} size="sm" />
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={locked}
          onPointerDown={start}
          onPointerUp={stop}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              listening ? stop() : start()
            }
          }}
          aria-label={listening ? 'Stop listening' : 'Hold to talk'}
          className={`inline-flex h-[88px] w-[88px] items-center justify-center rounded-full text-paper transition active:scale-95 ${
            listening ? 'animate-pulse bg-clay motion-reduce:animate-none' : 'bg-ink'
          }`}
        >
          <MicGlyph />
        </button>
        <p className="text-xs text-ink-soft">
          {listening ? 'Listening — release when done' : 'Hold to talk, or press space'}
        </p>
        {transcript && (
          <p lang="ja" className="font-jp text-xl text-ink" aria-live="polite">
            {transcript}
          </p>
        )}
        {closeOnce && !locked && (
          <p className="rounded-md bg-kraft/20 px-3 py-1.5 text-sm text-ink-mid" aria-live="polite">
            Close — one more try? We heard “{closeOnce}”.
          </p>
        )}
      </div>
    </div>
  )
}

/** Shadow mode (§4.8): hear it, say it aloud, reveal, self-grade. */
function ShadowMode({ item, locked, onResult }: Pick<ExerciseProps, 'item' | 'locked' | 'onResult'>) {
  const [revealed, setRevealed] = useState(false)

  function selfGrade(verdict: Verdict) {
    onResult({ verdict, mode: 'speak-shadow' })
  }

  return (
    <div>
      <PromptLine>Listen, then say it aloud yourself</PromptLine>
      <AudioStage text={item.jp} />
      <div className="my-6">
        <JapaneseLine
          jp={item.jp}
          furigana={item.furigana}
          romaji={revealed ? item.romaji : undefined}
          strength={item.strength}
        />
      </div>
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:opacity-90"
        >
          I said it — how did it go?
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={locked}
            onClick={() => selfGrade('pass')}
            className="rounded-lg border border-olive bg-olive/15 px-3 py-3 text-sm font-medium text-ink transition hover:bg-olive/25"
          >
            Nailed it
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => selfGrade('close')}
            className="rounded-lg border border-line bg-kraft/20 px-3 py-3 text-sm font-medium text-ink transition hover:bg-kraft/30"
          >
            Roughly
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => selfGrade('miss')}
            className="rounded-lg border border-line bg-paper-mid px-3 py-3 text-sm font-medium text-ink-mid transition hover:border-line-strong"
          >
            Not really
          </button>
        </div>
      )}
    </div>
  )
}
