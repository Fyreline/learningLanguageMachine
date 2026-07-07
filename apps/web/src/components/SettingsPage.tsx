import { useEffect, useState } from 'react'
import { detectSttCapability } from '../audio/stt'
import { detectTtsCapability, speak } from '../audio/tts'

type VoiceState = 'idle' | 'speaking' | 'done' | 'error'

/** Settings stub (docs/phases/PHASE-1-scaffold.md) — proves ja-JP TTS works
 * end to end via a "test voice" button, and surfaces STT/TTS capability
 * detection ahead of the real settings UI (romaji, tts rate, daily goal,
 * trip date — docs/DATA_MODEL.md) landing in a later phase. */
export function SettingsPage() {
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null)
  const [jaVoiceCount, setJaVoiceCount] = useState(0)
  const [sttSupported, setSttSupported] = useState<boolean | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')

  useEffect(() => {
    detectTtsCapability().then((cap) => {
      setTtsSupported(cap.supported)
      setJaVoiceCount(cap.jaVoices.length)
    })
    setSttSupported(detectSttCapability())
  }, [])

  async function handleTestVoice() {
    setVoiceState('speaking')
    try {
      await speak('こんにちは、ミチです')
      setVoiceState('done')
    } catch {
      setVoiceState('error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Romaji display, daily goal, and trip countdown land here in a later phase. For now: a
        check that Michi can actually speak.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-paper-mid p-6">
        <h2 className="font-display text-base font-medium text-ink">Voice</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Michi speaks Japanese entirely in your browser — nothing is recorded or sent anywhere.
        </p>

        <dl className="mt-4 space-y-1.5 font-mono text-xs text-ink-mid">
          <div className="flex items-center gap-2">
            <dt className="tracking-[0.08em] text-ink-soft">TTS</dt>
            <dd>
              {ttsSupported === null
                ? 'checking…'
                : ttsSupported
                  ? `supported · ${jaVoiceCount} ja-JP voice${jaVoiceCount === 1 ? '' : 's'} found`
                  : 'not supported in this browser'}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="tracking-[0.08em] text-ink-soft">STT</dt>
            <dd>
              {sttSupported === null
                ? 'checking…'
                : sttSupported
                  ? 'supported'
                  : 'not supported — speaking exercises will use shadow-mode'}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={handleTestVoice}
          disabled={ttsSupported === false || voiceState === 'speaking'}
          className="mt-5 min-h-11 rounded-md bg-clay px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-clay-deep disabled:opacity-50"
        >
          {voiceState === 'speaking' ? 'Speaking…' : 'Test voice'}
        </button>

        {voiceState === 'done' && (
          <p className="mt-3 text-sm text-olive">That's the voice Michi will use throughout.</p>
        )}
        {voiceState === 'error' && (
          <p className="mt-3 text-sm text-fig">Couldn't play audio just then — try again.</p>
        )}
      </div>
    </div>
  )
}
