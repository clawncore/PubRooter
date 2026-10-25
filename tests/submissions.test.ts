import { describe, expect, it } from 'vitest'
import {
  SUBMISSION_STAGES,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_CLASS,
  appendEvent,
  makeEvent,
  nextActionFor,
  stageForAttempt,
  transitionAttempt,
  contextFromProject,
  type SubmissionAttempt,
  type SubmissionStatus
} from '../src/workspace/submissions'
import { emptyProject, DEFAULT_PREFERENCES, type ManuscriptProject, type ReadinessAudit, type AnalysisResult } from '../src/workspace/types'
import type { JournalMatch } from '../src/types'

const match: JournalMatch = {
  score: 72.5,
  evidence: [{ field: 'Topic overlap', detail: 'Shared terms: oncology, tumor', weight: 0.55 }],
  limitations: ['Matching is keyword-based.'],
  journal: {
    id: 'j1',
    title: 'Journal of Oncology',
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

function projectWith(analysis: AnalysisResult | null = null, selectedJournalId: string | null = null, audits: ReadinessAudit[] = []): ManuscriptProject {
  const now = new Date().toISOString()
  return {
    id: 'p1',
    createdAt: now,
    updatedAt: now,
    name: 'My Paper',
    fileName: 'paper.pdf',
    fileSize: 1000,
    hasStoredFile: true,
    status: analysis ? 'completed' : 'draft',
    error: null,
    extracted: {
      title: 'A title',
      abstract: 'A'.repeat(120),
      keywords: ['a', 'b', 'c'],
      field: '',
      articleType: '',
      objectives: '',
      methods: '',
      sections: ['Introduction', 'Methods', 'Results', 'Conclusion'],
      entities: [],
      referenceCount: 4,
      wordCount: 900,
      pageCount: 4,
      extractionWarnings: []
    },
    edited: {
      title: 'A title',
      abstract: 'A'.repeat(120),
      keywords: ['a', 'b', 'c'],
      field: '',
      articleType: '',
      objectives: '',
      methods: '',
      sections: ['Introduction', 'Methods', 'Results', 'Conclusion'],
      entities: [],
      referenceCount: 4,
      wordCount: 900,
      pageCount: 4,
      extractionWarnings: []
    },
    preferences: { ...DEFAULT_PREFERENCES },
    analysis,
    audits,
    selectedJournalId,
    comparedJournalIds: [],
    actionsCompleted: [],
    submissions: []
  }
}

function draftAttempt(project: ManuscriptProject): SubmissionAttempt {
  const now = new Date().toISOString()
  return {
    id: 'sub1',
    projectId: project.id,
    attemptNumber: 1,
    status: 'draft',
    targetJournalId: 'j1',
    targetJournalTitle: 'Journal of Oncology',
    requiredDocs: [],
    createdAt: now,
    updatedAt: now,
    events: [makeEvent('created', 'Submission attempt 1 started against Journal of Oncology.', 'draft')]
  }
}

describe('submission workflow model', () => {
  it('has 16 stages in the published order', () => {
    expect(SUBMISSION_STAGES).toHaveLength(16)
    expect(SUBMISSION_STAGES[0].id).toBe('manuscript_uploaded')
    expect(SUBMISSION_STAGES[SUBMISSION_STAGES.length - 1].id).toBe('published')
    expect(SUBMISSION_STAGES.map((s) => s.id)).toContain('submitted')
    expect(SUBMISSION_STAGES.map((s) => s.id)).toContain('revision_requested')
  })

  it('maps draft attempt to manuscript stage before analysis', () => {
    const ctx = contextFromProject(projectWith())
    expect(ctx.hasAnalysis).toBe(false)
    expect(stageForAttempt(draftAttempt(projectWith()), ctx)).toBe(1)
  })

  it('maps submitted attempt to submitted stage', () => {
    const p = projectWith()
    const a = transitionAttempt(draftAttempt(p), 'submitted', 'Portal returned a reference.')
    const ctx = contextFromProject(p)
    expect(a.status).toBe('submitted')
    expect(a.events).toHaveLength(2)
    expect(stageForAttempt(a, ctx)).toBe(8)
  })

  it('appends events rather than overwriting history', () => {
    const p = projectWith()
    const a1 = appendEvent(draftAttempt(p), 'status', 'Recorded submission.', 'submitted')
    const a2 = appendEvent(a1, 'decision', 'Decision recorded.', 'under_review')
    expect(a2.events).toHaveLength(3)
    expect(a2.events[0].type).toBe('created')
  })

  it('keeps previous attempts immutable when starting a new one', () => {
    const p = projectWith()
    const first = draftAttempt(p)
    const second = transitionAttempt(first, 'submitted', 'Submitted via portal.')
    expect(first.status).toBe('draft')
    expect(second.events).toHaveLength(2)
    expect(second.events[0].type).toBe('created')
    expect(second.events[1].type).toBe('submission_recorded')
  })

  it('labels statuses with human-readable text', () => {
    expect(SUBMISSION_STATUS_LABEL.submitted).toBe('Submitted')
    expect(SUBMISSION_STATUS_LABEL.revision_requested).toBe('Revision requested')
  })

  it('derives a next action from persisted state', () => {
    const analysis: AnalysisResult = {
      ranAt: new Date().toISOString(),
      matches: [match],
      tiers: { tier1: ['j1'], tier2: [], tier3: [] },
      notices: [],
      engineVersion: 'pubrooter-rank-v1',
      candidateCount: 12
    }
    const p = projectWith(analysis)
    const a = transitionAttempt(draftAttempt(p), 'draft')
    const ctx = contextFromProject(p)
    expect(ctx.hasAnalysis).toBe(true)
    expect(ctx.hasTarget).toBe(false)
    const next = nextActionFor(a, ctx)
    expect(next.action).toBe('Choose a target journal')
  })

  it('maps published attempts to published stage', () => {
    const p = projectWith()
    const a = transitionAttempt(draftAttempt(p), 'published', 'Published.')
    expect(a.status).toBe('published')
    expect(SUBMISSION_STATUS_CLASS[a.status]).toBe('published')
  })
})
