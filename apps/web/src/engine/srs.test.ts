// engine/srs.ts — the client forecast must mirror apps/server/app/srs.py.
import { describe, expect, it } from 'vitest'
import { NEW_STATE, forecastReview, nextDueLabel } from './srs'

describe('forecastReview mirrors the server maths (§6)', () => {
  it('new item, easy first exposure', () => {
    const s = forecastReview(NEW_STATE, 3)
    expect(s).toMatchObject({ reps: 1, interval_days: 1, strength: 1 })
    expect(s.ease).toBeCloseTo(2.55)
  })

  it('pass ramp grows interval then strength', () => {
    let s = forecastReview(NEW_STATE, 2) // interval 1
    s = forecastReview(s, 2) // 2.5 -> 2 (rounded... round(1*2.5)=3? no: round(2.5)=3)
    s = forecastReview(s, 2)
    expect(s.strength).toBeGreaterThanOrEqual(1)
    expect(s.interval_days).toBeGreaterThanOrEqual(4)
  })

  it('miss shrinks everything and floors at 1 day', () => {
    let s = forecastReview(NEW_STATE, 2)
    s = forecastReview(s, 0)
    expect(s.lapses).toBe(1)
    expect(s.interval_days).toBe(1)
    expect(s.ease).toBeCloseTo(2.3)
  })

  it('caps the interval at 60 days', () => {
    const s = forecastReview({ ...NEW_STATE, interval_days: 40, reps: 5 }, 3)
    expect(s.interval_days).toBe(60)
  })
})

describe('nextDueLabel', () => {
  it('reads naturally', () => {
    expect(nextDueLabel(1)).toBe('back tomorrow')
    expect(nextDueLabel(5)).toBe('back in 5 days')
  })
})
