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
      candidate({ id: 'weak', title: 'Journal of Neural Pottery', subjects: ['pottery'] }),
      candidate({ id: 'strong' })
    ])
    expect(list).toHaveLength(2)
    expect(list[0]!.journal.id).toBe('strong')
    expect(list[0]!.score).toBeGreaterThan(list[1]!.score)
  })

  it('caps the candidate list', () => {
    const many = Array.from({ length: 60 }, (_, i) => candidate({ id: `c${i}`, title: `Journal ${i}`, issn: `1000-00${i}` }))
    expect(rankJournals(manuscript, many).length).toBeLessThanOrEqual(40)
  })

  it('handles an empty candidate set without throwing', () => {
    expect(rankJournals(manuscript, [])).toEqual([])
  })
})

describe('determinism', () => {
  function pool(): JournalCandidate[] {
    const subjects = ['deep learning', 'molecular modelling', 'drug discovery']
    const base: JournalCandidate[] = [
      candidate({ id: 'oa-1', issn: '1111-1111', title: 'Journal of Molecular Learning', subjects }),
      candidate({ id: 'oa-2', issn: '2222-2222', title: 'Neural Systems Review', subjects: ['deep learning', 'neural networks'] }),
      candidate({ id: 'cr-3', issn: '3333-3333', title: 'Drug Discovery Advances', subjects: ['drug discovery'], source: 'crossref', worksCount: undefined, isOpenAccess: undefined }),
      candidate({ id: 'oa-4', issn: '4444-4444', title: 'Molecular Property Journal', subjects: ['molecular property', 'cheminformatics'] }),
      candidate({ id: 'cr-5', issn: '5555-5555', title: 'Graph Learning Letters', subjects: ['graph neural networks', 'deep learning'], source: 'crossref', worksCount: undefined, isOpenAccess: undefined })
    ]
    return base
  }

  const ids = (list: ReturnType<typeof rankJournals>) => list.map((m) => m.journal.id)

  it('returns the same ranking for shuffled inputs', () => {
    const base = pool()
    const expected = ids(rankJournals(manuscript, base))
    expect(expected.length).toBeGreaterThan(1)
    expect(ids(rankJournals(manuscript, [...base].reverse()))).toEqual(expected)
    expect(ids(rankJournals(manuscript, [...base.slice(2), ...base.slice(0, 2)]))).toEqual(expected)
    const permuted = [base[3]!, base[0]!, base[4]!, base[2]!, base[1]!]
    expect(ids(rankJournals(manuscript, permuted))).toEqual(expected)
  })

  it('breaks score ties deterministically by quality then name', () => {
    const t1 = candidate({ id: 'z-journal', issn: '7777-7777', title: 'AAA Molecular Journal' })
    const t2 = candidate({ id: 'a-journal', issn: '8888-8888', title: 'ZZZ Molecular Journal' })
    const fwd = rankJournals(manuscript, [t1, t2])
    const rev = rankJournals(manuscript, [t2, t1])
    expect(fwd).toHaveLength(2)
    expect(fwd[0]!.score).toBe(fwd[1]!.score)
    expect(fwd[0]!.journal.title).toBe('AAA Molecular Journal')
    expect(ids(rev)).toEqual(ids(fwd))
  })

  it('picks the richer duplicate record regardless of arrival order', () => {
    const bare = candidate({ id: 'x1', issn: '9999-9999', subjects: [], source: 'crossref', worksCount: undefined, isOpenAccess: undefined })
    const rich = candidate({ id: 'x2', issn: '9999-9999' })
    const fwd = rankJournals(manuscript, [bare, rich])
    const rev = rankJournals(manuscript, [rich, bare])
    expect(fwd).toHaveLength(1)
    expect(fwd[0]!.journal.id).toBe('x2')
    expect(rev[0]!.journal.id).toBe('x2')
  })
})
