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
      weight: 0.55
    })
  }

  let score = topicScore * 0.55

  if (journal.isOpenAccess) {
    score += 0.15
    evidence.push({ field: 'Open access', detail: 'Journal is listed as open access in OpenAlex.', weight: 0.15 })
  } else if (journal.source === 'openalex' && journal.isOpenAccess === false) {
    limitations.push('Not listed as open access.')
  }

  if (typeof journal.apcUsd === 'number' && journal.apcUsd > 0) {
    limitations.push(`APC reported as $${journal.apcUsd} (verify on publisher site).`)
  } else if (journal.isOpenAccess) {
    score += 0.05
    evidence.push({ field: 'APC', detail: 'No APC listed in OpenAlex (verify before submission).', weight: 0.05 })
  }

  if (journal.worksCount && journal.worksCount > 500) {
    score += 0.1
    evidence.push({
      field: 'Activity',
      detail: `${journal.worksCount} works indexed — established venue.`,
      weight: 0.1
    })
  }

  if (journal.subjects.length > 0) {
    evidence.push({
      field: 'Scope',
      detail: `Subjects: ${journal.subjects.slice(0, 4).join('; ')}`,
      weight: 0.1
    })
    score += 0.1
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

export function rankJournals(manuscript: Manuscript, journals: JournalCandidate[]): JournalMatch[] {
  const seen = new Set<string>()
  const unique: JournalCandidate[] = []
  for (const j of journals) {
    const key = (j.issn ?? j.title).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(j)
  }
  return unique
    .map((j) => scoreJournal(manuscript, j))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
}
