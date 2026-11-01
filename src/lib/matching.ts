import type { JournalCandidate, JournalMatch, MatchEvidence, Manuscript } from '../types'

const STOPWORDS = new Set(
  'a an the of and or in on for with without from by to is are be as at into via using use study research paper novel new approach methods method results conclusion about over under between among during'.split(' ')
)

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

export function scoreJournal(manuscript: Manuscript, journal: JournalCandidate): JournalMatch {
  const evidence: MatchEvidence[] = []
  const limitations: string[] = []
  const titleTokens = new Set(tokenize(manuscript.title))
  const abstractTokens = new Set(tokenize(manuscript.abstract))
  const keywordTokens = new Set(manuscript.keywords.flatMap((k) => tokenize(k)))
  const msTokens = new Set([...titleTokens, ...abstractTokens, ...keywordTokens])

  const journalTokens = new Set(
    tokenize([journal.title, journal.publisher ?? '', ...journal.subjects].join(' '))
  )

  let overlap = 0
  const matched: string[] = []
  for (const t of msTokens) {
    if (journalTokens.has(t)) {
      overlap += 1
      if (matched.length < 6) matched.push(t)
    }
  }
  const topicScore = msTokens.size === 0 ? 0 : Math.min(1, overlap / Math.min(msTokens.size, 12))
  if (matched.length > 0) {
    evidence.push({
      field: 'Topic overlap',
      detail: `Shared terms: ${matched.join(', ')}`,
      weight: 0.65
    })
  }

  // Topic fit is the backbone of the score. Metadata perks (open access,
  // activity, subjects) only count when there is actual topical overlap,
  // so established-but-irrelevant venues cannot outscore real matches.
  let score = topicScore * 0.65
  const relevant = overlap >= 3 ? 1 : overlap === 2 ? 0.7 : overlap === 1 ? 0.35 : 0

  if (relevant > 0) {
    if (journal.isOpenAccess) {
      score += 0.15 * relevant
      evidence.push({ field: 'Open access', detail: 'Journal is listed as open access in OpenAlex.', weight: 0.15 })
    } else if (journal.source === 'openalex' && journal.isOpenAccess === false) {
      limitations.push('Not listed as open access.')
    }

    if (typeof journal.apcUsd === 'number' && journal.apcUsd > 0) {
      limitations.push(`APC reported as $${journal.apcUsd} (verify on publisher site).`)
    } else if (journal.isOpenAccess) {
      score += 0.05 * relevant
      evidence.push({ field: 'APC', detail: 'No APC listed in OpenAlex (verify before submission).', weight: 0.05 })
    }

    if (journal.worksCount && journal.worksCount > 500) {
      score += 0.1 * relevant
      evidence.push({
        field: 'Activity',
        detail: `${journal.worksCount} works indexed. Established venue.`,
        weight: 0.1
      })
    }

    if (journal.subjects.length > 0) {
      evidence.push({
        field: 'Scope',
        detail: `Subjects: ${journal.subjects.slice(0, 4).join('; ')}`,
        weight: 0.1
      })
      score += 0.1 * relevant
    }
  } else {
    limitations.push('No shared topic terms with the manuscript.')
  }

  limitations.push('Matching is keyword/metadata-based, not a peer-review suitability judgment.')
  if (journal.source === 'crossref') {
    limitations.push('Crossref metadata may be incomplete; topics and APC data unavailable.')
  }

  return {
    journal,
    score: Math.round(Math.min(1, score) * 1000) / 10,
    evidence,
    limitations
  }
}

function compareIds(a: JournalCandidate, b: JournalCandidate): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// Deterministic choice of the canonical record for a given ISSN/title key.
// Prefer the richer record (more subjects, activity, source detail) so the
// winner does not depend on which API's response arrived first.
function richness(j: JournalCandidate): number {
  return (
    j.subjects.length * 10 +
    (typeof j.worksCount === 'number' ? 6 : 0) +
    (j.source === 'openalex' ? 4 : 0) +
    (j.homepageUrl ? 2 : 0) +
    (typeof j.isOpenAccess === 'boolean' ? 1 : 0)
  )
}

// Total order over matches. Score first, then quality signals, then name/id:
// equal scores can never fall back to API arrival order.
function compareMatches(a: JournalMatch, b: JournalMatch): number {
  if (b.score !== a.score) return b.score - a.score
  const aw = a.journal.worksCount ?? -1
  const bw = b.journal.worksCount ?? -1
  if (bw !== aw) return bw - aw
  const ac = a.journal.citedness ?? -1
  const bc = b.journal.citedness ?? -1
  if (bc !== ac) return bc - ac
  const titleCmp = a.journal.title.localeCompare(b.journal.title, 'en', { sensitivity: 'base' })
  if (titleCmp !== 0) return titleCmp
  return compareIds(a.journal, b.journal)
}

export function rankJournals(manuscript: Manuscript, journals: JournalCandidate[]): JournalMatch[] {
  const best = new Map<string, JournalCandidate>()
  for (const j of journals) {
    const key = (j.issn ?? j.title).toLowerCase()
    const cur = best.get(key)
    if (!cur) {
      best.set(key, j)
      continue
    }
    const r = richness(j)
    const rc = richness(cur)
    if (r > rc || (r === rc && compareIds(j, cur) < 0)) best.set(key, j)
  }
  return [...best.values()]
    // Neutral base order so scoring and filtering never see API arrival order.
    .sort(compareIds)
    .map((j) => scoreJournal(manuscript, j))
    // Drop venues with no topical connection at all. Metadata perks alone
    // (open access, size, subject lists) are not evidence of fit.
    .filter((m) => m.evidence.some((e) => e.field === 'Topic overlap'))
    .sort(compareMatches)
    .slice(0, 30)
}
