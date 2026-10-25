import { describe, expect, it } from 'vitest'
import { runReadiness, auditSummary } from '../src/workspace/readiness'
import { READINESS_ENGINE_VERSION, emptyExtracted, type ExtractedContent } from '../src/workspace/types'

function content(over: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    ...emptyExtracted(),
    title: 'A study of things',
    abstract: 'We investigate a method for studying things with care and rigour in a large sample of participants across three clinical sites worldwide.'.repeat(3),
    keywords: ['method', 'study', 'sample', 'rigour'],
    sections: ['abstract', 'introduction', 'methods', 'results', 'conclusion'],
    referenceCount: 42,
    wordCount: 5000,
    pageCount: 12,
    ...over
  }
}

const journal = { title: 'Journal of Stuff', homepageUrl: 'https://example.org', apcUsd: 2500, isOpenAccess: true }

describe('runReadiness', () => {
  const audit = runReadiness(content(), journal, 'audit-1')

  it('tags the audit with engine version and timestamp', () => {
    expect(audit.engineVersion).toBe(READINESS_ENGINE_VERSION)
    expect(audit.runAt).toBeTruthy()
    expect(audit.journalTitle).toBe('Journal of Stuff')
  })

  it('passes items verifiable from the manuscript', () => {
    const byId = Object.fromEntries(audit.checks.map((c) => [c.id, c]))
    expect(byId.title!.status).toBe('pass')
    expect(byId.abstract!.status).toBe('pass')
    expect(byId.keywords!.status).toBe('pass')
    expect(byId.structure!.status).toBe('pass')
    expect(byId.references!.status).toBe('pass')
  })

  it('keeps journal-side unknowns unknown rather than passing them', () => {
    const byId = Object.fromEntries(audit.checks.map((c) => [c.id, c]))
    expect(byId.wordcount!.status).toBe('unknown')
    expect(byId.refstyle!.status).toBe('unknown')
    expect(byId.files!.status).toBe('unknown')
    expect(byId.figures!.status).toBe('unknown')
    expect(byId['article-type']!.status).toBe('unknown')
  })

  it('does not pass an abstract that could not be extracted', () => {
    const noAbs = runReadiness(content({ abstract: '' }), journal, 'a2')
    const abstract = noAbs.checks.find((c) => c.id === 'abstract')!
    expect(abstract.status).toBe('attention')
    expect(abstract.status).not.toBe('pass')
  })

  it('flags missing declarations as needing attention', () => {
    const bare = runReadiness(
      content({ abstract: 'We study rocks and minerals in the field.', objectives: '', methods: '' }),
      journal,
      'a3'
    )
    const coi = bare.checks.find((c) => c.id === 'coi')!
    expect(['attention', 'warning']).toContain(coi.status)
  })

  it('warns on human-subject language without ethics statement', () => {
    const risky = runReadiness(
      content({ abstract: 'We enrolled 400 patients in a randomized clinical trial of the intervention.', objectives: 'patients', methods: '' }),
      journal,
      'a4'
    )
    const ethics = risky.checks.find((c) => c.id === 'ethics')!
    expect(ethics.status).toBe('warning')
  })

  it('passes ethics when ethics language exists', () => {
    const ok = runReadiness(
      content({ abstract: 'IRB approval was obtained from the institutional review board for all patient procedures.', objectives: 'ethics approval', methods: '' }),
      journal,
      'a5'
    )
    expect(ok.checks.find((c) => c.id === 'ethics')!.status).toBe('pass')
  })

  it('attaches the source url to journal-side checks', () => {
    expect(audit.checks.find((c) => c.id === 'refstyle')!.sourceUrl).toBe('https://example.org')
  })

  it('summarises statuses', () => {
    const s = auditSummary(audit)
    expect(s.pass + s.attention + s.warning + s.unknown + s['not-checked']).toBe(audit.checks.length)
    expect(s.pass).toBeGreaterThan(0)
  })
})
