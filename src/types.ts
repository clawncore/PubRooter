export interface Manuscript {
  id: string
  title: string
  abstract: string
  keywords: string[]
  createdAt: string
}

export interface JournalCandidate {
  id: string
  title: string
  issn?: string
  publisher?: string
  isOpenAccess?: boolean
  apcUsd?: number
  subjects: string[]
  worksCount?: number
  citedness?: number
  citedness4?: number
  homepageUrl?: string
  source: 'openalex' | 'crossref' | 'demo'
  sourceUrl?: string
}

export interface MatchEvidence {
  field: string
  detail: string
  weight: number
}

export interface JournalMatch {
  journal: JournalCandidate
  score: number
  evidence: MatchEvidence[]
  limitations: string[]
}

export interface RequirementItem {
  id: string
  label: string
  status: 'met' | 'unknown' | 'pending'
  note?: string
}

export interface Project {
  id: string
  name: string
  manuscript: Manuscript
  matches: JournalMatch[]
  selectedJournalId?: string
  checklist: RequirementItem[]
  updatedAt: string
}
