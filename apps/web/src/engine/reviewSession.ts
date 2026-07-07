// Builds a synthetic LessonContent for the Practice tab's review sessions and
// free drills (docs/phases/PHASE-4-practice.md §1) — pure composition over
// engine/session.ts's existing "hand-authored steps" fast path (buildSession
// plays `content.steps` verbatim when present, skipping the new-item
// pacing/teach-card machinery entirely) plus `productionType()`, both
// already built for lessons. No new grading or pacing logic lives here.
import type { BankItem, ContentStep, ExerciseType, Item, LessonContent } from '../curriculum/types'
import { productionType } from './session'

type SingleType = Exclude<ExerciseType, 'match-pairs' | 'dialogue'>

function toItem({ unit, ...rest }: BankItem): Item {
  // Every item entering a review/drill session is, by definition, not this
  // session's "first exposure" — marking review_rider keeps LessonSession's
  // easy-upgrade-on-first-pass rule (CURRICULUM §6) from misfiring on it.
  void unit
  return { ...rest, review_rider: true }
}

/** Recognition for strength < 3, production once an item is "known"
 * (CURRICULUM §6: due sessions are "production-biased for strength >= 3
 * items") — alternates listen-pick / listen-pick-jp below that so a review
 * session isn't just one exercise type on repeat. */
function reviewStepType(item: Item, index: number): SingleType {
  if (item.strength >= 3) return productionType(item)
  return index % 2 === 0 ? 'listen-pick' : 'listen-pick-jp'
}

/** `targets` are what's actually graded, in the order they should be asked
 * (the server already returns /reviews/due weakest-first, trip-core boosted
 * inside T-21 — this function does not re-sort). `extras` pad the option
 * pool so 4-choice exercises have distractors even on a light review day. */
export function buildReviewContent(
  targets: BankItem[],
  extras: BankItem[] = [],
  opts: { title?: string; forceType?: SingleType } = {},
): LessonContent {
  const targetIds = new Set(targets.map((t) => t.id))
  const pool = [...targets, ...extras.filter((e) => !targetIds.has(e.id))].map(toItem)
  const steps: ContentStep[] = targets.map((item, i) => ({
    type: opts.forceType ?? reviewStepType(item, i),
    item: item.id,
  }))
  return {
    lesson: { id: 'practice', title: opts.title ?? 'Practice', kind: 'teach' },
    items: pool,
    steps,
    dialogues: [],
  }
}
