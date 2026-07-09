// Data layer for the Path and Stats surfaces (docs/API.md curriculum + stats).
// `?mock` on the URL fabricates a mid-course snapshot CLIENT-SIDE ONLY so the
// scene can be seen fully dressed before the lesson engine (phase 3) writes
// real progress. Mock mode never touches the server and shows a banner chip.

import { get, post } from './api'
import type { KitsuneTone } from './components/AnimatedKitsune'

export type LessonState = 'done' | 'current' | 'available' | 'locked'

export interface PathLesson {
  id: string
  title: string
  kind: 'teach' | 'checkpoint'
  state: LessonState
  stars: number
  best_score?: number | null
}

export interface PathUnit {
  id: string
  title: string
  kicker: string
  summary: string
  landmark: string
  authored: boolean
  lessons: PathLesson[]
}

export interface PathManifest {
  course: string
  units: PathUnit[]
  kana_trail: Record<string, { id: string; state: string; stars: number }[]>
  summit: { trip_ready_pct: number; days_to_trip: number }
  partner: { display_name: string; current_lesson_id: string | null; words_known: number; tone: KitsuneTone } | null
}

export interface StatsMe {
  streak: { current: number; rest_day_used: boolean }
  words_known: number
  minutes_total: number
  xp_week: { date: string; xp: number }[]
  daily_goal_xp: number
  accuracy_recent: number | null
  strength_bands: Record<string, number>
  forecast: { date: string; due: number }[]
  trip_ready_pct: number
}

export interface Household {
  partners: {
    user_id: number
    is_me: boolean
    display_name: string
    tone: KitsuneTone
    streak: number
    words_known: number
    current_lesson_id: string | null
    current_unit_title: string | null
  }[]
  together_phrases: number
  /** A calm "thinking of you" poke from your partner, if unseen and less
   * than a day old (docs/CURRICULUM.md §8: never a guilt mechanic). */
  pending_nudge: { id: number; from_display_name: string; created_at: string } | null
}

export const isMockMode = () =>
  new URLSearchParams(window.location.search).has('mock')

export async function fetchManifest(): Promise<PathManifest> {
  const m = await get<PathManifest>('/api/curriculum/manifest')
  return isMockMode() ? mockManifest(m) : m
}

export async function fetchStatsMe(): Promise<StatsMe> {
  const s = await get<StatsMe>('/api/stats/me')
  return isMockMode() ? mockStats(s) : s
}

export async function fetchHousehold(): Promise<Household> {
  const h = await get<Household>('/api/stats/household')
  return isMockMode() ? mockHousehold(h) : h
}

/** Sends a nudge to your partner — a no-op (server-side cooldown) if you
 * already nudged them recently, so double-tapping never spams them. */
export function sendNudge(): Promise<{ sent: boolean; to_display_name?: string }> {
  return post('/api/stats/nudge', {})
}

export function dismissNudge(): Promise<{ ok: boolean }> {
  return post('/api/stats/nudge/dismiss', {})
}

/* ---------------------------- mock dressing ---------------------------- */

function mockManifest(real: PathManifest): PathManifest {
  const starCycle = [3, 2, 3, 3, 2, 3]
  const units = real.units.map((u, ui) => {
    const lessons = u.lessons.map((l, li): PathLesson => {
      if (ui < 3) return { ...l, state: 'done', stars: starCycle[li % 6], best_score: 84 }
      if (ui === 3) {
        if (li < 2) return { ...l, state: 'done', stars: li === 0 ? 3 : 2, best_score: 88 }
        if (li === 2) return { ...l, state: 'current', stars: 0 }
        return { ...l, state: 'locked', stars: 0 }
      }
      return { ...l, state: 'locked', stars: 0 }
    })
    return { ...u, lessons }
  })
  return {
    ...real,
    units,
    kana_trail: Object.fromEntries(
      Object.entries(real.kana_trail).map(([trail, ls]) => [
        trail,
        ls.map((l, i) =>
          trail === 'hiragana' && i < 6 ? { ...l, state: 'done', stars: 3 } : l,
        ),
      ]),
    ),
    summit: { ...real.summit, trip_ready_pct: 38 },
    partner: {
      display_name: real.partner?.display_name ?? 'Garfield',
      current_lesson_id: 'u05.l2',
      words_known: 148,
      tone: real.partner?.tone ?? 'sky',
    },
  }
}

function mockStats(real: StatsMe): StatsMe {
  return {
    ...real,
    streak: { current: 12, rest_day_used: true },
    words_known: 132,
    minutes_total: 342,
    xp_week: real.xp_week.map((d, i) => ({ ...d, xp: [42, 35, 0, 51, 38, 20, 12][i] })),
    accuracy_recent: 86,
    strength_bands: { '0': 210, '1': 38, '2': 44, '3': 96, '4': 36 },
    forecast: real.forecast.map((f, i) => ({ ...f, due: [14, 9, 12, 4, 7, 2, 5][i] })),
    trip_ready_pct: 38,
  }
}

function mockHousehold(real: Household): Household {
  const partners =
    real.partners.length >= 2
      ? real.partners
      : [
          ...real.partners,
          {
            user_id: -1,
            is_me: false,
            display_name: 'Garfield',
            tone: 'sky' as const,
            streak: 0,
            words_known: 0,
            current_lesson_id: null,
            current_unit_title: null,
          },
        ]
  return {
    partners: partners.map((p, i) => ({
      ...p,
      streak: i === 0 ? 12 : 9,
      words_known: i === 0 ? 132 : 148,
      current_unit_title: i === 0 ? 'Ordering food' : 'Trains & transport',
      current_lesson_id: i === 0 ? 'u04.l3' : 'u05.l2',
    })),
    together_phrases: 214,
    pending_nudge: real.pending_nudge,
  }
}
