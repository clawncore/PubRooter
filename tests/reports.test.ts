import { describe, expect, it } from 'vitest'
import { toCsv, recommendationsCsv, readinessCsv } from '../src/workspace/reports'
import { runReadiness } from '../src/workspace/readiness'
import { READINESS_ENGINE_VERSION, DEFAULT_PREFERENCES, emptyExtracted, type ManuscriptProject } from '../src/workspace/types'
import type { JournalMatch } from '../src/types'

describe('toCsv escaping', () => {
  it('quotes commas, quotes, and newlines', () => {
    const csv = toCsv(['a', 'b'], [['plain, value', 'has "quotes" here'], ['line1\nline2', '']])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('a,b')
    expect(lines[1]).toBe('"plain, value","has ""quotes"" here"')
    expect(csv).toContain('"line1\nline2"')
  })
})

function project(): ManuscriptProject {
  const match: JournalMatch = {
    score: 72.5,
    evidence: [{ field: 'Topic overlap', detail: 'Shared terms: oncology, tumor', weight: 0.55 }],
    limitations: ['Matching is keyword-based.'],
    journal: {
      id: 'j1',
      title: 'Journal of "Oncology", Today',
      issn: '1234-5678',
      publisher: 'Example, Ltd.',
      isOpenAccess: true,
      apcUsd: 1800,
      subjects: ['oncology'],
      worksCount: 900,
      source: 'openalex',
      sourceUrl: 'https://example.org/j1'
    }
  }
  return {
    id: 'p1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: 'My, "Great" Paper',
    fileName: 'paper.pdf',
    fileSize: 1000,
    hasStoredFile: true,
    status: 'completed',
    error: null,
    extracted: emptyExtracted(),
    edited: emptyExtracted(),
    preferences: { ...DEFAULT_PREFERENCES },
    analysis: {
      ranAt: '2026-01-01T00:00:00.000Z',
      matches: [match],
      tiers: { tier1: ['j1'], tier2: [], tier3: [] },
      notices: [],
      engineVersion: 'pubrooter-rank-v1',
      candidateCount: 12
    },
    audits: [],
    selectedJournalId: 'j1',
    comparedJournalIds: [],
    actionsCompleted: []
  }
}

describe('recommendationsCsv', () => {
  const csv = recommendationsCsv(project())

  it('includes headers and escaped values', () => {
    expect(csv.split('\r\n')[0]).toContain('Journal')
    expect(csv).toContain('"Journal of ""Oncology"", Today"')
    expect(csv).toContain('Tier 1 — Strongest fit')
    expect(csv).toContain('openalex')
    expect(csv).toContain('Relevance score (0-100)')
  })

  it('labels tiers as fit, not acceptance', () => {
    expect(csv).not.toMatch(/acceptance probability/i)
    expect(csv).toContain('Tier')
  })
})

describe('readinessCsv', () => {
  it('exports every check with its status and engine version', () => {
    const audit = runReadiness({ ...emptyExtracted(), title: 'T', abstract: 'A'.repeat(300), keywords: ['a', 'b', 'c'] }, { title: 'J' }, 'aid')
    const csv = readinessCsv(audit)
    expect(csv).toContain(READINESS_ENGINE_VERSION)
    expect(csv).toContain('Status')
    const rows = csv.split('\r\n').slice(1)
    expect(rows.length).toBe(audit.checks.length)
    expect(csv).toMatch(/unknown/)
  })
})
