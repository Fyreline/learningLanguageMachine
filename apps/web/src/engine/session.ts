// Session builder + runtime adaptivity (docs/CURRICULUM.md §3 anatomy, §5
// pacing). Pure state machine — no React, no audio — so the whole lesson
// shape is vitest-coverable. The LessonPlayer renders whatever `current`
// says and reports graded answers back.

import type {
  ContentStep,
  ExerciseType,
  Grade,
  Item,
  LessonContent,
  StepResult,
} from '../curriculum/types'
import { tilesFor } from './grading'

/* ------------------------------ step model ------------------------------ */

export type SessionStep =
  | { kind: 'teach'; itemId: string; skippable: boolean; reteach?: boolean }
  | {
      kind: 'exercise'
      type: Exclude<ExerciseType, 'match-pairs' | 'dialogue'>
      itemId: string
      distractors?: string[]
      /** first drill of a brand-new item — carries the "I know this" link */
      firstDrill?: boolean
      /** an SRS warm-up rep — never shows the skip link */
      reviewRep?: boolean
      /** slow-lane extra rep — kept deliberately easy (recognition) */
      easyRep?: boolean
    }
  | { kind: 'match-pairs'; itemIds: string[] }
  | { kind: 'dialogue'; dialogueId: string }

const MAX_STEPS = 20

/* --------------------------- new-item rate (§5.3) ------------------------ */

const ACCURACY_KEY = 'michi-session-accuracy'

