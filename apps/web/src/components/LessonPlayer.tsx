// The lesson stage (docs/DESIGN.md §4): a full-screen takeover playing one
// exercise at a time. The feedback strip NEVER auto-advances — the learner
// controls tempo. Adaptivity (fast lane / slow lane / new-item rate) lives in
// engine/session.ts; this component just renders the current step and posts
// the finished session.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Dialogue, Item, LessonContent } from '../curriculum/types'
import {
  completeLesson,
  fetchLesson,
  localDate,
  type LessonCompletePayload,
} from '../curriculum/loader'
import type { LessonCompleteResponse } from '../curriculum/types'
import { LessonSession, recordSessionAccuracy, type SessionStep } from '../engine/session'
import { shuffled } from '../engine/grading'
import { stopSpeaking } from '../audio/tts'
import { DialogueScene } from './exercises/DialogueScene'
import { KanaGlyph } from './exercises/KanaGlyph'
import { ListenPick } from './exercises/ListenPick'
import { ListenPickJp } from './exercises/ListenPickJp'
import { ListenTypeRomaji } from './exercises/ListenTypeRomaji'
import { MatchPairs } from './exercises/MatchPairs'
import { Speak } from './exercises/Speak'
import { TileArrange } from './exercises/TileArrange'
import { TeachCard } from './exercises/TeachCard'
import { InlineReplay, type ExerciseResult, type Verdict } from './exercises/shared'

interface Feedback {
  verdict: Verdict
  given?: string
  item: Item | null
  /** slow-lane note: "we'll come back to this one" */
  slowLane?: boolean
  /** non-graded confirmations (match-pairs, dialogue scenes) */
  headline?: string
}

export interface LessonPlayerProps {
  lessonId: string
  onClose: (completed: boolean) => void
}

