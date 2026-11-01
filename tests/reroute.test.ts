import { describe, expect, it } from 'vitest'
import { rerouteProjectToJournal } from '../src/workspace/reroute'
import {
  createRerouteAttempt,
  transitionAttempt,
  type SubmissionAttempt
} from '../src/workspace/submissions'
import { emptyProject, emptyExtracted, type ManuscriptProject } from '../src/workspace/types'
import type { JournalCandidate } from '../src/types'

const journalA: JournalCandidate = {
  id: 'j-a',
  title: 'Journal of Alpha Studies',
  issn: '1111-2222',
  publisher: 'Alpha Press',
  isOpenAccess: true,
  apcUsd: 1500,
  subjects: ['alpha'],
  worksCount: 500,
  source: 'openalex',
  sourceUrl: 'https://example.org/j-a'
}

const journalB: JournalCandidate = {
  id: 'j-b',
  title: 'Journal of Beta Research',
  issn: '3333-4444',
  publisher: 'Beta Press',
  isOpenAccess: false,
  apcUsd: 0,
  subjects: ['beta'],
  worksCount: 300,
  source: 'openalex',
  sourceUrl: 'https://example.org/j-b'
}

function projectWithRejectedAttempt(): ManuscriptProject {
  const p = emptyProject()
  const content = emptyExtracted()
  content.title = 'Beta mechanisms'
  content.abstract = 'A study of beta mechanisms across scales.'
  p.extracted = content
  p.edited = content
  p.hasStoredFile = true
  p.name = 'Beta paper'
  const now = new Date().toISOString()
  const attempt: SubmissionAttempt = {
    id: 'sub_prev',
    projectId: p.id,
    attemptNumber: 1,
    status: 'rejected',
    targetJournalId: journalA.id,
    targetJournalTitle: journalA.title,
    submissionDate: now,
    requiredDocs: [],
    createdAt: now,
    updatedAt: now,
    events: []
  }
  p.submissions = [attempt]
  p.selectedJournalId = journalA.id
  return p
}

describe('rerouteProjectToJournal', () => {
  it('appends a linked draft attempt and retargets the project', () => {
    const p = projectWithRejectedAttempt()
    const next = rerouteProjectToJournal(p, journalB, 'sub_prev', 'Editor suggested a better fit elsewhere.')

    expect(next.submissions).toHaveLength(2)
    const rerouted = next.submissions[1]
    expect(rerouted.attemptNumber).toBe(2)
    expect(rerouted.status).toBe('draft')
    expect(rerouted.targetJournalId).toBe(journalB.id)
    expect(rerouted.reroutedFromAttemptId).toBe('sub_prev')
    expect(rerouted.reroutedFromJournalTitle).toBe(journalA.title)
    expect(rerouted.events[0].type).toBe('rerouted')
    expect(rerouted.events[0].note).toContain(journalA.title)
    expect(rerouted.events[0].note).toContain(journalB.title)
    expect(rerouted.events[0].note).toContain('Editor suggested')
    expect(next.selectedJournalId).toBe(journalB.id)
  })

  it('never mutates the previous attempt', () => {
    const p = projectWithRejectedAttempt()
    const before = JSON.parse(JSON.stringify(p.submissions[0]))
    rerouteProjectToJournal(p, journalB, 'sub_prev')
    expect(p.submissions).toHaveLength(1)
    expect(JSON.parse(JSON.stringify(p.submissions[0]))).toEqual(before)
  })

  it('runs a fresh readiness audit for the new journal', () => {
    const p = projectWithRejectedAttempt()
    const next = rerouteProjectToJournal(p, journalB, 'sub_prev')
    expect(next.audits.length).toBe(1)
    expect(next.audits[0].journalId).toBe(journalB.id)
  })

  it('keeps attached documents with the project', () => {
    const p = projectWithRejectedAttempt()
    p.attachedDocs = [
      { docId: 'd1', name: 'cover.pdf', size: 100, type: 'application/pdf', storedAt: new Date().toISOString(), source: 'upload' }
    ]
    const next = rerouteProjectToJournal(p, journalB, 'sub_prev')
    expect(next.attachedDocs).toHaveLength(1)
    expect(next.attachedDocs?.[0].docId).toBe('d1')
    expect(next.hasStoredFile).toBe(true)
  })

  it('falls back to a plain draft attempt when the previous id is unknown', () => {
    const p = projectWithRejectedAttempt()
    const next = rerouteProjectToJournal(p, journalB, 'does-not-exist')
    const attempt = next.submissions[1]
    expect(attempt.status).toBe('draft')
    expect(attempt.reroutedFromAttemptId).toBeUndefined()
    expect(attempt.events[0].type).toBe('created')
  })
})

describe('createRerouteAttempt', () => {
  it('emits a rerouted event even without a note', () => {
    const p = projectWithRejectedAttempt()
    const previous = transitionAttempt(p.submissions[0], 'withdrawn', 'Withdrew after review.')
    const attempt = createRerouteAttempt(p, journalA, 2, previous)
    expect(attempt.events).toHaveLength(1)
    expect(attempt.events[0].type).toBe('rerouted')
    expect(attempt.events[0].note).toContain('Withdrawn')
  })
})
