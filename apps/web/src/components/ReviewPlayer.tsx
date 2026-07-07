// The Practice tab's session runner (docs/phases/PHASE-4-practice.md §1):
// due reviews, the two free drills, and lightning review. All four modes
// reuse LessonPlayer's exact chrome (Takeover/StepView/FeedbackStrip/
// ShakeOnMiss, exported for this purpose) and engine/session.ts's
// LessonSession unmodified — only the item pool, what gets POSTed on
// completion, and (lightning only) a countdown differ from a lesson.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { BankItem, LessonContent, ReviewCompleteResponse } from '../curriculum/types'
import { completeReview, fetchAllItems, fetchReviewsDue, localDate } from '../curriculum/loader'
import { LessonSession, recordSessionAccuracy } from '../engine/session'
import { buildReviewContent } from '../engine/reviewSession'
import { shuffled } from '../engine/grading'
import { stopSpeaking } from '../audio/tts'
import { FeedbackStrip, ShakeOnMiss, StepView, Takeover, type Feedback } from './LessonPlayer'
import type { ExerciseResult } from './exercises/shared'

export type ReviewMode = 'due' | 'listening-drill' | 'speaking-drill' | 'lightning'

const DUE_SESSION_CAP = 20
const DRILL_SIZE = 12
const LIGHTNING_SIZE = 15
const LIGHTNING_SECONDS = 60

const MODE_LABEL: Record<ReviewMode, string> = {
  due: 'Review',
  'listening-drill': 'Listening drill',
  'speaking-drill': 'Speaking drill',
  lightning: 'Lightning review',
}

export interface ReviewPlayerProps {
  mode: ReviewMode
  onClose: (completed: boolean) => void
}

