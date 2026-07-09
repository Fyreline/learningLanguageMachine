// Client for POST /api/converse — the freeform speaking corner. Stateless:
// the whole (short) transcript rides along on every turn, so closing the
// scene forgets it, which is the point — it's a sandbox, not a record.

import { get, post } from './api'

export interface ConverseScenes {
  configured: boolean
  scenes: { id: string; title: string }[]
}

export interface ConverseTurn {
  role: 'npc' | 'you'
  jp: string
}

export interface ConverseReply {
  jp: string
  romaji: string
  en: string
}

export function fetchScenes(): Promise<ConverseScenes> {
  return get<ConverseScenes>('/api/converse/scenes')
}

export function converseTurn(scene: string, turns: ConverseTurn[]): Promise<ConverseReply> {
  return post<ConverseReply>('/api/converse', { scene, turns })
}
