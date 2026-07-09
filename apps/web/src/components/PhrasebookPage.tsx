/** Every item learned so far, browsable and searchable (docs/phases/
 * PHASE-4-practice.md §3). Backed by the Phase-4 item bank endpoint (works
 * "offline-ish" once loaded — one fetch, then everything is client-side
 * filtering); unit titles come from the already-fetched course manifest. */
import { useEffect, useMemo, useState } from 'react'
import { fetchAllItems } from '../curriculum/loader'
import type { BankItem } from '../curriculum/types'
import { fetchManifest } from '../pathData'
import { speak } from '../audio/tts'
import { getSettings, useSettings } from '../settings'
import { currentTripDay, itineraryDay, tagsForLeg } from '../itinerary'

const STRENGTH_DOT = ['bg-cloud', 'bg-kraft', 'bg-oat border border-line-strong', 'bg-olive', 'bg-clay']
const STRENGTH_LABEL = ['new', 'seen', 'learning', 'known', 'strong']

function matchesQuery(item: BankItem, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return (
    item.jp.includes(query.trim()) ||
    item.romaji.toLowerCase().includes(q) ||
    item.en.toLowerCase().includes(q)
  )
}

export function PhrasebookPage() {
  const [items, setItems] = useState<BankItem[] | null>(null)
  const [unitTitles, setUnitTitles] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const { trip_date } = useSettings()

  useEffect(() => {
    fetchAllItems().then(setItems, (e) => setError(e.message))
    fetchManifest().then(
      (m) => setUnitTitles(Object.fromEntries(m.units.map((u) => [u.id, u.title]))),
      () => undefined,
    )
  }, [])

  const phrases = useMemo(() => (items ?? []).filter((i) => /^u\d+$/.test(i.unit ?? '')), [items])

  const tags = useMemo(() => {
    const s = new Set<string>()
    for (const i of phrases) for (const t of i.tags) s.add(t)
    return [...s].sort()
  }, [phrases])

  const filtered = useMemo(
    () =>
      phrases.filter(
        (i) => matchesQuery(i, query) && (activeTag === null || i.tags.includes(activeTag)),
      ),
    [phrases, query, activeTag],
  )

  const tripCore = useMemo(() => filtered.filter((i) => i.trip_core), [filtered])

  // "Today" per the trip's day-by-day schedule (docs/DESIGN.md household-safe
  // convention — city/leg only). Quietly absent outside the 14-day window
  // (before departure, or once home) rather than showing something stale.
  const today = useMemo(() => {
    const dayIndex = currentTripDay(trip_date)
    if (dayIndex === null) return null
    const day = itineraryDay(dayIndex)
    if (!day) return null
    const tags = tagsForLeg(day.leg)
    const matches = phrases.filter((i) => i.tags.some((t) => tags.includes(t)))
    // trip-core first (the must-not-fumble set), then whatever else matches
    matches.sort((a, b) => Number(!!b.trip_core) - Number(!!a.trip_core))
    return { city: day.city, items: matches.slice(0, 8) }
  }, [phrases, trip_date])

  const byUnit = useMemo(() => {
    const groups = new Map<string, BankItem[]>()
    for (const item of filtered) {
      const unit = item.unit ?? 'other'
      if (!groups.has(unit)) groups.set(unit, [])
      groups.get(unit)!.push(item)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  if (error) {
    return <p className="mx-auto max-w-2xl pt-16 text-center text-sm text-ink-soft">{error}</p>
  }
  if (!items) {
    return (
      <div className="mx-auto max-w-2xl pt-16 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">
        OPENING THE PHRASEBOOK…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium text-ink">Phrasebook</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything in the course — search, filter, or just browse.</p>

      <div className="mt-5">
        <label htmlFor="phrasebook-search" className="sr-only">
          Search the phrasebook
        </label>
        <input
          id="phrasebook-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — jp, romaji, or English"
          className="min-h-11 w-full rounded-md border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-cloud outline-none focus:border-clay dark:bg-paper-mid"
        />
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          <TagChip label="All" active={activeTag === null} onClick={() => setActiveTag(null)} />
          {tags.map((t) => (
            <TagChip key={t} label={t} active={activeTag === t} onClick={() => setActiveTag(t)} />
          ))}
        </div>
      )}

      {today && today.items.length > 0 && !query && activeTag === null && (
        <section className="mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">Today in {today.city}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Phrases that tend to come up here.</p>
          <ItemList items={today.items} />
        </section>
      )}

      {tripCore.length > 0 && !query && activeTag === null && (
        <section className="mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">The 120 that matter</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Trip-core — the must-not-fumble set.</p>
          <ItemList items={tripCore} />
        </section>
      )}

      {byUnit.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-soft">Nothing matches — try another word.</p>
      )}

      {byUnit.map(([unit, unitItems]) => (
        <section key={unit} className="mt-6">
          <h2 className="font-display text-sm font-semibold text-ink">
            {unitTitles[unit] ?? unit}{' '}
            <span className="font-mono text-[11px] font-normal tracking-[0.08em] text-ink-soft">
              {unit.toUpperCase()}
            </span>
          </h2>
          <ItemList items={unitItems} />
        </section>
      ))}
    </div>
  )
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-clay bg-clay/15 text-clay'
          : 'border-line-strong text-ink-mid hover:bg-oat'
      }`}
    >
      {label}
    </button>
  )
}

function ItemList({ items }: { items: BankItem[] }) {
  return (
    <div className="mt-2 divide-y divide-line rounded-lg border border-line bg-paper-mid">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => void speak(item.jp, { rate: getSettings().tts_rate })}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-oat"
        >
          <span
            aria-label={`Strength: ${STRENGTH_LABEL[item.strength] ?? 'new'}`}
            title={STRENGTH_LABEL[item.strength] ?? 'new'}
            className={`h-2 w-2 shrink-0 rounded-full ${STRENGTH_DOT[item.strength] ?? STRENGTH_DOT[0]}`}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span lang="ja" className="font-jp text-lg leading-[1.4] text-ink">
                {item.furigana ? (
                  <ruby>
                    {item.jp}
                    <rt className="text-[50%] text-ink-soft">{item.furigana}</rt>
                  </ruby>
                ) : (
                  item.jp
                )}
              </span>
              <span className="text-xs italic text-ink-soft">{item.romaji}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-mid">{item.en}</span>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden width="18" height="18" className="shrink-0 text-ink-soft">
            <path d="M4 9.5v5h3.4l4.1 3.6V5.9L7.4 9.5H4Z" fill="currentColor" />
            <path
              d="M14.5 8.6a4.4 4.4 0 0 1 0 6.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ))}
    </div>
  )
}
