// Settings (docs/phases/PHASE-4-practice.md §4, docs/DESIGN.md §1/§3):
// romaji mode, TTS rate, daily goal, trip date, STT override, theme, logout,
// about footer. Persists via PUT /api/auth/settings (settings.ts's
// patchSettings — merge-patch, optimistic local apply) and applies live:
// exercise chrome (shared.tsx) reads the same store directly, so a change
// here is visible in the very next exercise without a reload.
import { useEffect, useState } from 'react'
import { logout } from '../auth'
import { detectSttCapability } from '../audio/stt'
import { detectTtsCapability, speak } from '../audio/tts'
import { getSettings, patchSettings, useSettings } from '../settings'
import type { UserSettings } from '../api'
import { getUser } from '../auth'
import { AnimatedKitsune, PALETTE, type KitsuneTone } from './AnimatedKitsune'
import { pathIs3D } from './PathPage'
import { ThemeToggle } from './ThemeToggle'

type VoiceState = 'idle' | 'speaking' | 'done' | 'error'

const ROMAJI_OPTIONS: { value: NonNullable<UserSettings['romaji']>; label: string }[] = [
  { value: 'show', label: 'Show' },
  { value: 'fade', label: 'Fade after first' },
  { value: 'hide', label: 'Hide' },
]

const KITSUNE_TONES: { value: KitsuneTone; label: string }[] = [
  { value: 'clay', label: 'Crimson' },
  { value: 'sky', label: 'Blue' },
  { value: 'teal', label: 'Teal' },
  { value: 'plum', label: 'Plum' },
  { value: 'cyan', label: 'Cyan' },
]

const STT_OPTIONS: { value: NonNullable<UserSettings['stt_mode']>; label: string }[] = [
  { value: 'auto', label: 'Auto (detected)' },
  { value: 'shadow', label: 'Always shadow mode' },
]

