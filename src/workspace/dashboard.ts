import type { ManuscriptProject, ReadinessAudit } from './types'

export type SortDir = 1 | -1

export function cmpVal(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
}

export function sortRows<T>(
  rows: readonly T[],
  key: string,
  dir: SortDir,
  accessors: Record<string, (row: T) => number | string>
): T[] {
  const get = accessors[key]
  if (!get) return [...rows]
  return [...rows].sort((a, b) => cmpVal(get(a), get(b)) * dir)
}

export interface AuditRow {
  project: ManuscriptProject
  audit: ReadinessAudit
}

export function flattenAudits(projects: readonly ManuscriptProject[]): AuditRow[] {
  const rows: AuditRow[] = []
  for (const project of projects) {
    for (const audit of project.audits) rows.push({ project, audit })
  }
  return rows.sort((a, b) => Date.parse(b.audit.runAt) - Date.parse(a.audit.runAt))
}

export function targetJournalTitle(project: ManuscriptProject): string {
  if (!project.selectedJournalId || !project.analysis) return ''
  return project.analysis.matches.find((m) => m.journal.id === project.selectedJournalId)?.journal.title ?? ''
}