export function ReviewPlayer({ mode, onClose }: ReviewPlayerProps) {
  const [content, setContent] = useState<LessonContent | 'empty' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, forceRender] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [phase, setPhase] = useState<'playing' | 'submitting' | 'score'>('playing')
  const [outcome, setOutcome] = useState<ReviewCompleteResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(LIGHTNING_SECONDS)

  const sessionRef = useRef<LessonSession | null>(null)
  const submissionId = useRef<string>(crypto.randomUUID())
  const startedAt = useRef<number>(Date.now())
  const reducedMotion = useReducedMotion()
  const timed = mode === 'lightning'

  useEffect(() => {
    let cancelled = false
    loadContent(mode).then(
      (c) => {
        if (cancelled) return
        if (c === 'empty') {
          setContent('empty')
          return
        }
        sessionRef.current = new LessonSession(c)
        startedAt.current = Date.now()
        setContent(c)
      },
      (e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load anything to practise'),
    )
    return () => {
      cancelled = true
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const itemsById = useMemo(
    () => new Map((content && content !== 'empty' ? content.items : []).map((i) => [i.id, i])),
    [content],
  )

  const session = sessionRef.current
  const step = session?.current ?? null

  function rerender() {
    forceRender((n) => n + 1)
  }

  async function submit() {
    if (!session) return
    setPhase('submitting')
    setSubmitError(null)
    try {
      const res = await completeReview({
        submission_id: submissionId.current,
        duration_seconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        local_date: localDate(),
        results: session.allResults,
      })
      if (session.allResults.length > 0) recordSessionAccuracy(session.scorePct)
      fetchAllItems({ fresh: true }) // strengths just moved — refresh the shared cache
      setOutcome(res)
      setPhase('score')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save that session')
      setPhase('playing')
    }
  }

  function continueOn() {
    if (!session) return
    setFeedback(null)
    session.next()
    if (session.finished) {
      void submit()
    } else {
      rerender()
    }
  }

  function handleResult(result: ExerciseResult) {
    if (!session || feedback) return
    const { enteredSlowLane } = session.answer(result.verdict, result.mode)
    const itemId = step && (step.kind === 'exercise' || step.kind === 'teach') ? step.itemId : null
    setFeedback({
      verdict: result.verdict,
      given: result.given,
      item: itemId ? (itemsById.get(itemId) ?? null) : null,
      slowLane: enteredSlowLane,
    })
  }

  // lightning: a single visible countdown for the whole round — running out
  // ends the round with whatever's been answered so far (docs/CURRICULUM.md
  // §4: "Timed pressure exists only in the optional lightning review").
  useEffect(() => {
    if (!timed || phase !== 'playing' || content === 'empty' || !content) return
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer)
          void submit()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, phase, content])

  /* ------------------------------ render ------------------------------- */

  if (error) {
    return (
      <Takeover onClose={() => onClose(false)} progress={0} closeLabel="Close">
        <div className="pt-24 text-center">
          <p className="font-serif text-xl text-ink">That would not open.</p>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="mt-6 rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition hover:bg-oat"
          >
            Back to practice
          </button>
        </div>
      </Takeover>
    )
  }

  if (content === 'empty') {
    return (
      <Takeover onClose={() => onClose(false)} progress={0} closeLabel="Close">
        <div className="pt-24 text-center">
          <p className="font-serif text-xl text-ink">{emptyHeadline(mode)}</p>
          <p className="mt-2 text-sm text-ink-soft">{emptyBody(mode)}</p>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="mt-6 rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition hover:bg-oat"
          >
            Back to practice
          </button>
        </div>
      </Takeover>
    )
  }

  if (!content || !session) {
    return (
      <Takeover onClose={() => onClose(false)} progress={0} closeLabel="Close">
        <p className="pt-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">GATHERING WHAT’S DUE…</p>
      </Takeover>
    )
  }

  if (phase === 'score' && outcome) {
    return (
      <ReviewScoreScreen
        mode={mode}
        score={session.scorePct}
        outcome={outcome}
        reducedMotion={!!reducedMotion}
        onDone={() => onClose(true)}
      />
    )
  }

  return (
    <Takeover
      onClose={() => onClose(false)}
      progress={session.progress}
      closeLabel="Leave practice"
      rightSlot={
        timed ? (
          <span
            className="shrink-0 rounded-full border border-line-strong bg-paper-mid px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-clay"
            aria-live="polite"
          >
            0:{String(secondsLeft).padStart(2, '0')}
          </span>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-[40rem] px-5 pb-56 pt-14 sm:pt-20">
        <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
          {MODE_LABEL[mode]} · {session.stepNumber} of {session.totalSteps}
        </p>
        {step && (
          <ShakeOnMiss shake={feedback?.verdict === 'miss'} reduced={!!reducedMotion}>
            <StepView
              key={`${mode}-${session.stepNumber}`}
              step={step}
              itemsById={itemsById}
              dialoguesById={new Map()}
              pool={content.items}
              locked={feedback !== null}
              session={session}
              onResult={handleResult}
              onAdvance={continueOn}
              onSkip={() => {
                /* review reps never carry the fast-lane skip link (CURRICULUM
                 * §5.1) — StepView only renders it on firstDrill steps, which
                 * a review session never produces. */
              }}
              onPairs={() => undefined}
              onSceneDone={() => undefined}
            />
          </ShakeOnMiss>
        )}
        {phase === 'submitting' && (
          <p className="pt-10 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">SAVING…</p>
        )}
        {submitError && (
          <div className="mt-8 rounded-lg border border-line bg-paper-mid p-4 text-center">
            <p className="text-sm text-ink">{submitError}</p>
            <button
              type="button"
              onClick={() => void submit()}
              className="mt-3 rounded-lg bg-clay px-4 py-2 text-sm font-medium text-paper transition hover:bg-clay-deep"
            >
              Try saving again
            </button>
          </div>
        )}
      </div>

      <FeedbackStrip feedback={feedback} reduced={!!reducedMotion} onContinue={continueOn} />
    </Takeover>
  )
}

/* ------------------------------ data loading ------------------------------ */

async function loadContent(mode: ReviewMode): Promise<LessonContent | 'empty'> {
  const bank = await fetchAllItems()
  const byId = new Map(bank.map((b) => [b.id, b]))

  if (mode === 'due') {
    const due = await fetchReviewsDue()
    const targets = due.due
      .slice(0, DUE_SESSION_CAP)
      .map((d) => byId.get(d.item_id))
      .filter((i): i is BankItem => Boolean(i))
    if (targets.length === 0) return 'empty'
    return buildReviewContent(targets, extrasPool(bank, targets), { title: 'Review' })
  }

  if (mode === 'lightning') {
    const due = await fetchReviewsDue()
    const dueTargets = due.due
      .slice(0, LIGHTNING_SIZE)
      .map((d) => byId.get(d.item_id))
      .filter((i): i is BankItem => Boolean(i))
    const targets =
      dueTargets.length >= 5 ? dueTargets : shuffled(learnedItems(bank)).slice(0, LIGHTNING_SIZE)
    if (targets.length === 0) return 'empty'
    return buildReviewContent(targets, extrasPool(bank, targets), { title: 'Lightning review' })
  }

  // free drills: learned items only (strength >= 3), forced to one type
  const pool = shuffled(learnedItems(bank)).slice(0, DRILL_SIZE)
  if (pool.length === 0) return 'empty'
  const forceType = mode === 'listening-drill' ? 'listen-pick' : 'speak'
  return buildReviewContent(pool, extrasPool(bank, pool), {
    title: mode === 'listening-drill' ? 'Listening drill' : 'Speaking drill',
    forceType,
  })
}

function learnedItems(bank: BankItem[]): BankItem[] {
  return bank.filter((i) => i.strength >= 3 && i.jp)
}

/** Extra items purely to pad choice-card distractors — never graded. */
function extrasPool(bank: BankItem[], targets: BankItem[]): BankItem[] {
  const targetIds = new Set(targets.map((t) => t.id))
  return shuffled(bank.filter((i) => !targetIds.has(i.id))).slice(0, 24)
}

function emptyHeadline(mode: ReviewMode): string {
  switch (mode) {
    case 'due':
      return 'Nothing due right now.'
    case 'lightning':
      return 'Nothing to test yet.'
    default:
      return 'Nothing learned to drill yet.'
  }
}

function emptyBody(mode: ReviewMode): string {
  switch (mode) {
    case 'due':
      return 'Reviews will collect here as items come due — well kept, for now.'
    case 'lightning':
      return 'A few lessons first, then this fills up.'
    default:
      return 'Once a few phrases reach "known", they will show up here for a quick drill.'
  }
}

/* ----------------------------- score screen ------------------------------ */

function ReviewScoreScreen({
  mode,
  score,
  outcome,
  reducedMotion,
  onDone,
}: {
  mode: ReviewMode
  score: number
  outcome: ReviewCompleteResponse
  reducedMotion: boolean
  onDone: () => void
}) {
  const [xpShown, setXpShown] = useState(reducedMotion ? outcome.xp_awarded : 0)

  useEffect(() => {
    if (reducedMotion || outcome.xp_awarded === 0) {
      setXpShown(outcome.xp_awarded)
      return
    }
    const step = Math.max(1, Math.ceil(outcome.xp_awarded / 20))
    const timer = setInterval(() => {
      setXpShown((n) => {
        const next = n + step
        if (next >= outcome.xp_awarded) {
          clearInterval(timer)
          return outcome.xp_awarded
        }
        return next
      })
    }, 40)
    return () => clearInterval(timer)
  }, [outcome.xp_awarded, reducedMotion])

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper text-ink">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">{MODE_LABEL[mode]} complete</p>
        <p className="mt-8 font-mono text-[56px] leading-none text-ink">{score}</p>
        <p className="mt-1 text-sm text-ink-soft">out of 100</p>

        <p className="mt-8 font-mono text-sm tracking-[0.08em] text-ink-mid">
          +{xpShown} XP
          {outcome.streak.current > 0 && <span className="ml-3">STREAK {outcome.streak.current}</span>}
        </p>

        <p className="mt-4 text-sm text-ink-soft">
          {outcome.next_due_counts.today > 0
            ? `${outcome.next_due_counts.today} still due today.`
            : 'Nothing else due today.'}
        </p>

        <button
          type="button"
          onClick={onDone}
          className="mt-10 w-full rounded-lg bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay-deep"
        >
          Back to practice
        </button>
      </div>
    </div>
  )
}