export function SettingsPage() {
  const settings = useSettings()
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null)
  const [jaVoiceCount, setJaVoiceCount] = useState(0)
  const [sttSupported, setSttSupported] = useState<boolean | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [path3D, setPath3D] = useState(pathIs3D)

  useEffect(() => {
    detectTtsCapability().then((cap) => {
      setTtsSupported(cap.supported)
      setJaVoiceCount(cap.jaVoices.length)
    })
    setSttSupported(detectSttCapability())
  }, [])

  // Failures surface via the global SettingsErrorBanner (App.tsx) instead of
  // local state — it survives navigating away, which local state can't (see
  // settings.ts's error channel for why that matters here).
  async function save(patch: UserSettings) {
    try {
      await patchSettings(patch)
    } catch {
      /* handled by the global banner */
    }
  }

  async function handleTestVoice() {
    setVoiceState('speaking')
    try {
      await speak('こんにちは、ミチです', { rate: getSettings().tts_rate })
      setVoiceState('done')
    } catch {
      setVoiceState('error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything here applies straight away, everywhere in the app.</p>

      {/* learning */}
      <div className="mt-6 rounded-lg border border-line bg-paper-mid p-6">
        <h2 className="font-display text-base font-medium text-ink">Learning</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Romaji</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            How long the romaji line stays under the kana in exercises.
          </p>
          <div className="mt-2.5 inline-flex rounded-lg border border-line-strong p-1">
            {ROMAJI_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={settings.romaji === opt.value}
                onClick={() => void save({ romaji: opt.value })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  settings.romaji === opt.value ? 'bg-clay text-paper' : 'text-ink-mid hover:bg-oat'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="tts-rate" className="text-sm font-medium text-ink">
              Speech rate
            </label>
            <span className="font-mono text-xs text-ink-soft">{settings.tts_rate.toFixed(2)}×</span>
          </div>
          <input
            id="tts-rate"
            type="range"
            min={0.7}
            max={1.1}
            step={0.05}
            value={settings.tts_rate}
            onChange={(e) => void save({ tts_rate: Number(e.target.value) })}
            className="mt-2 w-full accent-clay"
          />
          <p className="mt-1 text-xs text-ink-soft">Applies to every audio button — the turtle replay stays slow.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="daily-goal" className="text-sm font-medium text-ink">
              Daily goal
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="daily-goal"
                type="number"
                min={5}
                step={5}
                value={settings.daily_goal_xp}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n) && n > 0) void save({ daily_goal_xp: n })
                }}
                className="min-h-11 w-24 rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-clay dark:bg-paper"
              />
              <span className="text-xs text-ink-soft">XP / day</span>
            </div>
          </div>
          <div>
            <label htmlFor="trip-date" className="text-sm font-medium text-ink">
              Trip date
            </label>
            <input
              id="trip-date"
              type="date"
              value={settings.trip_date}
              onChange={(e) => e.target.value && void save({ trip_date: e.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-clay dark:bg-paper"
            />
            <p className="mt-1 text-xs text-ink-soft">Reviews lean trip-core from three weeks out.</p>
          </div>
        </div>
      </div>

      {/* voice */}
      <div className="mt-4 rounded-lg border border-line bg-paper-mid p-6">
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
                  : 'not supported — speaking exercises use shadow-mode'}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => void handleTestVoice()}
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

        {sttSupported && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">Speaking exercises</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Override the microphone if it's more fiddly than helpful on this device.
            </p>
            <div className="mt-2.5 inline-flex rounded-lg border border-line-strong p-1">
              {STT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={(settings.stt_mode ?? 'auto') === opt.value}
                  onClick={() => void save({ stt_mode: opt.value })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    (settings.stt_mode ?? 'auto') === opt.value ? 'bg-clay text-paper' : 'text-ink-mid hover:bg-oat'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* appearance */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-paper-mid p-6">
        <div>
          <h2 className="font-display text-base font-medium text-ink">Appearance</h2>
          <p className="mt-1 text-sm text-ink-soft">Follows your system by default.</p>
        </div>
        <ThemeToggle />
      </div>

      {/* the path's dimension — per-device, like the theme */}
      <div className="mt-4 rounded-lg border border-line bg-paper-mid p-6">
        <h2 className="font-display text-base font-medium text-ink">The path</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The mountain in the round, or the classic flat scroll.
        </p>
        <div className="mt-2.5 inline-flex rounded-lg border border-line-strong p-1">
          {(
            [
              { value: true, label: '3D mountain' },
              { value: false, label: '2D scroll' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={path3D === opt.value}
              onClick={() => {
                localStorage.setItem('michi-path-3d', opt.value ? '1' : '0')
                setPath3D(opt.value)
              }}
              className={`min-h-9 rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                path3D === opt.value ? 'bg-clay text-paper' : 'text-ink-mid hover:bg-oat'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* your kitsune */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line bg-paper-mid p-6">
        <div>
          <h2 className="font-display text-base font-medium text-ink">Your kitsune</h2>
          <p className="mt-1 text-sm text-ink-soft">The colour of your walker on the path.</p>
          <div className="mt-3 flex items-center gap-2.5">
            {KITSUNE_TONES.map((opt) => {
              const selected = (settings.kitsune_tone ?? 'clay') === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-label={opt.label}
                  aria-pressed={selected}
                  onClick={() => void save({ kitsune_tone: opt.value })}
                  style={{ backgroundColor: PALETTE[opt.value].body }}
                  className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-paper-mid transition ${
                    selected ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-line-strong'
                  }`}
                />
              )
            })}
          </div>
        </div>
        <AnimatedKitsune tone={settings.kitsune_tone ?? 'clay'} width={44} height={49} />
      </div>

      {/* account — the header's avatar and sign-out moved here (2026-07-09) */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-paper-mid p-6">
        <div>
          <h2 className="font-display text-base font-medium text-ink">Account</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Signed in as {getUser()?.display_name ?? 'your household login'}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="min-h-11 rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-oat"
        >
          Sign out
        </button>
      </div>

      {/* about */}
      <p className="mt-8 mb-4 text-center text-xs text-ink-soft">
        Michi — a Mishka-family app, built for one household's trip to Japan.
      </p>
    </div>
  )
}