function readAccuracies(): number[] {
  try {
    const raw = localStorage.getItem(ACCURACY_KEY)
    const arr = raw ? (JSON.parse(raw) as number[]) : []
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

export function recordSessionAccuracy(pct: number): void {
  try {
    const arr = [...readAccuracies(), pct].slice(-3)
    localStorage.setItem(ACCURACY_KEY, JSON.stringify(arr))
  } catch {
    /* private-mode etc. — pacing just stays at the default */
  }
}

/** Rolling accuracy over the last 3 sessions sets the next lesson's new-item
 * count: >=90 -> 7, 75-90 -> 6, <75 -> 4 (docs/CURRICULUM.md §5.3). */
export function newItemBudget(accuracies: number[] = readAccuracies()): number {
  if (accuracies.length === 0) return 6
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length
  if (mean >= 90) return 7
  if (mean >= 75) return 6
  return 4
}

/* ------------------------------ the builder ------------------------------ */

export interface BuildOptions {
  /** override the localStorage-derived budget (tests, dev routes) */
  newItemLimit?: number
  /** dev route: force every generated single-item drill to one type */
  forceType?: Exclude<ExerciseType, 'match-pairs' | 'dialogue'>
  /** override rolling accuracy (tests) */
  accuracies?: number[]
}

/** Production drill choice: tile-arrange when the sentence has parts to
 * arrange, else speak (short single words are best said aloud). */
function productionType(item: Item): 'tile-arrange' | 'speak' {
  return tilesFor(item.jp).length >= 2 ? 'tile-arrange' : 'speak'
}

function fromContentSteps(steps: ContentStep[]): SessionStep[] {
  return steps.map((s): SessionStep => {
    if (s.type === 'match-pairs') return { kind: 'match-pairs', itemIds: s.items }
    if (s.type === 'dialogue') return { kind: 'dialogue', dialogueId: s.dialogue }
    if (s.type === 'teach') return { kind: 'teach', itemId: s.item, skippable: true }
    return { kind: 'exercise', type: s.type, itemId: s.item, distractors: s.distractors }
  })
}

export function buildSession(content: LessonContent, opts: BuildOptions = {}): SessionStep[] {
  // Hand-authored steps (checkpoints, kana lessons, unit-14 scenes) are the
  // session verbatim — the author already did the pacing.
  if (content.steps && content.steps.length > 0) {
    const steps = fromContentSteps(content.steps)
    return opts.forceType
      ? steps.map((s) => (s.kind === 'exercise' ? { ...s, type: opts.forceType! } : s))
      : steps
  }

  const riders = content.items.filter((i) => i.review_rider)
  const newItems = content.items.filter((i) => !i.review_rider)

  const accuracies = opts.accuracies ?? readAccuracies()
  const budget = opts.newItemLimit ?? newItemBudget(accuracies)
  const struggling = accuracies.length > 0 && newItemBudget(accuracies) === 4
  const chosen = newItems.slice(0, budget)

  const steps: SessionStep[] = []

  // warm-up: 2-3 review reps of the weakest earlier items (server-picked);
  // when the learner is struggling, two teach slots become review slots (§5.3).
  const warmupCount = Math.min(riders.length, struggling ? 4 : 2)
  for (const rider of riders.slice(0, warmupCount)) {
    steps.push({ kind: 'exercise', type: 'listen-pick', itemId: rider.id, reviewRep: true })
  }

  // teach: card -> immediate easy recognition drill, interleaved (never 3
  // cards in a row by construction).
  for (const item of chosen) {
    steps.push({ kind: 'teach', itemId: item.id, skippable: true })
    steps.push({ kind: 'exercise', type: 'listen-pick', itemId: item.id, firstDrill: true })
  }

  // drill: one ramped rep per new item (recall -> production alternating),
  // budgeted so the session stays 14-20 steps.
  const budgetLeft = Math.max(0, MAX_STEPS - steps.length - 3) // 3 = weave+finish
  const drillItems = chosen.slice(0, budgetLeft)
  drillItems.forEach((item, i) => {
    const type = i % 2 === 0 ? 'listen-pick-jp' : productionType(item)
    steps.push({ kind: 'exercise', type, itemId: item.id })
  })

  // weave: 2 exercises mixing today's items with older vocab in one step.
  const weavePool = [...chosen.map((i) => i.id), ...riders.map((i) => i.id)]
  if (weavePool.length >= 5) {
    steps.push({ kind: 'match-pairs', itemIds: weavePool.slice(0, 5) })
  }
  if (chosen.length > 0 && riders.length > 0) {
    const target = chosen[chosen.length - 1]
    steps.push({
      kind: 'exercise',
      type: 'listen-pick-jp',
      itemId: target.id,
      distractors: riders.slice(0, 3).map((r) => r.id),
    })
  }

  // finish: the hardest step — say the meatiest new item aloud.
  if (chosen.length > 0) {
    const meatiest = [...chosen].sort((a, b) => b.jp.length - a.jp.length)[0]
    steps.push({ kind: 'exercise', type: 'speak', itemId: meatiest.id })
  }

  const built = steps.slice(0, MAX_STEPS)
  if (opts.forceType) {
    return built.map((s) => (s.kind === 'exercise' ? { ...s, type: opts.forceType! } : s))
  }
  return built
}

/* --------------------------- runtime controller -------------------------- */

export interface AnswerOutcome {
  /** the grade recorded (a first-drill pass upgrades to easy per §6) */
  recorded: Grade
  /** the answer just tripped the 2-miss slow lane — a re-teach was inserted */
  enteredSlowLane: boolean
}

export class LessonSession {
  readonly steps: SessionStep[]
  private index = 0
  private readonly results: StepResult[] = []
  private readonly misses = new Map<string, number>()
  private readonly slowLaned = new Set<string>()
  private readonly skipped = new Set<string>()
  private readonly gradedOnce = new Set<string>()
  private points = 0
  private graded = 0
  private readonly newItemIds: Set<string>

  constructor(content: LessonContent, opts: BuildOptions = {}) {
    this.steps = buildSession(content, opts)
    this.newItemIds = new Set(content.items.filter((i) => !i.review_rider && i.strength === 0).map((i) => i.id))
  }

  get current(): SessionStep | null {
    return this.steps[this.index] ?? null
  }

  get finished(): boolean {
    return this.index >= this.steps.length
  }

  /** 0..1, for the top progress bar. */
  get progress(): number {
    return this.steps.length === 0 ? 1 : this.index / this.steps.length
  }

  get stepNumber(): number {
    return this.index + 1
  }

  get totalSteps(): number {
    return this.steps.length
  }

  isStruggling(itemId: string): boolean {
    return this.slowLaned.has(itemId)
  }

  next(): void {
    this.index += 1
    // fast-lane: hop over any step whose item was skipped
    while (!this.finished) {
      const step = this.current
      if (step && (step.kind === 'teach' || step.kind === 'exercise') && this.skipped.has(step.itemId)) {
        this.index += 1
      } else {
        break
      }
    }
  }

  /** Grade the current single-item step. Handles the §6 first-exposure easy
   * upgrade and the §5.2 slow lane (2 misses -> re-teach + 2 easy reps). */
  answer(verdict: 'pass' | 'close' | 'miss', mode: string): AnswerOutcome {
    const step = this.current
    if (!step || (step.kind !== 'exercise' && step.kind !== 'teach')) {
      return { recorded: 0, enteredSlowLane: false }
    }
    const itemId = step.itemId

    let grade: Grade = verdict === 'pass' ? 2 : verdict === 'close' ? 1 : 0
    // easy = pass on first exposure (§6): the first graded rep of a new item.
    if (
      grade === 2 &&
      this.newItemIds.has(itemId) &&
      !this.gradedOnce.has(itemId) &&
      !this.slowLaned.has(itemId)
    ) {
      grade = 3
    }
    this.gradedOnce.add(itemId)
    this.recordResult(itemId, grade, mode)

    let enteredSlowLane = false
    if (grade === 0) {
      const n = (this.misses.get(itemId) ?? 0) + 1
      this.misses.set(itemId, n)
      if (n >= 2 && !this.slowLaned.has(itemId)) {
        this.slowLaned.add(itemId)
        this.insertSlowLane(itemId)
        enteredSlowLane = true
      }
    }
    return { recorded: grade, enteredSlowLane }
  }

  /** match-pairs grades per pair (docs/CURRICULUM.md §4.6). */
  answerPairs(perItem: { itemId: string; correct: boolean }[]): void {
    for (const { itemId, correct } of perItem) {
      this.gradedOnce.add(itemId)
      this.recordResult(itemId, correct ? 2 : 0, 'match-pairs')
    }
  }

  /** dialogue scene: one grade per learner turn (§4.7). */
  answerDialogueTurn(itemId: string, verdict: 'pass' | 'close' | 'miss', mode: string): void {
    const grade: Grade = verdict === 'pass' ? 2 : verdict === 'close' ? 1 : 0
    this.gradedOnce.add(itemId)
    this.recordResult(itemId, grade, mode)
  }

  /** Fast lane (§5.1): "I know this" on a teach card or first drill marks
   * the item known (server maps fast-skip to strength 3 + next-day review)
   * and drops the item's remaining steps this session. */
  skip(itemId: string): void {
    this.skipped.add(itemId)
    this.results.push({ item_id: itemId, grade: 3, mode: 'fast-skip' })
    this.next()
  }

  private insertSlowLane(itemId: string): void {
    // re-teach card now (right after the missed step)...
    const reteach: SessionStep = { kind: 'teach', itemId, skippable: false, reteach: true }
    this.steps.splice(this.index + 1, 0, reteach)
    // ...and 2 extra easy reps spaced later in the session.
    const mid = Math.min(this.index + 3, this.steps.length)
    this.steps.splice(mid, 0, {
      kind: 'exercise',
      type: 'listen-pick',
      itemId,
      easyRep: true,
    })
    this.steps.push({ kind: 'exercise', type: 'listen-pick', itemId, easyRep: true })
  }

  private recordResult(itemId: string, grade: Grade, mode: string): void {
    this.results.push({ item_id: itemId, grade, mode })
    this.graded += 1
    this.points += grade >= 2 ? 1 : grade === 1 ? 0.5 : 0
  }

  /** 0-100 session score (stars at >=60/80/95, docs/CURRICULUM.md §8). */
  get scorePct(): number {
    if (this.graded === 0) return 0
    return Math.round((100 * this.points) / this.graded)
  }

  /** Every graded step, in order — the lesson-complete results payload. */
  get allResults(): StepResult[] {
    return [...this.results]
  }
}
