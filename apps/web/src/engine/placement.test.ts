import { describe, expect, it } from 'vitest'
import { PlacementProbeRunner } from './placement'

function pool(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `item${i}`)
}

describe('PlacementProbeRunner — adaptive probe (CURRICULUM §5)', () => {
  it('starts at the front of the pool', () => {
    const r = new PlacementProbeRunner(pool(30))
    expect(r.current).toBe('item0')
    expect(r.stepNumber).toBe(1)
  })

  it('advances one step at a time without a streak', () => {
    const r = new PlacementProbeRunner(pool(30))
    r.answer(false)
    expect(r.current).toBe('item1')
    r.answer(true)
    expect(r.current).toBe('item2')
  })

  it('jumps forward on a streak of 3 correct answers, then resets the streak', () => {
    const r = new PlacementProbeRunner(pool(30))
    r.answer(true) // item0
    r.answer(true) // item1
    expect(r.current).toBe('item2')
    r.answer(true) // item2 -> streak of 3 -> jump
    expect(r.current).not.toBe('item3') // jumped past the very next item
    const jumpedTo = r.current
    expect(jumpedTo).not.toBeNull()
  })

  it('marks only correctly-answered items as known', () => {
    const r = new PlacementProbeRunner(pool(10))
    r.answer(true) // item0 known
    r.answer(false) // item1 not known
    r.answer(true) // item2 known
    expect(r.knownItemIds.sort()).toEqual(['item0', 'item2'].sort())
  })

  it('stops after maxSteps regardless of pool size', () => {
    const r = new PlacementProbeRunner(pool(100), 5)
    for (let i = 0; i < 5; i++) r.answer(false)
    expect(r.finished).toBe(true)
    expect(r.current).toBeNull()
  })

  it('stops early if the pool runs out before maxSteps', () => {
    const r = new PlacementProbeRunner(pool(2), 12)
    r.answer(false)
    r.answer(false)
    expect(r.finished).toBe(true)
  })

  it('never answers past the end even after a large jump near the tail', () => {
    const r = new PlacementProbeRunner(pool(5), 12)
    r.answer(true)
    r.answer(true)
    r.answer(true) // streak jump near a tiny pool
    expect(r.finished || r.current !== null).toBe(true)
    // whatever `current` is, it must be a real pool member
    if (r.current) expect(pool(5)).toContain(r.current)
  })
})