export function LessonPlayer({ lessonId, onClose }: LessonPlayerProps) {
  const [content, setContent] = useState<LessonContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, forceRender] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [phase, setPhase] = useState<'playing' | 'submitting' | 'score'>('playing')
  const [outcome, setOutcome] = useState<LessonCompleteResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const sessionRef = useRef<LessonSession | null>(null)
  const submissionId = useRef<string>(crypto.randomUUID())
  const startedAt = useRef<number>(Date.now())
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    fetchLesson(lessonId).then(
      (c) => {
        if (cancelled) return
        // dev route: ?exercise=speak forces every generated drill to one type
        const forced = new URLSearchParams(window.location.search).get('exercise')
        sessionRef.current = new LessonSession(c, forced ? { forceType: forced as never } : {})
        startedAt.current = Date.now()
        setContent(c)
      },
      (e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the lesson'),
    )
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [lessonId])

  const itemsById = useMemo(
    () => new Map((content?.items ?? []).map((i) => [i.id, i])),
    [content],
  )
  const dialoguesById = useMemo(
    () => new Map((content?.dialogues ?? []).map((d) => [d.id, d])),
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
    const payload: LessonCompletePayload = {
      submission_id: submissionId.current,
      score: session.scorePct,
      duration_seconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      local_date: localDate(),
      results: session.allResults,
    }
    try {
      const res = await completeLesson(lessonId, payload)
      recordSessionAccuracy(session.scorePct)
      // Handoff to the path scene (phase 5's deferred celebration): one line
      // the path reads-and-clears on its next mount to animate the walk /
      // torii moment.
      try {
        sessionStorage.setItem(
          'michi-celebrate',
          JSON.stringify({
            lesson_id: lessonId,
            stars: res.stars,
            score: session.scorePct,
            unit_completed: res.path.unit_completed,
            next_lesson_id: res.path.next_lesson_id,
          }),
        )
      } catch {
        /* storage unavailable — the celebration is decorative */
      }
      setOutcome(res)
      setPhase('score')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save the lesson')
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
    const itemId =
      step && (step.kind === 'exercise' || step.kind === 'teach') ? step.itemId : null
    setFeedback({
      verdict: result.verdict,
      given: result.given,
      item: itemId ? (itemsById.get(itemId) ?? null) : null,
      slowLane: enteredSlowLane,
    })
  }

  /* ------------------------------ render ------------------------------- */

  if (error) {
    return (
      <Takeover onClose={() => onClose(false)} progress={0}>
        <div className="pt-24 text-center">
          <p className="font-serif text-xl text-ink">The lesson would not open.</p>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="mt-6 rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition hover:bg-oat"
          >
            Back to the path
          </button>
        </div>
      </Takeover>
    )
  }

  if (!content || !session) {
    return (
      <Takeover onClose={() => onClose(false)} progress={0}>
        <p className="pt-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">
          PACKING THE SATCHEL…
        </p>
      </Takeover>
    )
  }

  if (phase === 'score' && outcome) {
    return (
      <ScoreScreen
        title={content.lesson.title}
        score={session.scorePct}
        outcome={outcome}
        reducedMotion={!!reducedMotion}
        onDone={() => onClose(true)}
      />
    )
  }

  return (
    <Takeover onClose={() => onClose(false)} progress={session.progress}>
      <div className="mx-auto w-full max-w-[40rem] px-5 pb-56 pt-14 sm:pt-20">
        {step && (
          <ShakeOnMiss shake={feedback?.verdict === 'miss'} reduced={!!reducedMotion}>
            <StepView
              key={`${lessonId}-${session.stepNumber}`}
              step={step}
              itemsById={itemsById}
              dialoguesById={dialoguesById}
              pool={content.items}
              locked={feedback !== null}
              session={session}
              onResult={handleResult}
              onAdvance={continueOn}
              onSkip={(itemId) => {
                session.skip(itemId)
                if (session.finished) {
                  void submit()
                } else {
                  rerender()
                }
              }}
              onPairs={(perItem) => {
                session.answerPairs(perItem)
                const missedCount = perItem.filter((p) => !p.correct).length
                setFeedback({
                  verdict: missedCount === 0 ? 'pass' : 'close',
                  item: null,
                  headline:
                    missedCount === 0
                      ? 'All five matched, first time.'
                      : 'Matched — a couple needed a second look.',
                })
              }}
              onSceneDone={() => {
                setFeedback({ verdict: 'pass', item: null, headline: 'Scene complete.' })
              }}
            />
          </ShakeOnMiss>
        )}
        {phase === 'submitting' && (
          <p className="pt-10 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">
            SAVING YOUR STEPS…
          </p>
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

/* ------------------------------- chrome --------------------------------- */

function Takeover({
  children,
  progress,
  onClose,
}: {
  children: React.ReactNode
  progress: number
  onClose: () => void
}) {
  // lock body scroll while the takeover is up
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper text-ink">
      <div className="sticky top-0 z-10 bg-paper/95">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Leave the lesson"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-oat hover:text-ink"
          >
            <svg viewBox="0 0 20 20" aria-hidden width="16" height="16">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Lesson progress">
            <motion.div
              className="h-full rounded-full bg-clay"
              initial={false}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function ShakeOnMiss({
  shake,
  reduced,
  children,
}: {
  shake: boolean
  reduced: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      animate={shake && !reduced ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------ step view ------------------------------- */

function StepView({
  step,
  itemsById,
  dialoguesById,
  pool,
  locked,
  session,
  onResult,
  onAdvance,
  onSkip,
  onPairs,
  onSceneDone,
}: {
  step: SessionStep
  itemsById: Map<string, Item>
  dialoguesById: Map<string, Dialogue>
  pool: Item[]
  locked: boolean
  session: LessonSession
  onResult: (r: ExerciseResult) => void
  onAdvance: () => void
  onSkip: (itemId: string) => void
  onPairs: (perItem: { itemId: string; correct: boolean }[]) => void
  onSceneDone: () => void
}) {
  if (step.kind === 'teach') {
    const item = itemsById.get(step.itemId)
    if (!item) return null
    return (
      <TeachCard
        item={item}
        reteach={step.reteach}
        skippable={step.skippable}
        onGotIt={onAdvance}
        onSkip={() => onSkip(step.itemId)}
      />
    )
  }

  if (step.kind === 'match-pairs') {
    const items = step.itemIds
      .map((id) => itemsById.get(id))
      .filter((i): i is Item => Boolean(i))
    return <MatchPairs items={items} locked={locked} onComplete={onPairs} />
  }

  if (step.kind === 'dialogue') {
    const dialogue = dialoguesById.get(step.dialogueId)
    if (!dialogue) return null
    return (
      <DialogueScene
        dialogue={dialogue}
        itemsById={itemsById}
        pool={pool}
        onTurnResult={(itemId, verdict, mode) => session.answerDialogueTurn(itemId, verdict, mode)}
        onComplete={onSceneDone}
      />
    )
  }

  // single-item exercise
  const item = itemsById.get(step.itemId)
  if (!item) return null
  const distractorItems = (step.distractors ?? [])
    .map((id) => itemsById.get(id))
    .filter((i): i is Item => Boolean(i))
  const fallbackPool = shuffled(pool.filter((p) => p.id !== item.id)).slice(
    0,
    Math.max(0, 3 - distractorItems.length),
  )
  const options = [item, ...distractorItems, ...fallbackPool].slice(0, 4)

  const common = { item, options, locked, onResult }
  const body = (() => {
    switch (step.type) {
      case 'listen-pick':
        return <ListenPick {...common} />
      case 'listen-pick-jp':
        return <ListenPickJp {...common} />
      case 'tile-arrange':
        return <TileArrange {...common} />
      case 'speak':
        return <Speak {...common} />
      case 'listen-type-romaji':
        return <ListenTypeRomaji {...common} />
      case 'kana-glyph':
        return <KanaGlyph {...common} />
    }
  })()

  return (
    <div>
      {body}
      {step.firstDrill && !locked && (
        <p className="mt-4 text-right">
          <button
            type="button"
            onClick={() => onSkip(step.itemId)}
            className="text-xs text-ink-soft underline decoration-dotted underline-offset-2 transition hover:text-ink"
          >
            Skip — I know this one
          </button>
        </p>
      )}
    </div>
  )
}

/* ---------------------------- feedback strip ----------------------------- */

function FeedbackStrip({
  feedback,
  reduced,
  onContinue,
}: {
  feedback: Feedback | null
  reduced: boolean
  onContinue: () => void
}) {
  // Enter continues once the strip is up — keyboard tempo control
  useEffect(() => {
    if (!feedback) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onContinue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, onContinue])

  const tone =
    feedback?.verdict === 'pass'
      ? 'bg-olive/15'
      : feedback?.verdict === 'close'
        ? 'bg-kraft/20'
        : 'bg-fig/10'
  const headText =
    feedback?.headline ??
    (feedback?.verdict === 'pass'
      ? 'そう！ That’s it.'
      : feedback?.verdict === 'close'
        ? 'Close — worth another look.'
        : 'Not quite —')
  const headTone =
    feedback?.verdict === 'pass'
      ? 'text-olive'
      : feedback?.verdict === 'close'
        ? 'text-ink-mid'
        : 'text-fig'

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: '100%' }}
          animate={reduced ? { opacity: 1 } : { y: 0 }}
          exit={reduced ? { opacity: 0 } : { y: '100%' }}
          transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 400, damping: 30 }}
          className={`fixed inset-x-0 bottom-0 z-50 ${tone} border-t border-line backdrop-blur`}
        >
          <div className="mx-auto max-w-[40rem] px-5 py-4" role="status" aria-live="polite">
            <p className={`font-medium ${headTone}`}>{headText}</p>
            {feedback.item && (
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span lang="ja" className="font-jp text-xl leading-[1.4] text-ink">
                  {feedback.item.furigana ? (
                    <ruby>
                      {feedback.item.jp}
                      <rt className="text-[50%] text-ink-soft">{feedback.item.furigana}</rt>
                    </ruby>
                  ) : (
                    feedback.item.jp
                  )}
                </span>
                <span className="text-sm italic text-ink-soft">{feedback.item.romaji}</span>
                <span className="text-sm text-ink-mid">{feedback.item.en}</span>
              </div>
            )}
            {feedback.verdict !== 'pass' && feedback.given && (
              <p className="mt-1 text-sm text-ink-soft">You offered: “{feedback.given}”</p>
            )}
            {feedback.verdict !== 'pass' && feedback.item && (
              <p className="mt-1 text-sm text-ink-soft">
                <InlineReplay text={feedback.item.jp} />
              </p>
            )}
            {feedback.slowLane && (
              <p className="mt-1 text-sm text-ink-soft">
                We shall take that one again slowly, then keep it warm.
              </p>
            )}
            <button
              type="button"
              autoFocus
              onClick={onContinue}
              className="mt-3 w-full rounded-lg bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay-deep"
            >
              Continue
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ----------------------------- score screen ------------------------------ */

function ScoreScreen({
  title,
  score,
  outcome,
  reducedMotion,
  onDone,
}: {
  title: string
  score: number
  outcome: LessonCompleteResponse
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
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
          Lesson complete
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{title}</h2>

        <p className="mt-8 font-mono text-[56px] leading-none text-ink">{score}</p>
        <p className="mt-1 text-sm text-ink-soft">out of 100</p>

        <div className="mt-6 flex gap-3" aria-label={`${outcome.stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={reducedMotion ? { opacity: 0 } : { scale: 0 }}
              animate={
                i < outcome.stars
                  ? reducedMotion
                    ? { opacity: 1 }
                    : { scale: 1 }
                  : reducedMotion
                    ? { opacity: 0.3 }
                    : { scale: 1 }
              }
              transition={
                reducedMotion
                  ? { duration: 0.15 }
                  : { type: 'spring', stiffness: 400, damping: 20, delay: 0.2 + i * 0.08 }
              }
              className="inline-flex"
            >
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>
                <path
                  d="M12 3.2 14.7 9l6.1.6-4.6 4.1 1.3 6-5.5-3.2L6.5 19.7l1.3-6L3.2 9.6 9.3 9Z"
                  className={i < outcome.stars ? 'fill-clay' : 'fill-paper-deep'}
                />
              </svg>
            </motion.span>
          ))}
        </div>

        <p className="mt-8 font-mono text-sm tracking-[0.08em] text-ink-mid">
          +{xpShown} XP
          {outcome.streak.current > 0 && <span className="ml-3">STREAK {outcome.streak.current}</span>}
        </p>

        {outcome.path.unit_completed && (
          <p className="mt-4 font-serif text-base text-ink-mid">
            That closes the unit — the torii gate is open.
          </p>
        )}
        {outcome.leveled_items.some((l) => l.strength >= 3) && (
          <p className="mt-2 text-sm text-ink-soft">
            {outcome.leveled_items.filter((l) => l.strength >= 3).length} of today’s phrases are
            now solidly yours.
          </p>
        )}

        <button
          type="button"
          onClick={onDone}
          className="mt-10 w-full rounded-lg bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay-deep"
        >
          Back to the path
        </button>
      </div>
    </div>
  )
}
