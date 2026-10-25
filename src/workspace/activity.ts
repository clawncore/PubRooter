import type { ActivityEvent, WorkspaceData } from './types'
import { uid } from '../lib/storage'

export function logActivity(ws: WorkspaceData, kind: ActivityEvent['kind'], detail: string, projectId?: string): WorkspaceData {
  const ev: ActivityEvent = { id: uid(), at: new Date().toISOString(), kind, detail, projectId }
  return { ...ws, activity: [ev, ...ws.activity].slice(0, 100) }
}
