"use client"

import { nanoid } from 'nanoid'

/** Auth trace utility for session recovery debugging */

interface AuthTraceEvent {
  id: string
  at: string
  event: string
  detail?: string
  source?: string
}

const MAX_TRACES = 100

/** Write an auth trace event for debugging */
export function authTrace(event: string, detail?: string, source = 'main'): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return

  const ev: AuthTraceEvent = {
    id: nanoid(),
    at: new Date().toISOString(),
    event,
    detail,
    source
  }

  const key = 'pubrooter.auth-trace.v1'
  try {
    const raw = sessionStorage.getItem(key)
    const list: AuthTraceEvent[] = raw ? JSON.parse(raw) : []
    list.unshift(ev)
    if (list.length > MAX_TRACES) list.splice(MAX_TRACES)
    sessionStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.error('[auth-trace] failed to write:', e)
  }

  // Also log to console in dev
  console.debug(`[auth-trace] ${event}${detail ? `: ${detail}` : ''}`)
}

/** Read auth trace events from sessionStorage */
export function getAuthTrace(): AuthTraceEvent[] {
  try {
    const raw = sessionStorage.getItem('pubrooter.auth-trace.v1')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Clear auth trace events */
export function clearAuthTrace(): void {
  try {
    sessionStorage.removeItem('pubrooter.auth-trace.v1')
  } catch (e) {
    console.error('[auth-trace] failed to clear:', e)
  }
}