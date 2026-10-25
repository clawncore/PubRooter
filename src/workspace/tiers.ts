import type { JournalMatch } from '../types'
import type { FitTier, ResearchPreferences } from './types'

export const TIER_THRESHOLDS = { tier1: 62, tier2: 40 } as const

export interface TierAssignment {
  tiers: Record<FitTier, string[]>
  excluded: { id: string; reason: string }[]
}

function apcOverBudget(m: JournalMatch, prefs: ResearchPreferences): boolean {
  return (
    prefs.apcMaxUsd != null &&
    typeof m.journal.apcUsd === 'number' &&
    m.journal.apcUsd > prefs.apcMaxUsd
  )
}

/** Assign fit tiers. Tiers describe evidence-backed fit, not acceptance likelihood. */
export function assignTiers(matches: JournalMatch[], prefs: ResearchPreferences): TierAssignment {
  const tiers: Record<FitTier, string[]> = { tier1: [], tier2: [], tier3: [] }
  const excluded: { id: string; reason: string }[] = []

  for (const m of matches) {
    const j = m.journal
    const excludedName = prefs.excludedJournals.some((x) => x && j.title.toLowerCase().includes(x.toLowerCase()))
    if (excludedName) {
      excluded.push({ id: j.id, reason: 'Excluded by your preferences.' })
      continue
    }
    if (prefs.oaPreferred && j.isOpenAccess === false && m.score < TIER_THRESHOLDS.tier1) {
      excluded.push({ id: j.id, reason: 'Not open access while open access was preferred.' })
      continue
    }
    if (apcOverBudget(m, prefs)) {
      excluded.push({ id: j.id, reason: `APC above your configured budget (US$${m.journal.apcUsd?.toLocaleString()}).` })
      continue
    }
    if (prefs.preferredPublisher && j.publisher && !j.publisher.toLowerCase().includes(prefs.preferredPublisher.toLowerCase()) && m.score < TIER_THRESHOLDS.tier1) {
      excluded.push({ id: j.id, reason: `Publisher differs from your preference (${prefs.preferredPublisher}).` })
      continue
    }

    if (m.score >= TIER_THRESHOLDS.tier1 && m.evidence.length >= 2) tiers.tier1.push(j.id)
    else if (m.score >= TIER_THRESHOLDS.tier2 && m.evidence.length >= 1) tiers.tier2.push(j.id)
    else if (m.evidence.length >= 1 && m.score >= 20) tiers.tier3.push(j.id)
    else excluded.push({ id: j.id, reason: 'Insufficient reliable evidence of scope fit.' })
  }
  return { tiers, excluded }
}
