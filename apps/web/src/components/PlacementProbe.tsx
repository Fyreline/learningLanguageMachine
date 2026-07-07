// Onboarding placement probe (docs/CURRICULUM.md §5, docs/phases/
// PHASE-4-practice.md §5): a calm modal offer, then (if accepted) a 12-step
// adaptive run over u01-u03 items, then POST /api/placement/complete. Skip
// sets settings.placement_done without ever calling that endpoint.
//
// Item pool: the u01-u03 teach lessons' authored items, in curriculum order
// (the manifest already lists lesson ids per unit — no hardcoded ids here).
// Reading that far ahead is normally locked; routers/curriculum.py exempts
// u01-u03 reads specifically while placement_done is false (docs/API.md).
// The probe reuses the ordinary `listen-pick` exercise component and the
// LessonPlayer's exported Takeover chrome — no new exercise mechanics.
import { useEffect, useRef, useState } from 'react'
import type { Item } from '../curriculum/types'
import { completePlacement, fetchLesson, localDate } from '../curriculum/loader'
import { fetchManifest } from '../pathData'
import { patchSettings } from '../settings'
import { shuffled } from '../engine/grading'
import { PlacementProbeRunner } from '../engine/placement'
import { Takeover } from './LessonPlayer'
import { ListenPick } from './exercises/ListenPick'
import type { ExerciseResult } from './exercises/shared'

const MAX_STEPS = 12
const PLACEMENT_UNITS = ['u01', 'u02', 'u03']

export interface PlacementProbeProps {
  onDone: () => void
}

type Phase = 'offer' | 'loading' | 'running' | 'submitting' | 'done' | 'error'

export function PlacementProbe({ onDone }: PlacementProbeProps) {
  const [phase, setPhase] = useState<Phase>('offer')
  const [, forceRender] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knownCount, setKnownCount] = useState(0)

  const poolRef = useRef<Item[]>([])
  const runnerRef = useRef<PlacementProbeRunner | null>(null)
  const submissionId = useRef(crypto.randomUUID())
  const finishingRef = useRef(false)

  async function handleSkip() {
    try {
      await patchSettings({ placement_done: true })
    } finally {
      onDone()
    }
  }

  async function handleStart() {
    setPhase('loading')
    try {
      const items = await loadProbePool()
      if (items.length === 0) {
        // No authored u01-u03 content reachable (shouldn't happen once
        // content is complete) — fail open rather than trap the learner.
        await patchSettings({ placement_done: true })
        onDone()
        return
      }
      poolRef.current = items
      runnerRef.current = new PlacementProbeRunner(items.map((i) => i.id), MAX_STEPS)
      setPhase('running')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the check')
      setPhase('error')
    }
  }

  async function finish() {
    if (finishingRef.current) return // guards double-invocation (StrictMode, the defensive RunningFallback path)
    finishingRef.current = true
    const runner = runnerRef.current
    setPhase('submitting')
    const known = runner?.knownItemIds ?? []
    setKnownCount(known.length)
    try {
      await completePlacement({
        submission_id: submissionId.current,
        known_item_ids: known,
        local_date: localDate(),
      })
    } catch {
      /* best-effort — placement_done still gets set below so the offer
       * never nags again; a failed pre-completion just means a slightly
       * less generous path than deserved, not a stuck app. */
    }
    try {
      await patchSettings({ placement_done: true })
    } finally {
      setPhase('done')
    }
  }

  function handleResult(result: ExerciseResult) {
    const runner = runnerRef.current
    if (!runner || locked) return
    setLocked(true)
    // The runner mutation (and the "is it finished" check) is deferred into
    // the same timeout as the pause itself — mutating now would advance
    // `runner.current` past the item still on screen, and React's re-render
    // for `setLocked(true)` (which happens before this timeout fires) would
    // then find no item to show and hit the RunningFallback path early.
    const correct = result.verdict === 'pass'
    setTimeout(() => {
      runner.answer(correct)
      setLocked(false)
      if (runner.finished) {
        void finish()
      } else {
        forceRender((n) => n + 1)
      }
    }, 650)
  }

  if (phase === 'offer') {
    return <OfferModal onStart={() => void handleStart()} onSkip={() => void handleSkip()} />
  }

  if (phase === 'loading') {
    return (
      <Takeover onClose={() => void handleSkip()} progress={0} closeLabel="Skip the check">
        <p className="pt-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">
          GETTING A FEEL FOR WHAT YOU KNOW…
        </p>
      </Takeover>
    )
  }

  if (phase === 'error') {
    return (
      <Takeover onClose={() => void handleSkip()} progress={0} closeLabel="Close">
        <div className="pt-24 text-center">
          <p className="font-serif text-xl text-ink">The check would not load.</p>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => void handleSkip()}
            className="mt-6 rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition hover:bg-oat"
          >
            Start from the very beginning instead
          </button>
        </div>
      </Takeover>
    )
  }

  if (phase === 'submitting') {
    return (
      <Takeover onClose={() => undefined} progress={1} closeLabel="Please wait">
        <p className="pt-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">SETTLING IN…</p>
      </Takeover>
    )
  }

  if (phase === 'done') {
    return <DoneScreen knownCount={knownCount} onContinue={onDone} />
  }

  // running
  const runner = runnerRef.current
  const currentId = runner?.current ?? null
  const item = currentId ? poolRef.current.find((i) => i.id === currentId) : null
  if (!runner || !item) {
    // Defensive only — handleResult already calls finish() the moment
    // runner.finished flips true, before this ever re-renders. Guards the
    // unreachable edge (pool shorter than maxSteps) without a side effect
    // inside render.
    return (
      <RunningFallback onSettled={() => void finish()}>
        <p className="pt-24 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">SETTLING IN…</p>
      </RunningFallback>
    )
  }
  const options = optionsFor(item, poolRef.current)

  return (
    <Takeover onClose={() => void finish()} progress={runner.progress} closeLabel="Finish the check now">
      <div className="mx-auto w-full max-w-[40rem] px-5 pt-14 sm:pt-20">
        <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
          Quick check · {runner.stepNumber} of {runner.maxSteps}
        </p>
        <ListenPick key={item.id} item={item} options={options} locked={locked} onResult={handleResult} />
      </div>
    </Takeover>
  )
}

