// speechSynthesis wrapper — ja-JP voice pick, rate, a tiny queue.
// docs/ARCHITECTURE.md §2: audio is entirely the browser's job — no audio
// ever leaves the device and no external TTS API is called.

export interface TtsCapability {
  supported: boolean
  jaVoices: SpeechSynthesisVoice[]
}

let cachedVoices: SpeechSynthesisVoice[] | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([])
  const synth = window.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)
  return new Promise((resolve) => {
    const handle = () => {
      resolve(synth.getVoices())
      synth.removeEventListener('voiceschanged', handle)
    }
    synth.addEventListener('voiceschanged', handle)
    // Some browsers never fire voiceschanged if voices load synchronously —
    // a short fallback avoids hanging forever.
    setTimeout(() => resolve(synth.getVoices()), 500)
  })
}

/** Capability detection surfaced in Settings (docs/phases/PHASE-1-scaffold.md). */
export async function detectTtsCapability(): Promise<TtsCapability> {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  if (!supported) return { supported: false, jaVoices: [] }
  const voices = await loadVoices()
  cachedVoices = voices
  const jaVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith('ja'))
  return { supported: true, jaVoices }
}

/** Prefer the natural household voices — Kyoko (macOS/iOS) or Google 日本語
 * (Chrome) — before falling back to any ja-JP voice (docs/phases/PHASE-3). */
function pickJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ja = voices.filter((v) => v.lang?.toLowerCase().startsWith('ja'))
  return (
    ja.find((v) => v.name.includes('Kyoko')) ??
    ja.find((v) => v.name.includes('Google')) ??
    ja.find((v) => v.lang?.toLowerCase() === 'ja-jp') ??
    ja[0] ??
    null
  )
}

/* ------------------------- speaking-state events -------------------------
 * The lesson stage's audio button pulses a ring while TTS speaks
 * (docs/DESIGN.md §7). One module-level pub/sub, driven by utterance
 * start/end so overlapping queued utterances read as one speaking span. */

type SpeakingListener = (speaking: boolean) => void
const speakingListeners = new Set<SpeakingListener>()
let activeUtterances = 0

function trackUtterance(delta: 1 | -1) {
  activeUtterances = Math.max(0, activeUtterances + delta)
  const speaking = activeUtterances > 0
  for (const listener of speakingListeners) listener(speaking)
}

/** Subscribe to TTS speaking-state changes (drives the audio button's pulse
 * ring). Returns an unsubscribe. */
export function subscribeSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener)
  listener(activeUtterances > 0)
  return () => {
    speakingListeners.delete(listener)
  }
}

export function isSpeaking(): boolean {
  return activeUtterances > 0
}

export interface SpeakOptions {
  /** 0.1-10, Web Speech API default 1. The lesson stage's "turtle" replay
   * button uses 0.65 (docs/DESIGN.md §4). */
  rate?: number
  /** true (default) cancels anything already speaking; false queues after. */
  interrupt?: boolean
}

/** Speaks `text` in Japanese. Resolves once the utterance finishes (or
 * errors). No-ops silently if TTS isn't supported — callers should check
 * `detectTtsCapability()` first if they want to surface that. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const synth = window.speechSynthesis
  if (options.interrupt !== false && (synth.speaking || synth.pending)) {
    synth.cancel()
    activeUtterances = 0
  }
  const voices = cachedVoices ?? (await loadVoices())
  cachedVoices = voices
  const voice = pickJapaneseVoice(voices)

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    if (voice) utterance.voice = voice
    utterance.rate = options.rate ?? 1
    let started = false
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      if (started) trackUtterance(-1)
      resolve()
    }
    utterance.onstart = () => {
      started = true
      trackUtterance(1)
    }
    utterance.onend = finish
    utterance.onerror = finish
    synth.speak(utterance)
  })
}

/** Stops anything currently speaking or queued. */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
