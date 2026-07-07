// Client-side mirror of app/srs.py (docs/CURRICULUM.md §6) — forecast only.
// The server is the writer of record; this exists so the score screen can say
// "see you tomorrow / in 4 days" without a round trip. Keep the maths in
// lockstep with apps/server/app/srs.py.

import type { Grade } from '../curriculum/types'

export interface SrsState {
  strength: number
  ease: number
  interval_days: number
  reps: number
  lapses: number
}

export const NEW_STATE: SrsState = {
  strength: 0,
  ease: 2.5,
  interval_days: 0,
  reps: 0,
  lapses: 0,
}

const EASE_FLOOR = 1.3
const INTERVAL_CAP_DAYS = 60

/** Python's round() is banker's rounding (half to even); Math.round is
 * half-up. The server is the writer of record, so the mirror matches it. */
function roundHalfEven(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff > 0.5) return floor + 1
  if (diff < 0.5) return floor
  return floor % 2 === 0 ? floor : floor + 1
}

export function forecastReview(state: SrsState, grade: Grade): SrsState {
  let { strength, ease, interval_days: interval, reps, lapses } = state

  if (grade === 0) {
    lapses += 1
    ease = Math.max(EASE_FLOOR, ease - 0.2)
    interval = Math.max(1, interval * 0.25)
    strength = Math.max(1, strength - 1)
  } else if (grade === 1) {
    ease = Math.max(EASE_FLOOR, ease - 0.05)
  } else {
    if (grade === 3) ease += 0.05
    interval = reps === 0 ? 1 : roundHalfEven(interval * ease)
    reps += 1
    strength = Math.min(
      4,
      strength + (interval >= 4 ? 1 : 0) + (grade === 3 && reps <= 1 ? 1 : 0),
    )
  }

  interval = Math.min(interval, INTERVAL_CAP_DAYS)
  return { strength, ease, interval_days: interval, reps, lapses }
}

/** "Back tomorrow" / "back in n days" — score-screen copy helper. */
export function nextDueLabel(intervalDays: number): string {
  const days = Math.max(1, Math.round(intervalDays))
  return days === 1 ? 'back tomorrow' : `back in ${days} days`
}