function RunningFallback({ onSettled, children }: { onSettled: () => void; children: React.ReactNode }) {
  useEffect(() => {
    onSettled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Takeover onClose={() => undefined} progress={1} closeLabel="Please wait">
      {children}
    </Takeover>
  )
}

/* ------------------------------- offer modal ------------------------------ */

function OfferModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-5">
      <div className="w-full max-w-sm rounded-lg border border-line bg-paper p-8 text-center">
        <p className="font-serif text-xl text-ink">Know some already?</p>
        <p className="mt-3 text-sm text-ink-soft">
          A quick check — about 3 minutes, skippable any time. Anything you already know gets
          marked off, so the path starts where you actually are.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onStart}
            className="min-h-11 w-full rounded-md bg-clay py-2.5 text-sm font-medium text-paper transition hover:bg-clay-deep"
          >
            Let's find out
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 w-full rounded-md border border-line-strong py-2.5 text-sm text-ink-mid transition hover:bg-oat"
          >
            Start from the very beginning
          </button>
        </div>
      </div>
    </div>
  )
}

function DoneScreen({ knownCount, onContinue }: { knownCount: number; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper text-ink">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">All set</p>
        <p className="mt-4 font-serif text-xl text-ink">
          {knownCount > 0
            ? `${knownCount} phrase${knownCount === 1 ? '' : 's'} already stuck.`
            : 'Starting fresh — no bad thing.'}
        </p>
        <p className="mt-2 text-sm text-ink-soft">The path picks up from exactly where that leaves off.</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-10 w-full rounded-lg bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay-deep"
        >
          Onto the path
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- data ----------------------------------- */

async function loadProbePool(): Promise<Item[]> {
  const manifest = await fetchManifest()
  const teachLessonIds = manifest.units
    .filter((u) => PLACEMENT_UNITS.includes(u.id))
    .flatMap((u) => u.lessons.filter((l) => l.kind === 'teach').map((l) => l.id))

  const contents = await Promise.all(teachLessonIds.map((id) => fetchLesson(id).catch(() => null)))

  const seen = new Set<string>()
  const items: Item[] = []
  for (const content of contents) {
    if (!content) continue
    for (const item of content.items) {
      if (item.review_rider || seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }
  return items
}

function optionsFor(item: Item, pool: Item[]): Item[] {
  const distractors = shuffled(pool.filter((p) => p.id !== item.id)).slice(0, 3)
  return [item, ...distractors]
}
