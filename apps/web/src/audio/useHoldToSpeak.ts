// Hold-to-talk state machine shared by the two speaking surfaces (Speak.tsx
// and DialogueScene.tsx) so they can't drift. Wraps stt.ts's startListening
// and owns the tricky bit: the Web Speech API finalises ASYNCHRONOUSLY.
//
// After recognition.stop() the engine can still take ~1-2s to fire its last
// `onresult` (isFinal) and then `onend` — grading only happens in `onend`, so
// the moment the user releases the mic nothing visibly changes and they assume
// it failed and press again (the "press twice" bug). Two guards fix that:
//   1. a `processing` phase between release and settle, so the UI can show
//      that something is happening (and disable re-press);
//   2. a safety timeout so that if `onend` never fires at all — a real Chrome
//      quirk when stop() lands very soon after start(), or before any speech —
//      the exercise force-settles on whatever transcript exists instead of
//      hanging forever.
//
// `onSettle` is called EXACTLY once per listen cycle with the best transcript,
// or the empty string when nothing was heard — callers pass empty straight
// through their `if (!heard) return` so an empty press never counts as an
// attempt (docs/CURRICULUM.md §4.4).

import { useEffect, useRef, useState } from 'react'
import { startListening, type SttSession } from './stt'

const SETTLE_TIMEOUT_MS = 2500

export interface HoldToSpeak {
  listening: boolean
  processing: boolean
  transcript: string
  start: () => void
  stop: () => void
}

export function useHoldToSpeak(onSettle: (heard: string) => void, locked = false): HoldToSpeak {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const sessionRef = useRef<SttSession | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const settledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep the latest onSettle without re-arming anything — avoids the stale
  // closure the old inline handlers had (they graded against the transcript as
  // it was at start(), not at settle).
  const onSettleRef = useRef(onSettle)
  onSettleRef.current = onSettle

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(
    () => () => {
      sessionRef.current?.stop()
      clearTimer()
    },
    [],
  )

  // Runs once per cycle, whichever of onend / the safety net gets there first.
  function finish() {
    if (settledRef.current) return
    settledRef.current = true
    clearTimer()
    setListening(false)
    setProcessing(false)
    onSettleRef.current(finalRef.current || interimRef.current)
  }

  function start() {
    if (locked || listening || processing) return
    finalRef.current = ''
    interimRef.current = ''
    settledRef.current = false
    setTranscript('')
    const session = startListening((r) => {
      setTranscript(r.transcript)
      interimRef.current = r.transcript
      if (r.isFinal) finalRef.current = r.transcript
    }, finish)
    if (!session) return
    sessionRef.current = session
    setListening(true)
  }

  function stop() {
    if (!listening) return
    sessionRef.current?.stop()
    // Release → not listening, but not settled either: show the processing
    // phase and arm the safety net until onend actually fires.
    setListening(false)
    setProcessing(true)
    clearTimer()
    timerRef.current = setTimeout(finish, SETTLE_TIMEOUT_MS)
  }

  return { listening, processing, transcript, start, stop }
}
