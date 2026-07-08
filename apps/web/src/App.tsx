import { useCallback, useEffect, useState } from 'react'
import { bootstrap, getUser, logout, subscribe, type AuthUser } from './auth'
import { fetchReviewsDue } from './curriculum/loader'
import { loadSettings } from './settings'
import { LoginScreen } from './components/LoginScreen'
import { MichiMark } from './components/MichiMark'
import { PathPage } from './components/PathPage'
import { PhrasebookPage } from './components/PhrasebookPage'
import { PlacementProbe } from './components/PlacementProbe'
import { PracticePage } from './components/PracticePage'
import { SettingsPage } from './components/SettingsPage'
import { StatsPage } from './components/StatsPage'
import { ThemeToggle } from './components/ThemeToggle'

type Tab = 'path' | 'practice' | 'phrasebook' | 'stats' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'path', label: 'Path' },
  { id: 'practice', label: 'Practice' },
  { id: 'phrasebook', label: 'Phrasebook' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
]

/** Small inline paw-print glyph for the streak pill (docs/DESIGN.md §3) —
 * flame-anxiety copy and imagery are banned per CURRICULUM.md §8. */
function PawPrint({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <ellipse cx="10" cy="14" rx="4.4" ry="3.6" fill="currentColor" />
      <ellipse cx="5" cy="7.5" rx="1.7" ry="2.2" fill="currentColor" />
      <ellipse cx="9.2" cy="5.2" rx="1.7" ry="2.2" fill="currentColor" />
      <ellipse cx="13.6" cy="6" rx="1.7" ry="2.2" fill="currentColor" />
      <ellipse cx="16.3" cy="9.5" rx="1.6" ry="2" fill="currentColor" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
      <path
        d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M13 13.5 16.5 10 13 6.5M7 10h9.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => logout()}
      aria-label="Sign out"
      title="Sign out"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-white text-ink-mid transition hover:bg-oat hover:text-ink dark:bg-paper-mid"
    >
      <SignOutIcon />
    </button>
  )
}

function TabIcon({ tab }: { tab: Tab }) {
  // One small glyph per tab, deliberately flat and monochrome (currentColor)
  // so the active-state colour swap (docs/DESIGN.md §3) is the only signal.
  switch (tab) {
    case 'path':
      return (
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
          <path
            d="M4,17 Q6,10 10,10 Q14,10 16,3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'practice':
      return (
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
          <path
            d="M4 10a6 6 0 1 1 1.8 4.3M4 10v4M4 10h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'phrasebook':
      return (
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
          <path
            d="M4 4h8a3 3 0 0 1 3 3v9a2.5 2.5 0 0 0-2.5-1.5H4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'stats':
      return (
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
          <path
            d="M4.5 16V11M10 16V6M15.5 16v-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 20 20" aria-hidden className="h-5 w-5">
          <path
            d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M16.3 11.2c.04-.4.07-.8.07-1.2s-.03-.8-.07-1.2l1.4-1.1a.6.6 0 0 0 .14-.77l-1.33-2.3a.6.6 0 0 0-.73-.26l-1.65.66a5.6 5.6 0 0 0-1.04-.6l-.25-1.75a.6.6 0 0 0-.6-.5H8.76a.6.6 0 0 0-.6.5l-.25 1.75c-.37.15-.72.35-1.04.6l-1.65-.66a.6.6 0 0 0-.73.26L3.16 6.9a.6.6 0 0 0 .14.77l1.4 1.1c-.04.4-.07.8-.07 1.2s.03.8.07 1.2l-1.4 1.1a.6.6 0 0 0-.14.77l1.33 2.3c.15.26.46.36.73.26l1.65-.66c.32.25.67.45 1.04.6l.25 1.75c.05.3.3.5.6.5h2.66c.3 0 .55-.2.6-.5l.25-1.75c.37-.15.72-.35 1.04-.6l1.65.66c.27.1.58 0 .73-.26l1.33-2.3a.6.6 0 0 0-.14-.77l-1.4-1.1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

/** Gates the whole app behind the household login (docs/AUTH.md).
 * `bootstrap()` tries a silent refresh from a stored refresh token on first
 * mount so a page reload doesn't force a re-login; `subscribe()` re-renders
 * this the moment auth state changes. */
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribe(() => setUser(getUser()))
    bootstrap().finally(() => {
      setUser(getUser())
      setReady(true)
    })
    return unsubscribe
  }, [])

  if (!ready) {
    return <div className="min-h-full bg-paper" />
  }
  if (!user) {
    return <LoginScreen onLoggedIn={() => setUser(getUser())} />
  }
  return <AuthenticatedApp user={user} />
}

/** Clay due-review pill (CURRICULUM §6: "an invitation, never a guilt trip
 * — no red, cap display at 20+"). Renders nothing at zero. */
function DueBadge({ count, className = '' }: { count: number | null; className?: string }) {
  if (!count) return null
  return (
    <span
      aria-label={`${count} review${count === 1 ? '' : 's'} due`}
      className={`rounded-full bg-clay/15 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-clay ${className}`}
    >
      {count > 20 ? '20+' : count}
    </span>
  )
}

function AuthenticatedApp({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<Tab>('path')
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [settingsReady, setSettingsReady] = useState(false)
  const [showPlacement, setShowPlacement] = useState(false)
  const [pathVersion, setPathVersion] = useState(0)

  useEffect(() => {
    loadSettings().then(
      (s) => {
        setSettingsReady(true)
        setShowPlacement(!s.placement_done)
      },
      () => setSettingsReady(true), // fail open — no offer if settings can't load
    )
  }, [])

  const refreshDueCount = useCallback(() => {
    fetchReviewsDue().then((d) => setDueCount(d.counts.today), () => undefined)
  }, [])

  useEffect(() => {
    refreshDueCount()
    const id = setInterval(refreshDueCount, 60_000)
    return () => clearInterval(id)
  }, [refreshDueCount])

  useEffect(() => {
    refreshDueCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <MichiMark className="h-8 w-9" />
            <span className="font-display text-lg font-medium tracking-[-0.005em]">
              Michi <span className="text-clay">道</span>
            </span>
          </div>

          <nav className="hidden items-center gap-1 sm:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-b-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'text-ink border-b-2 border-clay'
                    : 'text-ink-mid hover:bg-oat'
                }`}
              >
                {t.label}
                {t.id === 'practice' && <DueBadge count={dueCount} />}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-clay"
              title="Day streak"
            >
              <PawPrint />0
            </span>
            <ThemeToggle />
            <span
              aria-label={user.display_name}
              title={user.display_name}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-clay text-xs font-medium text-paper"
            >
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24 pt-8 sm:pb-10">
        {tab === 'path' && <PathPage key={pathVersion} />}
        {tab === 'practice' && <PracticePage />}
        {tab === 'phrasebook' && <PhrasebookPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      {/* Mobile bottom bar — 64px tall, safe-area padded (docs/DESIGN.md §3). */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
              tab === t.id ? 'text-clay' : 'text-ink-soft'
            }`}
          >
            <span className="relative inline-flex">
              <TabIcon tab={t.id} />
              {t.id === 'practice' && dueCount ? (
                <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-clay" aria-hidden />
              ) : null}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {settingsReady && showPlacement && (
        <PlacementProbe
          onDone={() => {
            setShowPlacement(false)
            setPathVersion((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}
