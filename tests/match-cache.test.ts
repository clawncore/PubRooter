import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchCacheKey, readMatchCache, writeMatchCache } from '../src/lib/match-cache'
import type { JournalMatch } from '../src/types'

function match(id: string): JournalMatch {
  return {
    score: 70,
    evidence: [{ field: 'Topic overlap', detail: 'Shared terms: oncology', weight: 0.65 }],
    limitations: ['Matching is keyword/metadata-based, not a peer-review suitability judgment.'],
    journal: { id, title: `Journal ${id}`, subjects: ['oncology'], source: 'openalex' }
  }
}

describe('match-cache', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('produces the same key for the same manuscript regardless of case, spacing, and keyword order', () => {
    const a = matchCacheKey('Deep Learning for Oncology', 'We study  tumor   biomarkers.', ['drug discovery', 'oncology'])
    const b = matchCacheKey('  deep learning for ONCOLOGY ', 'we study tumor biomarkers.', ['oncology', 'drug discovery'])
    expect(a).toBe(b)
    const c = matchCacheKey('Deep Learning for Oncology', 'Different abstract entirely.', ['drug discovery', 'oncology'])
    expect(c).not.toBe(a)
  })

  it('round-trips cached matches', () => {
    const key = matchCacheKey('T', 'A', ['k'])
    writeMatchCache(key, { matches: [match('j1'), match('j2')], notices: [], candidateCount: 4 })
    const cached = readMatchCache(key)
    expect(cached).not.toBeNull()
    expect(cached!.matches.map((m) => m.journal.id)).toEqual(['j1', 'j2'])
    expect(cached!.candidateCount).toBe(4)
  })

  it('expires entries after the TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T10:00:00Z'))
    const key = matchCacheKey('T', 'A', ['k'])
    writeMatchCache(key, { matches: [match('j1')], notices: [], candidateCount: 1 })
    expect(readMatchCache(key)).not.toBeNull()
    vi.setSystemTime(new Date('2026-10-31T10:31:00Z'))
    expect(readMatchCache(key)).toBeNull()
  })

  it('returns null and does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
      key: () => null,
      length: 0
    })
    expect(readMatchCache('x')).toBeNull()
    expect(() => writeMatchCache('x', { matches: [match('j1')], notices: [], candidateCount: 1 })).not.toThrow()
  })
})
