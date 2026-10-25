import { describe, expect, it } from 'vitest'
import { assignTiers, TIER_THRESHOLDS } from '../src/workspace/tiers'
import { DEFAULT_PREFERENCES, type ResearchPreferences } from '../src/workspace/types'
import type { JournalMatch } from '../src/types'

function match(id: string, opts: Partial<JournalMatch> & { score?: number } = {}): JournalMatch {
  return {
    score: opts.score ?? 70,
    evidence: opts.evidence ?? [
      { field: 'Topic overlap', detail: 'Shared terms: oncology', weight: 0.55 },
      { field: 'Scope', detail: 'Subjects: oncology', weight: 0.1 }
    ],
    limitations: opts.limitations ?? [],
    journal: opts.journal ?? {
      id,
      title: `Journal ${id}`,
      subjects: ['oncology'],
      source: 'openalex',
      isOpenAccess: true,
      subjects_: undefined
    } as unknown as JournalMatch['journal']
  }
}

const prefs = (over: Partial<ResearchPreferences> = {}): ResearchPreferences => ({ ...DEFAULT_PREFERENCES, ...over })

describe('assignTiers', () => {
  it('places strong, well-evidenced matches in tier 1', () => {
    const { tiers, excluded } = assignTiers([match('a', { score: 75 })], prefs())
    expect(tiers.tier1).toContain('a')
    expect(excluded).toHaveLength(0)
  })

  it('places mid matches in tier 2 and weaker ones in tier 3', () => {
    const { tiers } = assignTiers([match('b', { score: 50 }), match('c', { score: 30 })], prefs())
    expect(tiers.tier2).toContain('b')
    expect(tiers.tier3).toContain('c')
  })

  it('never tier when evidence is insufficient, even with a high score', () => {
    const { tiers, excluded } = assignTiers(
      [match('x', { score: 80, evidence: [] })],
      prefs()
    )
    expect(tiers.tier1).toHaveLength(0)
    expect(tiers.tier3).toHaveLength(0)
    expect(excluded.find((e) => e.id === 'x')?.reason).toMatch(/insufficient/i)
  })

  it('honors excluded journal preferences', () => {
    const { tiers, excluded } = assignTiers([match('bad', { journal: { ...match('bad').journal, title: 'Journal of Negative Results' } })], prefs({ excludedJournals: ['Journal of Negative'] }))
    expect(tiers.tier1 + tiers.tier2 + tiers.tier3).not.toContain('bad')
    expect(excluded[0]?.reason).toMatch(/excluded/i)
  })

  it('drops journals above the APC budget', () => {
    const { tiers, excluded } = assignTiers(
      [
        match('costly', {
          journal: { ...match('costly').journal, apcUsd: 3000 }
        })
      ],
      prefs({ apcMaxUsd: 2000 })
    )
    expect(tiers.tier1).toHaveLength(0)
    expect(excluded[0]?.reason).toMatch(/budget/i)
  })

  it('keeps journals within budget', () => {
    const { tiers } = assignTiers(
      [match('ok', { journal: { ...match('ok').journal, apcUsd: 1500 } })],
      prefs({ apcMaxUsd: 2000 })
    )
    expect(tiers.tier1 + tiers.tier2 + tiers.tier3).toContain('ok')
  })

  it('applies open-access preference against non-OA journals', () => {
    const { excluded } = assignTiers(
      [match('sub', { score: 55, journal: { ...match('sub').journal, isOpenAccess: false } })],
      prefs({ oaPreferred: true })
    )
    expect(excluded.find((e) => e.id === 'sub')?.reason).toMatch(/open access/i)
  })

  it('is empty-safe', () => {
    const { tiers, excluded } = assignTiers([], prefs())
    expect(Object.values(tiers).every((t) => t.length === 0)).toBe(true)
    expect(excluded).toHaveLength(0)
  })

  it('exposes documented thresholds', () => {
    expect(TIER_THRESHOLDS.tier1).toBeGreaterThan(TIER_THRESHOLDS.tier2)
  })
})
