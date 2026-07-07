// Fetch wrapper w/ bearer token + 401 retry — port of Mishka Hub's api.ts
// (docs/ARCHITECTURE.md §3). Phase 1 only wires the auth + health surface
// documented in docs/API.md; curriculum/progress/reviews/stats land in later
// phases and will extend the `api` object below without touching this
// request plumbing.
import { forceLogout, getValidAccessToken } from './auth'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8100'

export interface Health {
  status: string
  identity: 'reachable' | 'unreachable'
  content_version: string
}

/** Shape of `users.settings_json` (docs/DATA_MODEL.md), all optional —
 * PUT /api/auth/settings is a merge-patch. */
export interface UserSettings {
  romaji?: 'show' | 'fade' | 'hide'
  tts_rate?: number
  daily_goal_xp?: number
  trip_date?: string
  placement_done?: boolean
  stt_mode?: 'auto' | 'shadow'
}

export interface Me {
  id: number
  email: string
  display_name: string
  settings: UserSettings
}

class ApiError extends Error {
  code?: string
  status?: number
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message)
    this.name = 'ApiError'
    this.code = opts?.code
    this.status = opts?.status
  }
}

async function parseErrorBody(res: Response): Promise<{ detail: string; code?: string }> {
  let detail = `${res.status} ${res.statusText}`
  let code: string | undefined
  try {
    const body = await res.json()
    if (body?.detail) detail = body.detail
    if (body?.code) code = body.code
  } catch {
    /* non-JSON error body (e.g. connection-refused proxies, plain 404 pages) */
  }
  return { detail, code }
}

async function doFetch(path: string, init: RequestInit, accessToken: string | null): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return fetch(`${BASE}${path}`, { ...init, headers })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    const token = await getValidAccessToken()
    res = await doFetch(path, init ?? {}, token)
    // A still-401 despite a "valid" token means the session died server-side
    // (e.g. the refresh token was revoked by the reuse-detection tripwire) —
    // try one silent refresh-and-retry before giving up.
    if (res.status === 401 && token) {
      const refreshed = await getValidAccessToken()
      if (refreshed && refreshed !== token) {
        res = await doFetch(path, init ?? {}, refreshed)
      }
    }
    if (res.status === 401) {
      forceLogout()
    }
  } catch (err) {
    // Network error / connection refused — the backend isn't up yet.
    throw new ApiError(err instanceof Error ? err.message : 'Network error', { code: 'network_error' })
  }
  if (!res.ok) {
    const { detail, code } = await parseErrorBody(res)
    throw new ApiError(detail, { code, status: res.status })
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Exported for feature modules (pathData.ts, ...) that own their response
 * types — keeps this file to plumbing + the small auth surface. */
export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export const api = {
  base: BASE,
  health: () => get<Health>('/api/health'),
  me: () => get<Me>('/api/auth/me'),
  updateSettings: (patch: UserSettings) =>
    request<{ settings: UserSettings }>('/api/auth/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
}

export { ApiError }
