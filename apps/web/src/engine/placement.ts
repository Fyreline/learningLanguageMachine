// Onboarding placement probe adaptivity (docs/CURRICULUM.md §5): "binary-
// search-ish — start at unit 1 basics, jump forward on streaks of 3." Pure
// state machine, no React/network — vitest-coverable, mirroring
// engine/session.ts's LessonSession split between pure logic and the
// component that drives it (PlacementProbe.tsx).

export class PlacementProbeRunner {
  private readonly pool: readonly string[] // item ids, easy -> hard
  private pointer = 0
  private streak = 0
  private stepCount = 0
  private readonly known = new Set<string>()
  readonly maxSteps: number

  constructor(pool: readonly string[], maxSteps = 12) {
    this.pool = pool
    this.maxSteps = maxSteps
  }

  get current(): string | null {
    if (this.stepCount >= this.maxSteps) return null
    if (this.pointer >= this.pool.length) return null
    return this.pool[this.pointer]
  }

  get finished(): boolean {
    return this.current === null
  }

  get stepNumber(): number {
    return this.stepCount + 1
  }

  get progress(): number {
    return this.maxSteps === 0 ? 1 : this.stepCount / this.maxSteps
  }

  /** Records the current item's result and advances the pointer — forward
   * by one normally, or by a bigger jump the moment a 3-correct streak
   * lands (the "binary-search-ish" behaviour CURRICULUM §5 asks for). */
  answer(correct: boolean): void {
    const item = this.current
    if (item === null) return
    this.stepCount += 1
    if (correct) {
      this.known.add(item)
      this.streak += 1
      if (this.streak >= 3) {
        const remaining = this.pool.length - 1 - this.pointer
        const jump = Math.max(3, Math.floor(remaining / 4))
        this.pointer = Math.min(this.pool.length - 1, this.pointer + jump)
        this.streak = 0
        return
      }
    } else {
      this.streak = 0
    }
    this.pointer += 1
  }

  get knownItemIds(): string[] {
    return [...this.known]
  }
}
