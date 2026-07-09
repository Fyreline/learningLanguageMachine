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

// A save failure used to die silently once its originating page unmounted
// (App.tsx only mounts the active tab, and SettingsPage's own saveError
// state goes with it the moment you tap away — e.g. picking a colour then
// immediately switching to Path to look at it). The UI had already applied
// the optimistic value, so it read as "worked" until the value reverted on
// the next real load, with no error ever shown. This channel is independent
// of any one page's lifecycle so a failure stays visible — and retryable —
// no matter where the learner navigates to next.
let lastError: string | null = null
let lastFailedPatch: UserSettings | null = null
const errorListeners = new Set<Listener>()

function notifyError() {
  errorListeners.forEach((l) => l())
}

export function subscribeSettingsError(listener: Listener): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

export function getSettingsError(): string | null {
  return lastError
}

export function dismissSettingsError(): void {
  lastError = null
  lastFailedPatch = null
  notifyError()
}

export async function retrySettingsPatch(): Promise<void> {
  const patch = lastFailedPatch
  if (!patch) return
  await patchSettings(patch)
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
 * the local value stays the learner's last choice rather than snapping back
 * mid-interaction. Failures go through the module-level error channel above
 * (not just the calling page's own state) so they stay visible and retryable
 * even after navigating away. */
export async function patchSettings(patch: UserSettings): Promise<Required<UserSettings>> {
  current = { ...current, ...patch }
  notify()
  try {
    const res = await api.updateSettings(patch)
    current = res.settings
    lastError = null
    lastFailedPatch = null
    notify()
    notifyError()
    return getSettings()
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Could not save that just now'
    lastFailedPatch = patch
    notifyError()
    throw e
  }
}

/** React hook: live settings, re-rendering on every patch. */
export function useSettings(): Required<UserSettings> {
  const [snapshot, setSnapshot] = useState(getSettings())
  useEffect(() => subscribeSettings(() => setSnapshot(getSettings())), [])
  return snapshot
}

/** React hook: the last save failure, if any — survives navigating away from
 * whichever page triggered it (see the error channel above). */
export function useSettingsError(): string | null {
  const [error, setError] = useState(getSettingsError())
  useEffect(() => subscribeSettingsError(() => setError(getSettingsError())), [])
  return error
}
