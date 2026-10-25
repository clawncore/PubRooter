import { describe, expect, it } from 'vitest'
import { cmpVal, sortRows, flattenAudits, targetJournalTitle } from '../src/workspace/dashboard'
import { emptyExtracted, emptyWorkspace, type ManuscriptProject } from '../src/workspace/types'
import type { JournalMatch } from '../src/types'

describe('cmpVal', () => {
  it('orders numbers numerically', () => {
    expect(cmpVal(2, 10)).toBeLessThan(0)
    expect(cmpVal(10, 10)).toBe(0)
    expect(cmpVal(3, 1)).toBeGreaterThan(0)
  })

  it('orders strings case-insensitively', () => {
    expect(cmpVal('alpha', 'Beta')).toBeLessThan(0)
    expect(cmpVal('beta', 'alpha')).toBeGreaterThan(0)
    expect(cmpVal('Same', 'same')).toBe(0)
  })

  it('sorts numbers before strings', () => {
    expect(cmpVal(5, 'zzz')).toBeLessThan(0)
    expect(cmpVal('aaa', 5)).toBeGreaterThan(0)
  })
})

describe('sortRows', () => {
  const rows = [
    { id: 'a', name: 'Zeta', n: 2 },
    { id: 'b', name: 'alpha', n: 10 },
    { id: 'c', name: 'Mid', n: 1 }
  ]
  const acc = { name: (r: (typeof rows)[number]) => r.name, n: (r: (typeof rows)[number]) => r.n }

  it('sorts ascending by named accessor', () => {
    expect(sortRows(rows, 'n', 1, acc).map((r) => r.n)).toEqual([1, 2, 10])
    expect(sortRows(rows, 'name', 1, acc).map((r) => r.name)).toEqual(['alpha', 'Mid', 'Zeta'])
  })

  it('sorts descending when dir is -1', () => {
    expect(sortRows(rows, 'n', -1, acc).map((r) => r.n)).toEqual([10, 2, 1])
  })

  it('does not mutate the input and returns a copy for unknown keys', () => {
    const out = sortRows(rows, 'missing', 1, acc)
    expect(out).not.toBe(rows)
    expect(out).toEqual(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

function project(over: Partial<ManuscriptProject>): ManuscriptProject {
  return {
    id: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Project',
    fileName: null,
    fileSize: null,
    hasStoredFile: false,
    status: 'completed',
    error: null,
    extracted: emptyExtracted(),
    edited: emptyExtracted(),
    preferences: emptyWorkspace({ name: '', email: '', affiliation: '' }).defaultPreferences,
    analysis: null,
    audits: [],
    selectedJournalId: null,
    comparedJournalIds: [],
    actionsCompleted: [],
    ...over
  }
}

function match(id: string, title: string): JournalMatch {
  return { journal: { id, title } } as unknown as JournalMatch
}

describe('flattenAudits', () => {
  it('pairs each audit with its project, newest first', () => {
    const older = project({
      id: 'old',
      audits: [{ id: 'a1', journalId: 'j1', journalTitle: 'Old Journal', runAt: '2026-02-01T10:00:00.000Z', engineVersion: 'v1', checks: [] }]
    })
    const newer = project({
      id: 'new',
      audits: [
        { id: 'a2', journalId: 'j2', journalTitle: 'New Journal', runAt: '2026-05-01T10:00:00.000Z', engineVersion: 'v1', checks: [] },
        { id: 'a3', journalId: 'j3', journalTitle: 'Mid Journal', runAt: '2026-03-01T10:00:00.000Z', engineVersion: 'v1', checks: [] }
      ]
    })
    const rows = flattenAudits([older, newer])
    expect(rows.map((r) => r.audit.id)).toEqual(['a2', 'a3', 'a1'])
    expect(rows[0]!.project.id).toBe('new')
    expect(rows[2]!.project.id).toBe('old')
  })

  it('returns an empty list for projects without audits', () => {
    expect(flattenAudits([project({})])).toEqual([])
  })
})

describe('targetJournalTitle', () => {
  it('resolves the selected journal title from analysis matches', () => {
    const p = project({ selectedJournalId: 'j1', analysis: { matches: [match('j1', 'Journal A'), match('j2', 'Journal B')], tiers: { tier1: [], tier2: [], tier3: [] }, notices: [], engineVersion: 'v1', candidateCount: 2, ranAt: '2026-01-01' } as ManuscriptProject['analysis'] })
    expect(targetJournalTitle(p)).toBe('Journal A')
  })

  it('returns empty when nothing is selected or nothing matches', () => {
    expect(targetJournalTitle(project({}))).toBe('')
    const p = project({ selectedJournalId: 'j404', analysis: { matches: [match('j1', 'Journal A')], tiers: { tier1: [], tier2: [], tier3: [] }, notices: [], engineVersion: 'v1', candidateCount: 1, ranAt: '2026-01-01' } as ManuscriptProject['analysis'] })
    expect(targetJournalTitle(p)).toBe('')
  })
})
