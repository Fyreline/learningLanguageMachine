// SpeechRecognition wrapper + graceful capability detection.
// docs/ARCHITECTURE.md §2: `webkitSpeechRecognition` where present
// (Chrome/Edge); elsewhere speaking exercises degrade to shadow-mode
// (CURRICULUM.md §4.8) rather than erroring.
//
// The Web Speech recognition API isn't in TypeScript's standard DOM lib, so
// these are minimal local shapes for just what this wrapper touches —
// deliberately not the ambient global `SpeechRecognition` type some browsers
// ship, to avoid depending on lib coverage that varies by TS/environment.

interface MinimalSpeechRecognitionResult {
  0: { transcript: string }
  isFinal: boolean
}

interface MinimalSpeechRecognitionResultList {
  length: number
  [index: number]: MinimalSpeechRecognitionResult
}

interface MinimalSpeechRecognitionEvent {
  results: MinimalSpeechRecognitionResultList
}

interface MinimalSpeechRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Capability detection surfaced in Settings — when false, speaking
 * exercises degrade to shadow-mode (listen + repeat, ungraded). */
export function detectSttCapability(): boolean {
  return getRecognitionCtor() !== null
}

export interface SttResult {
  transcript: string
  isFinal: boolean
}

export interface SttSession {
  stop: () => void
}

/** Starts listening for Japanese speech, calling `onResult` for each interim
 * and final result and `onEnd` when recognition stops (silence, stop(), or
 * an error). Returns null if SpeechRecognition isn't available at all —
 * callers should fall back to shadow-mode (CURRICULUM.md §4.8). */
export function startListening(onResult: (result: SttResult) => void, onEnd?: () => void): SttSession | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = 'ja-JP'
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1]
    onResult({ transcript: result[0].transcript, isFinal: result.isFinal })
  }
  recognition.onend = () => onEnd?.()
  recognition.onerror = () => onEnd?.()

  recognition.start()
  return {
    stop: () => recognition.stop(),
  }
}
