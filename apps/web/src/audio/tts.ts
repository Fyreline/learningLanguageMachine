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

function pickJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.lang?.toLowerCase() === 'ja-jp') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('ja')) ??
    null
  )
}

export interface SpeakOptions {
  /** 0.1-10, Web Speech API default 1. The lesson stage's "turtle" replay
   * button uses 0.65 (docs/DESIGN.md §4). */
  rate?: number
}

/** Speaks `text` in Japanese. Resolves once the utterance finishes (or
 * errors). No-ops silently if TTS isn't supported — callers should check
 * `detectTtsCapability()` first if they want to surface that. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const synth = window.speechSynthesis
  const voices = cachedVoices ?? (await loadVoices())
  cachedVoices = voices
  const voice = pickJapaneseVoice(voices)

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    if (voice) utterance.voice = voice
    utterance.rate = options.rate ?? 1
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    synth.speak(utterance)
  })
}

/** Stops anything currently speaking or queued. */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
