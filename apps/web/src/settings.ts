// User settings store (docs/API.md: PUT /api/auth/settings is a merge-patch).
// Port of auth.ts's plain-module + subscribe pattern so any component —
// exercise chrome included — can read the live value without prop-drilling
// it through LessonPlayer/ReviewPlayer/PlacementProbe. Loaded once at
// bootstrap (App.tsx); components that render before it resolves just see
// sane defaults, which is safe (rate 1, romaji shown, auto STT).

import { useEffect, useState } from 'react'
import { api, type UserSettings } from './api'

export type { UserSettings }

const DEFAULTS: Required<UserSettings> = {
  romaji: 'show',
  tts_rate: 1,
  daily_goal_xp: 20,
  trip_date: '2026-09-15',
  placement_done: false,
  stt_mode: 'auto',
  kitsune_tone: 'clay',
}

let current: UserSettings = {}
let loaded = false

type Listener = () => void
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSettings(): Required<UserSettings> {
  return { ...DEFAULTS, ...current }
}

export function settingsLoaded(): boolean {
  return loaded
}

/** Called once at app bootstrap (and safe to call again — e.g. after login). */
export async function loadSettings(): Promise<Required<UserSettings>> {
  const me = await api.me()
  current = me.settings ?? {}
  loaded = true
  notify()
  return getSettings()
}

/** Optimistic local apply + server merge-patch. Reverts nothing on failure —
 * callers surface the error and may retry; the local value stays the
 * learner's last choice rather than snapping back mid-interaction. */
export async function patchSettings(patch: UserSettings): Promise<Required<UserSettings>> {
  current = { ...current, ...patch }
  notify()
  const res = await api.updateSettings(patch)
  current = res.settings
  notify()
  return getSettings()
}

/** React hook: live settings, re-rendering on every patch. */
export function useSettings(): Required<UserSettings> {
  const [snapshot, setSnapshot] = useState(getSettings())
  useEffect(() => subscribeSettings(() => setSnapshot(getSettings())), [])
  return snapshot
}
