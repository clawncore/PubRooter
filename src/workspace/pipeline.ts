import type { JournalCandidate, JournalMatch } from '../types'
import { rankJournals } from '../lib/matching'
import { searchOpenAlex } from '../api/openalex'
import { searchCrossref } from '../api/crossref'
import type { ExtractedContent, ManuscriptProject, ResearchPreferences } from './types'
import { assignTiers } from './tiers'
import { runReadiness } from './readiness'
import { uid } from '../lib/storage'

export type ProgressFn = (status: ManuscriptProject['status'], note?: string) => void

function toManuscript(edited: ExtractedContent, projectId: string) {
  const q = [edited.title, edited.abstract, edited.keywords.join(' ')].filter(Boolean).join(' ')
  return {
    id: projectId,
    title: edited.title || q.slice(0, 90),
    abstract: edited.abstract,
    keywords: edited.keywords,
    createdAt: new Date().toISOString()
  }
}

export async function runAnalysis(project: ManuscriptProject, prefs: ResearchPreferences, onProgress: ProgressFn): Promise<ManuscriptProject> {
  const edited = project.edited ?? project.extracted
  if (!edited || !edited.title.trim()) {
    return { ...project, status: 'failed', error: 'A title is required before analysis. Add it in the review step.' }
  }

  onProgress('matching', 'Querying OpenAlex and Crossref')
  const manuscript = toManuscript(edited, project.id)
  const results: JournalCandidate[] = []
  const notices: string[] = []

  const [oaRes, crRes] = await Promise.allSettled([
    searchOpenAlex(manuscript.title, manuscript.keywords.length ? manuscript.keywords : [manuscript.title]),
    searchCrossref(manuscript.title, manuscript.keywords.length ? manuscript.keywords : [manuscript.title])
  ])
  if (oaRes.status === 'fulfilled') results.push(...oaRes.value)
  else notices.push('OpenAlex unreachable — candidate set may be partial.')
  if (crRes.status === 'fulfilled') results.push(...crRes.value)
  else notices.push('Crossref unreachable — candidate set may be partial.')
  if (results.length === 0) notices.push('No candidates returned from live sources. Check connectivity and retry.')

  onProgress('generating', 'Ranking candidates and assigning fit tiers')
  const ranked = rankJournals(manuscript, results)
  const { tiers, excluded } = assignTiers(ranked, prefs)
  for (const ex of excluded) notices.push(`Excluded from tiers: ${ex.reason}`)

  const analysis = {
    ranAt: new Date().toISOString(),
    matches: ranked,
    tiers,
    notices: [...new Set(notices)].slice(0, 12),
    engineVersion: 'pubrooter-rank-v1',
    candidateCount: results.length
  }

  const defaultJournal = ranked.find((m) => tiers.tier1.includes(m.journal.id)) ?? ranked[0]
  const audits = defaultJournal
    ? [runReadiness(edited, defaultJournal.journal, uid())]
    : []

  onProgress('completed')
  return {
    ...project,
    status: 'completed',
    error: null,
    analysis,
    audits,
    selectedJournalId: defaultJournal?.journal.id ?? null,
    updatedAt: new Date().toISOString()
  }
}
