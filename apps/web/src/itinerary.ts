// A day-by-day schedule mirror, day → {city, leg} only (docs/DESIGN.md's
// household-safe convention: no real names, no bookings, no cost data — just
// which city the day falls in). Ported from the household's own trip
// dashboard (Dev/Japan_website, `itineraryDays.ts`) — that repo is the
// source of truth for the actual schedule; this file exists so Michi's
// Phrasebook can surface "today's" relevant phrases without Michi taking a
// live dependency on another app's Supabase project. Update by hand if the
// household's real schedule changes (rare — this is a fixed 14-day trip).
//
// `trip_date` (Settings) is day 1. If the real date falls outside days
// 1–14, there's no "today" to surface — PhrasebookPage quietly omits the
// section rather than showing something stale or wrong.

export type TripLeg = 'Tokyo' | 'Fuji' | 'Hiroshima' | 'Osaka' | 'Kyoto' | 'Home'

export interface ItineraryDay {
  day: number // 1-14
  city: string // display label, e.g. 'Mt. Fuji / Hakone'
  leg: TripLeg
}

export const ITINERARY_DAYS: ItineraryDay[] = [
  { day: 1, city: 'Tokyo', leg: 'Tokyo' },
  { day: 2, city: 'Tokyo', leg: 'Tokyo' },
  { day: 3, city: 'Tokyo', leg: 'Tokyo' },
  { day: 4, city: 'Mt. Fuji / Hakone', leg: 'Fuji' },
  { day: 5, city: 'Mt. Fuji / Hakone', leg: 'Fuji' },
  { day: 6, city: 'Mt. Fuji / Hakone', leg: 'Fuji' },
  { day: 7, city: 'Hiroshima', leg: 'Hiroshima' },
  { day: 8, city: 'Hiroshima', leg: 'Hiroshima' },
  { day: 9, city: 'Osaka', leg: 'Osaka' },
  { day: 10, city: 'Osaka', leg: 'Osaka' },
  { day: 11, city: 'Kyoto', leg: 'Kyoto' },
  { day: 12, city: 'Kyoto', leg: 'Kyoto' },
  { day: 13, city: 'Tokyo', leg: 'Tokyo' },
  { day: 14, city: 'Homeward bound', leg: 'Home' },
]

// Which phrasebook tags (content/units/*.json's `tags`) matter most for each
// leg of the trip. Deliberately a handful, not exhaustive — this drives a
// "today's phrases" shortlist, not a full re-filter.
const LEG_TAGS: Record<TripLeg, string[]> = {
  Tokyo: ['transport', 'direction', 'shopping', 'food'],
  Fuji: ['transport', 'direction', 'hotel', 'culture'],
  Hiroshima: ['direction', 'culture', 'food'],
  Osaka: ['food', 'shopping', 'transport'],
  Kyoto: ['culture', 'direction', 'politeness'],
  Home: ['transport'],
}

/** Today's day-in-trip (1-14), or null if trip_date is unset or today falls
 * outside the 14-day window (before departure or after return). */
export function currentTripDay(tripDate: string): number | null {
  const start = new Date(`${tripDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const today = new Date()
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayIndex = Math.round((todayMidnight.getTime() - startMidnight.getTime()) / 86_400_000) + 1
  return dayIndex >= 1 && dayIndex <= ITINERARY_DAYS.length ? dayIndex : null
}

export function itineraryDay(dayIndex: number): ItineraryDay | undefined {
  return ITINERARY_DAYS.find((d) => d.day === dayIndex)
}

export function tagsForLeg(leg: TripLeg): string[] {
  return LEG_TAGS[leg]
}
