// Hand-written mirrors of docs/CONTENT_GUIDE.md §2's content schemas, plus
// the learner-state fields GET /api/curriculum/lessons/{id} merges in
// (docs/API.md). Content ids are permanent strings — never derived.

export interface Item {
  id: string
  jp: string
  furigana?: string
  romaji: string
  en: string
  literal?: string
  note?: string
  mnemonic?: string
  tags: string[]
  trip_core?: boolean
  slots?: { pattern: string; fills: string[] }
  // learner state merged by the server:
  strength: number
  due_at: string | null
  /** true when the server picked this as a warm-up/review rider */
  review_rider: boolean
}

export type ExerciseType =
  | 'listen-pick'
  | 'listen-pick-jp'
  | 'tile-arrange'
  | 'speak'
  | 'listen-type-romaji'
  | 'match-pairs'
  | 'dialogue'
  | 'kana-glyph'

export type ContentStep =
  | { type: 'teach'; item: string }
  | {
      type: Exclude<ExerciseType, 'match-pairs' | 'dialogue'>
      item: string
      distractors?: string[]
    }
  | { type: 'match-pairs'; items: string[] }
  | { type: 'dialogue'; dialogue: string }

export interface DialogueTurnNpc {
  speaker: 'npc'
  jp: string
  furigana?: string
  romaji: string
  en: string
}

export interface DialogueTurnYou {
  speaker: 'you'
  expect_item: string
  mode: 'pick' | 'speak'
  stakes: string
}

export type DialogueTurn = DialogueTurnNpc | DialogueTurnYou

export interface Dialogue {
  id: string
  scene: string
  turns: DialogueTurn[]
}

export interface LessonContent {
  lesson: { id: string; title: string; kind: 'teach' | 'checkpoint' }
  items: Item[]
  steps: ContentStep[] | null
  dialogues: Dialogue[]
}

/** miss / close / pass / easy (docs/CURRICULUM.md §6) */
export type Grade = 0 | 1 | 2 | 3

export interface StepResult {
  item_id: string
  grade: Grade
  mode: string
}

export interface LessonCompleteResponse {
  xp_awarded: number
  stars: number
  streak: { current: number; rest_day_used: boolean }
  path: {
    next_lesson_id: string | null
    unit_completed: boolean
    trip_ready_pct: number
  }
  leveled_items: { item_id: string; strength: number }[]
}

/** GET /api/curriculum/items (Phase 4 addition, docs/API.md) — the full item
 * bank, each item tagged with its owning unit id or kana deck name. */
export interface BankItem extends Item {
  unit: string | null
}

export interface ReviewsDue {
  due: { item_id: string; strength: number; due_at: string; overdue_days: number }[]
  counts: { today: number; week: number[] }
}

export interface ReviewCompleteResponse {
  xp_awarded: number
  streak: { current: number; rest_day_used: boolean }
  next_due_counts: { today: number; week: number[] }
}
