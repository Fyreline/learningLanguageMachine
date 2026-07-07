// engine/session.ts — lesson anatomy (§3) and adaptive pacing (§5).
import { describe, expect, it } from 'vitest'
import type { Item, LessonContent } from '../curriculum/types'
import { LessonSession, buildSession, newItemBudget, type SessionStep } from './session'

function item(id: string, jp: string, opts: Partial<Item> = {}): Item {
  return {
    id,
    jp,
    romaji: id,
    en: `meaning of ${id}`,
    tags: ['greeting'],
    strength: 0,
    due_at: null,
    review_rider: false,
    ...opts,
  }
}

function lesson(newCount = 5, riderCount = 3): LessonContent {
  const items: Item[] = []
  for (let i = 0; i < newCount; i++) {
    items.push(item(`u01.new${i}`, `ことば${i} です`))
  }
  for (let i = 0; i < riderCount; i++) {
    items.push(item(`u01.old${i}`, `ふるい${i}`, { review_rider: true, strength: 2 }))
  }
  return {
    lesson: { id: 'u01.l1', title: 'Test', kind: 'teach' },
    items,
    steps: null,
    dialogues: [],
  }
}

describe('buildSession — lesson anatomy (§3)', () => {
  it('opens with warm-up review reps when riders exist', () => {
    const steps = buildSession(lesson(), { accuracies: [85] })
    expect(steps[0]).toMatchObject({ kind: 'exercise', reviewRep: true })
    expect(steps[1]).toMatchObject({ kind: 'exercise', reviewRep: true })
  })

  it('interleaves teach cards with immediate drills — never 3 cards in a row', () => {
    const steps = buildSession(lesson(), { accuracies: [85] })
    let consecutiveTeach = 0
    for (const s of steps) {
      consecutiveTeach = s.kind === 'teach' ? consecutiveTeach + 1 : 0
      expect(consecutiveTeach).toBeLessThan(3)
    }
    // every teach card is followed by that item's first drill
    steps.forEach((s, i) => {
      if (s.kind === 'teach') {
        const drill = steps[i + 1]
        expect(drill).toMatchObject({ kind: 'exercise', itemId: s.itemId, firstDrill: true })
      }
    })
  })

  it('stays within the 14-20 step session envelope', () => {
    expect(buildSession(lesson(5, 3), { accuracies: [85] }).length).toBeLessThanOrEqual(20)
    expect(buildSession(lesson(7, 3), { accuracies: [95] }).length).toBeLessThanOrEqual(20)
    expect(buildSession(lesson(5, 3), { accuracies: [85] }).length).toBeGreaterThanOrEqual(14)
  })

  it('finishes on a speak step (the hardest thing last)', () => {
    const steps = buildSession(lesson(), { accuracies: [85] })
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'exercise', type: 'speak' })
  })

  it('maps hand-authored checkpoint steps verbatim', () => {
    const content = lesson()
    content.steps = [
      { type: 'listen-pick', item: 'u01.new0' },
      { type: 'match-pairs', items: ['u01.new0', 'u01.new1', 'u01.new2', 'u01.new3', 'u01.new4'] },
      { type: 'dialogue', dialogue: 'u01.d1' },
    ]
    const steps = buildSession(content)
    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatchObject({ kind: 'exercise', type: 'listen-pick' })
    expect(steps[1]).toMatchObject({ kind: 'match-pairs' })
    expect(steps[2]).toMatchObject({ kind: 'dialogue', dialogueId: 'u01.d1' })
  })
})

describe('new-item rate (§5.3)', () => {
  it('maps rolling accuracy to the documented budgets', () => {
    expect(newItemBudget([95, 92, 90])).toBe(7)
    expect(newItemBudget([80, 85, 78])).toBe(6)
    expect(newItemBudget([60, 70, 65])).toBe(4)
    expect(newItemBudget([])).toBe(6) // no history: the default
  })

  it('a struggling learner gets fewer new items and extra review', () => {
    const content = lesson(7, 4)
    const steps = buildSession(content, { accuracies: [60] })
    const teachIds = new Set(
      steps.filter((s) => s.kind === 'teach').map((s) => (s.kind === 'teach' ? s.itemId : '')),
    )
    expect(teachIds.size).toBe(4) // budget dropped from 7 to 4
    const warmups = steps.filter((s) => s.kind === 'exercise' && s.reviewRep)
    expect(warmups.length).toBe(4) // two teach slots became review slots
  })
})

describe('LessonSession — fast lane (§5.1)', () => {
  it('skip records a fast-skip result and hops the item’s later steps', () => {
    const session = new LessonSession(lesson(), { accuracies: [85] })
    // advance past warm-ups to the first teach card
    while (session.current?.kind !== 'teach') session.next()
    const skippedId = session.current.itemId

    session.skip(skippedId)
    expect(session.allResults).toContainEqual({
      item_id: skippedId,
      grade: 3,
      mode: 'fast-skip',
    })
    // no remaining step ever shows that item again
    while (!session.finished) {
      const s = session.current
      if (s && (s.kind === 'teach' || s.kind === 'exercise')) {
        expect(s.itemId).not.toBe(skippedId)
      }
      session.next()
    }
  })
})

describe('LessonSession — slow lane (§5.2)', () => {
  it('2 misses convert to a re-teach card plus 2 extra easy reps', () => {
    const session = new LessonSession(lesson(), { accuracies: [85] })
    while (session.current?.kind !== 'teach') session.next()
    const strugglerId = session.current.itemId
    session.next() // onto the first drill

    const before = session.steps.length
    const first = session.answer('miss', 'listen-pick')
    expect(first.enteredSlowLane).toBe(false)
    session.next()

    // find the item's next exercise and miss it again
    const cur = (): SessionStep | null => session.current
    while (true) {
      const s = cur()
      if (s && s.kind === 'exercise' && s.itemId === strugglerId) break
      session.next()
    }
    const second = session.answer('miss', 'listen-pick-jp')
    expect(second.enteredSlowLane).toBe(true)
    expect(session.steps.length).toBe(before + 3) // re-teach + 2 easy reps
    expect(session.isStruggling(strugglerId)).toBe(true)

    session.next()
    expect(session.current).toMatchObject({ kind: 'teach', itemId: strugglerId, reteach: true })
  })
})

describe('LessonSession — grading and score', () => {
  it('upgrades a first-exposure pass to easy (§6)', () => {
    const session = new LessonSession(lesson(), { accuracies: [85] })
    while (session.current?.kind !== 'teach') session.next()
    session.next() // first drill of a new item
    const outcome = session.answer('pass', 'listen-pick')
    expect(outcome.recorded).toBe(3)
  })

  it('keeps review-rep passes at plain pass', () => {
    const session = new LessonSession(lesson(), { accuracies: [85] })
    // step 0 is a warm-up rider (strength 2, not a new item)
    const outcome = session.answer('pass', 'listen-pick')
    expect(outcome.recorded).toBe(2)
  })

  it('scores the session as pass=1, close=0.5, miss=0', () => {
    const session = new LessonSession(lesson(), { accuracies: [85] })
    session.answer('pass', 'listen-pick') // rider: grade 2 -> 1 point
    session.next()
    session.answer('close', 'listen-pick') // 0.5
    session.next()
    session.answer('miss', 'listen-pick') // 0
    expect(session.scorePct).toBe(50)
  })
})
