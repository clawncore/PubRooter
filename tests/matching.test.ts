import { describe, expect, it } from 'vitest'
import { rankJournals, scoreJournal, tokenize } from '../src/lib/matching'
import type { JournalCandidate, Manuscript } from '../src/types'

const manuscript: Manuscript = {
  id: 'm1',
  title: 'Deep learning for molecular property prediction',
  abstract: 'We apply graph neural networks to predict molecular properties in drug discovery pipelines.',
  keywords: ['deep learning', 'molecular property', 'drug discovery'],
  createdAt: new Date().toISOString()
}

function candidate(over: Partial<JournalCandidate> = {}): JournalCandidate {
  return {
    id: 'c1',
    title: 'Journal of Molecular Learning',
    subjects: ['deep learning', 'molecular modelling', 'drug discovery'],
    source: 'openalex',
    isOpenAccess: true,
    worksCount: 1200,
    ...over
  }
}

describe('tokenize', () => {
  it('lowercases, strips punctuation, and drops stopwords', () => {
    const t = tokenize('The Study of, Neural; Networks!')
    expect(t).toContain('neural')
    expect(t).toContain('networks')
    expect(t).not.toContain('the')
    expect(t).not.toContain('of')
  })
})

describe('scoreJournal', () => {
  it('scores higher when subjects overlap with the manuscript', () => {
    const good = scoreJournal(manuscript, candidate())
    const weak = scoreJournal(manuscript, candidate({ id: 'c2', title: 'Journal of Veterinary Poetry', subjects: ['poetry', 'veterinary history'] }))
    expect(good.score).toBeGreaterThan(weak.score)
    expect(good.evidence.some((e) => e.field === 'Topic overlap')).toBe(true)
  })

  it('treats missing information as unknown, not positive', () => {
    const bare = scoreJournal(manuscript, candidate({ isOpenAccess: undefined, apcUsd: undefined, worksCount: undefined, subjects: [] }))
    expect(bare.evidence.some((e) => e.field === 'Open access')).toBe(false)
    expect(bare.limitations.length).toBeGreaterThan(0)
  })

  it('records limitations for non-OA and crossref sources', () => {
    const oa = scoreJournal(manuscript, candidate({ source: 'openalex', isOpenAccess: false }))
    expect(oa.limitations.join(' ')).toMatch(/not listed as open access/i)
    const cr = scoreJournal(manuscript, candidate({ id: 'c3', source: 'crossref', isOpenAccess: false }))
    expect(cr.limitations.join(' ')).toMatch(/crossref/i)
  })

  it('always disclaims acceptance judgment', () => {
    const m = scoreJournal(manuscript, candidate())
    expect(m.limitations.join(' ')).toMatch(/not a peer-review suitability judgment/i)
  })
})

describe('rankJournals', () => {
  it('deduplicates by ISSN or title', () => {
    const dup = [candidate(), candidate({ id: 'c2' })]
    expect(rankJournals(manuscript, dup)).toHaveLength(1)
  })

  it('sorts by score descending', () => {
    const list = rankJournals(manuscript, [
      candidate({ id: 'weak', title: 'Journal of Pottery', subjects: ['pottery'] }),
      candidate({ id: 'strong' })
    ])
    expect(list[0]!.journal.id).toBe('strong')
    expect(list[0]!.score).toBeGreaterThanOrEqual(list[1]!.score)
  })

  it('caps the candidate list', () => {
    const many = Array.from({ length: 60 }, (_, i) => candidate({ id: `c${i}`, title: `Journal ${i}`, issn: `1000-00${i}` }))
    expect(rankJournals(manuscript, many).length).toBeLessThanOrEqual(40)
  })

  it('handles an empty candidate set without throwing', () => {
    expect(rankJournals(manuscript, [])).toEqual([])
  })
})
