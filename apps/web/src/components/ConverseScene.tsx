/** The speaking corner — a mic-only freeform chat with a character played
 * by Claude (docs/HANDOFF.md post-launch ops). Deliberately unlike every
 * exercise: no grading, no SRS writes, no score screen. You talk, they
 * answer, and when the scene winds down you just leave — the transcript is
 * never stored anywhere (the API is stateless; closing this component IS
 * deleting the conversation).
 *
 * Mic-only by design (the household asked): there is no text input. On
 * devices without SpeechRecognition, or with the "always shadow" setting,
 * this shows a kind explanation instead of a dead microphone. */
import { useEffect, useRef, useState } from 'react'
import { detectSttCapability } from '../audio/stt'
import { useHoldToSpeak } from '../audio/useHoldToSpeak'
import { speak } from '../audio/tts'
import { converseTurn, fetchScenes, type ConverseTurn } from '../converse'
import { getSettings, useSettings } from '../settings'
import { speakerFor, SpeakerAvatar } from './SpeakerAvatar'

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="34" height="34">
      <rect x="9" y="4" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6.5 12a5.5 5.5 0 0 0 11 0M12 17.5V20.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="32" height="32" className="motion-safe:animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

interface Line extends ConverseTurn {
  romaji?: string
  en?: string
}

export function ConverseScene({ onClose }: { onClose: () => void }) {
  const [scenes, setScenes] = useState<{ id: string; title: string }[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchScenes().then(
      (s) => {
        setScenes(s.scenes)
        setConfigured(s.configured)
      },
      (e) => setError(e.message),
    )
  }, [])

  const canListen = getSettings().stt_mode !== 'shadow' && detectSttCapability()

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper text-ink">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-medium">The speaking corner</h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-ink-mid transition hover:bg-oat"
          >
            Leave
          </button>
        </div>

        {error && <p className="mt-8 text-sm text-ink-soft">{error}</p>}

        {!canListen ? (
          <p className="mt-10 text-center font-serif text-lg leading-relaxed text-ink">
            The speaking corner needs a microphone.
            <br />
            <span className="text-sm text-ink-soft">
              This device can't listen (or speaking is set to shadow mode in Settings) — the
              rest of Michi is unaffected.
            </span>
          </p>
        ) : !configured ? (
          <p className="mt-10 text-center font-serif text-lg leading-relaxed text-ink">
            Not quite set up yet.
            <br />
            <span className="text-sm text-ink-soft">
              Conversation practice needs an API key on the household server — see
              apps/server/.env.
            </span>
          </p>
        ) : sceneId === null ? (
          <div className="mt-8">
            <p className="text-sm text-ink-soft">
              Pick a scene, then just talk — hold the mic and speak Japanese. Nothing is graded
              and nothing is saved; it's practice for the real thing.
            </p>
            <div className="mt-4 grid gap-3">
              {(scenes ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSceneId(s.id)}
                  className="rounded-lg border border-line bg-paper-mid px-4 py-4 text-left font-display text-base font-medium transition hover:border-line-strong"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Conversation sceneId={sceneId} onLeave={onClose} />
        )}
      </div>
    </div>
  )
}

function Conversation({ sceneId, onLeave }: { sceneId: string; onLeave: () => void }) {
  const [lines, setLines] = useState<Line[]>([])
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { tts_rate, romaji } = useSettings()
  const endRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  // One recurring face for this scene's character, same trick as lessons.
  const npcFace = speakerFor(sceneId)

  async function npcTurn(turns: ConverseTurn[]) {
    setWaiting(true)
    setError(null)
    try {
      const reply = await converseTurn(sceneId, turns)
      setLines((l) => [...l, { role: 'npc', jp: reply.jp, romaji: reply.romaji, en: reply.en }])
      void speak(reply.jp, { rate: tts_rate })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'They seem to have stepped away')
    } finally {
      setWaiting(false)
    }
  }

  useEffect(() => {
    // Opening line — once, even under StrictMode's double-mount.
    if (startedRef.current) return
    startedRef.current = true
    void npcTurn([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lines.length, waiting])

  function settle(heard: string) {
    if (!heard || waiting) return
    const next: Line[] = [...lines, { role: 'you', jp: heard }]
    setLines(next)
    void npcTurn(next.map(({ role, jp }) => ({ role, jp })))
  }

  const { listening, processing, transcript, start, stop } = useHoldToSpeak(settle, waiting)

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-6 flex-1 space-y-4" aria-live="polite">
        {lines.map((line, i) =>
          line.role === 'npc' ? (
            <div key={i} className="flex items-end gap-2.5">
              <SpeakerAvatar spec={npcFace} width={40} height={40} className="shrink-0" />
              <button
                type="button"
                onClick={() => void speak(line.jp, { rate: tts_rate })}
                className="max-w-[80%] rounded-2xl rounded-bl-sm border border-line bg-paper-mid px-4 py-3 text-left transition hover:border-line-strong"
                title="Tap to hear it again"
              >
                <span lang="ja" className="font-jp text-lg leading-relaxed">
                  {line.jp}
                </span>
                {romaji === 'show' && line.romaji && (
                  <span className="mt-0.5 block text-xs italic text-ink-soft">{line.romaji}</span>
                )}
                {line.en && <span className="mt-1 block text-xs text-ink-mid">{line.en}</span>}
              </button>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <p
                lang="ja"
                className="max-w-[80%] rounded-2xl rounded-br-sm bg-clay/15 px-4 py-3 font-jp text-lg leading-relaxed text-ink"
              >
                {line.jp}
              </p>
            </div>
          ),
        )}
        {waiting && (
          <div className="flex items-center gap-2.5 text-ink-soft">
            <SpeakerAvatar spec={npcFace} width={40} height={40} className="shrink-0" />
            <span className="font-mono text-[11px] tracking-[0.08em]">…</span>
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-ink-soft">
            {error}{' '}
            <button
              type="button"
              onClick={() => {
                const turns = lines.map(({ role, jp }) => ({ role, jp }))
                void npcTurn(turns)
              }}
              className="underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              Try again
            </button>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-col items-center gap-2.5 border-t border-line bg-paper pb-2 pt-4">
        <button
          type="button"
          disabled={waiting || processing}
          onPointerDown={start}
          onPointerUp={stop}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              listening ? stop() : start()
            }
          }}
          aria-label={processing ? 'Processing' : listening ? 'Stop listening' : 'Hold to talk'}
          className={`inline-flex h-[76px] w-[76px] items-center justify-center rounded-full text-paper transition active:scale-95 disabled:opacity-40 ${
            processing ? 'bg-clay' : listening ? 'animate-pulse bg-clay motion-reduce:animate-none' : 'bg-ink'
          }`}
        >
          {processing ? <SpinnerGlyph /> : <MicGlyph />}
        </button>
        <p className="text-xs text-ink-soft" aria-live="polite">
          {waiting
            ? 'They’re thinking…'
            : processing
              ? 'One moment…'
              : listening
                ? 'Listening — release when done'
                : 'Hold to talk, or press space'}
        </p>
        {transcript && (
          <p lang="ja" className="font-jp text-lg text-ink" aria-live="polite">
            {transcript}
          </p>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="text-xs text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          That's enough for today
        </button>
      </div>
    </div>
  )
}
