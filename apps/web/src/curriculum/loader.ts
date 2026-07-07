// Lesson/progress/reviews data layer (docs/API.md). Owns the request bodies
// and response types; api.ts stays plumbing-only.

import { get, post } from '../api'
import type {
  LessonCompleteResponse,
  LessonContent,
  ReviewCompleteResponse,
  ReviewsDue,
  StepResult,
} from './types'

export function fetchLesson(lessonId: string): Promise<LessonContent> {
  return get<LessonContent>(`/api/curriculum/lessons/${encodeURIComponent(lessonId)}`)
}

/** The user's local calendar day — sent with every progress write so streaks
 * respect the household's timezone, not UTC (docs/DATA_MODEL.md). */
export function localDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface LessonCompletePayload {
  submission_id: string
  score: number
  duration_seconds: number
  local_date: string
  results: StepResult[]
}

export function completeLesson(
  lessonId: string,
  payload: LessonCompletePayload,
): Promise<LessonCompleteResponse> {
  return post<LessonCompleteResponse>(
    `/api/lessons/${encodeURIComponent(lessonId)}/complete`,
    payload,
  )
}

export function fetchReviewsDue(): Promise<ReviewsDue> {
  return get<ReviewsDue>('/api/reviews/due')
}

export interface ReviewCompletePayload {
  submission_id: string
  duration_seconds: number
  local_date: string
  results: StepResult[]
}

export function completeReview(payload: ReviewCompletePayload): Promise<ReviewCompleteResponse> {
  return post<ReviewCompleteResponse>('/api/reviews/complete', payload)
}

export interface PlacementCompleteResponse {
  tested_out_lessons: string[]
  path: { next_lesson_id: string | null; unit_completed: boolean; trip_ready_pct: number }
}

export function completePlacement(payload: {
  submission_id: string
  known_item_ids: string[]
  local_date: string
}): Promise<PlacementCompleteResponse> {
  return post<PlacementCompleteResponse>('/api/placement/complete', payload)
}
