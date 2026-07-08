/** The travel journal (docs/DESIGN.md §6): hero stat tiles, the week's XP
 * bars, the strength garden, the review-forecast sparkline, and the
 * travel-buddies panel. All charts are hand-rolled SVG — no chart library,
 * per the acceptance criteria. Kind by design: no negative-coloured deltas,
 * no leaderboard framing, streaks may rest one day a week. */

import { useEffect, useState } from 'react'
import {
  fetchHousehold,
  fetchStatsMe,
  isMockMode,
  type Household,
  type StatsMe,
} from '../pathData'
import { PALETTE } from './AnimatedKitsune'

const BAND_LABEL = ['New', 'Seen', 'Learning', 'Known', 'Strong']
const BAND_DOT = ['bg-cloud', 'bg-kraft', 'bg-oat border border-line-strong', 'bg-olive', 'bg-clay']

function Tile({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper-mid p-5 text-center">
      <p className="font-mono text-[34px] leading-none text-ink">{big}</p>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">{label}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  )
}

function WeekChart({ stats }: { stats: StatsMe }) {
  const H = 96
  const max = Math.max(stats.daily_goal_xp, ...stats.xp_week.map((d) => d.xp), 1)
  const goalY = H - (stats.daily_goal_xp / max) * H
  return (
    <svg viewBox={`0 0 308 ${H + 22}`} className="w-full" aria-label="XP this week">
      {stats.xp_week.map((d, i) => {
        const h = Math.max(3, (d.xp / max) * H)
        const today = i === stats.xp_week.length - 1
        return (
          <g key={d.date}>
            <rect
              x={8 + i * 44}
              y={H - h}
              width="28"
              height={h}
              rx="3"
              className={d.xp === 0 ? 'fill-paper-deep' : today ? 'fill-clay-deep' : 'fill-clay'}
            />
            <text x={22 + i * 44} y={H + 16} textAnchor="middle" className="fill-ink-soft" style={{ font: '10px var(--font-mono)' }}>
              {'MTWTFSS'[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1]}
            </text>
          </g>
        )
      })}
      <line x1="4" x2="304" y1={goalY} y2={goalY} strokeDasharray="4 4" strokeWidth="1.5" className="stroke-olive" />
    </svg>
  )
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsMe | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatsMe().then(setStats, (e) => setError(e.message))
    fetchHousehold().then(setHousehold, () => undefined)
  }, [])

  if (error) {
    return <p className="pt-16 text-center text-sm text-ink-soft">{error}</p>
  }
  if (!stats) {
    return <div className="pt-16 text-center font-mono text-xs tracking-[0.08em] text-ink-soft">OPENING THE JOURNAL…</div>
  }

  const nothingYet = stats.words_known === 0 && stats.xp_week.every((d) => d.xp === 0)
  const totalItems = Object.values(stats.strength_bands).reduce((a, b) => a + b, 0)
  const dueToday = stats.forecast[0]?.due ?? 0
  const maxDue = Math.max(...stats.forecast.map((f) => f.due), 1)

  return (
    <div className="mx-auto max-w-2xl">
      {isMockMode() && (
        <p className="mb-4 text-center">
          <span className="rounded-full bg-oat px-3 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-mid">
            PREVIEW DATA — remove ?mock for your real journal
          </span>
        </p>
      )}
      <h1 className="font-display text-2xl font-medium text-ink">The journal</h1>

      {nothingYet ? (
        <p className="mt-10 text-center font-serif text-xl leading-relaxed text-ink">
          Blank pages, for now.
          <br />
          <span className="text-base text-ink-soft">The first lesson writes the first line.</span>
        </p>
      ) : (
        <>
          {/* hero tiles */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Tile
              big={String(stats.streak.current)}
              label="day streak"
              sub={stats.streak.current === 0 ? 'streak resting' : stats.streak.rest_day_used ? 'rest day used' : 'rest day in hand'}
            />
            <Tile big={String(stats.words_known)} label="words & phrases" />
            <Tile big={String(Math.round(stats.minutes_total))} label="minutes practiced" />
          </div>

          {/* the week */}
          <div className="mt-4 rounded-lg border border-line bg-paper-mid p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold">The week</h2>
              <p className="font-mono text-[11px] tracking-[0.08em] text-ink-soft">
                GOAL {stats.daily_goal_xp} XP{stats.accuracy_recent !== null && <> · ACCURACY {stats.accuracy_recent}%</>}
              </p>
            </div>
            <div className="mt-3">
              <WeekChart stats={stats} />
            </div>
          </div>

          {/* strength garden */}
          <div className="mt-4 rounded-lg border border-line bg-paper-mid p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold">Strength garden</h2>
              <p className="font-mono text-[11px] tracking-[0.08em] text-ink-soft">
                {dueToday > 0 ? `REVIEWS WATER THEM — ${dueToday} DUE TODAY` : 'NOTHING DUE TODAY'}
              </p>
            </div>
            <div className="mt-4 space-y-2.5">
              {[4, 3, 2, 1, 0].map((band) => {
                const n = stats.strength_bands[String(band)] ?? 0
                return (
                  <div key={band} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-ink-soft">{BAND_LABEL[band]}</span>
                    <span className="w-10 shrink-0 text-right font-mono text-xs text-ink">{n}</span>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {Array.from({ length: Math.min(n, 48) }, (_, i) => (
                        <span key={i} className={`h-2 w-2 rounded-full ${BAND_DOT[band]}`} />
                      ))}
                      {n > 48 && <span className="font-mono text-[10px] text-ink-soft">+{n - 48}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {totalItems > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">Next 7 days of reviews</p>
                <div className="flex items-end gap-1.5">
                  {stats.forecast.map((f) => (
                    <div key={f.date} className="flex flex-col items-center gap-1">
                      <div className="w-6 rounded-sm bg-sky/70" style={{ height: `${4 + (f.due / maxDue) * 28}px` }} />
                      <span className="font-mono text-[9px] text-ink-soft">{f.due}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* travel buddies — cooperative, always shown */}
      {household && household.partners.length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-paper-mid p-5">
          <h2 className="font-display text-sm font-semibold">Travel buddies</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {household.partners.map((p) => (
              <div key={p.display_name} className="flex items-center gap-3 rounded-md border border-line bg-paper p-3.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-paper"
                  style={{ backgroundColor: PALETTE[p.tone].body }}
                >
                  {p.display_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{p.display_name}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {p.current_unit_title ? `${p.current_unit_title} · ` : ''}
                    {p.words_known} phrases · {p.streak}-day streak
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center font-serif text-sm text-ink">
            Together you know {household.together_phrases} phrases.
          </p>
        </div>
      )}
    </div>
  )
}
