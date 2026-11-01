import type { JournalMatch } from '../types'
import type { SubmissionAttempt, SubmissionStatus } from './submissions'
import { uid } from '../lib/storage'

export const WORKSPACE_VERSION = 1
export const READINESS_ENGINE_VERSION = 'pubrooter-readiness-v2'
export const RANKING_ENGINE_VERSION = 'pubrooter-rank-v1'

export type AnalysisStatus =
  | 'draft'
  | 'uploaded'
  | 'extracting'
  | 'reviewing'
  | 'matching'
  | 'generating'
  | 'completed'
  | 'failed'

export interface ExtractedContent {
  title: string
  abstract: string
  keywords: string[]
  field: string
  articleType: string
  objectives: string
  methods: string
  sections: string[]
  entities: string[]
  referenceCount: number
  wordCount: number
  pageCount: number
  extractionWarnings: string[]
}

export interface ResearchPreferences {
  subjectArea: string
  oaPreferred: boolean
  apcMaxUsd: number | null
  articleType: string
  preferredPublisher: string
  indexingRequired: string[]
  excludedJournals: string[]
}

export interface AnalysisResult {
  ranAt: string
  matches: JournalMatch[]
  tiers: Record<FitTier, string[]>
  notices: string[]
  engineVersion: string
  candidateCount: number
}

export type FitTier = 'tier1' | 'tier2' | 'tier3'

export type CheckStatus = 'pass' | 'attention' | 'warning' | 'not-checked' | 'unknown'

export interface ReadinessCheck {
  id: string
  label: string
  status: CheckStatus
  explanation: string
  sourceUrl?: string
  evidence?: string
}

export interface ReadinessAudit {
  id: string
  journalId: string
  journalTitle: string
  runAt: string
  engineVersion: string
  checks: ReadinessCheck[]
}

export interface ManuscriptProject {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  fileName: string | null
  fileSize: number | null
  hasStoredFile: boolean
  status: AnalysisStatus
  error: string | null
  extracted: ExtractedContent | null
  edited: ExtractedContent | null
  preferences: ResearchPreferences
  analysis: AnalysisResult | null
  audits: ReadinessAudit[]
  selectedJournalId: string | null
  comparedJournalIds: string[]
  actionsCompleted: string[]
  submissions: SubmissionAttempt[]
  /** Supporting documents attached to the project (reused across journals). */
  attachedDocs?: AttachedDoc[]
  /** Prepared submission packages, keyed by journal id. */
  journalPackages?: Record<string, SubmissionPackage>
}

/** A supporting document attached to the project (upload or generated extra). */
export interface AttachedDoc {
  docId: string
  name: string
  size: number
  type: string
  storedAt: string
  source?: 'upload' | 'stored' | 'extracted'
}

export type PackageCheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

/** One validation result from the final prepare-time document check. */
export interface PackageCheck {
  id: string
  label: string
  status: PackageCheckStatus
  detail: string
}

/** A prepared, journal-validated submission package. */
export interface SubmissionPackage {
  journalId: string
  journalTitle: string
  citationStyle: string
  docs: AttachedDoc[]
  extras: AttachedDoc[]
  preparedAt: string
  /** Final document checks run at prepare time. */
  checks?: PackageCheck[]
  /** Readiness audit summary captured at prepare time. */
  readiness?: { pass: number; attention: number; warning: number; unknown: number; runAt: string }
}

export interface ActivityEvent {
  id: string
  at: string
  kind: 'project' | 'analysis' | 'readiness' | 'save' | 'report' | 'settings'
  detail: string
  projectId?: string
}

export interface SavedJournalRecord {
  id: string
  savedAt: string
  journalId: string
  title: string
  publisher?: string
  issn?: string
  link?: string
  score?: number
  note?: string
}

export interface WorkspaceProfile {
  name: string
  email: string
  affiliation: string
}

export interface WorkspaceData {
  version: number
  profile: WorkspaceProfile
  projects: ManuscriptProject[]
  savedJournals: SavedJournalRecord[]
  activity: ActivityEvent[]
  defaultPreferences: ResearchPreferences
  createdAt: string
}

export const DEFAULT_PREFERENCES: ResearchPreferences = {
  subjectArea: '',
  oaPreferred: false,
  apcMaxUsd: null,
  articleType: '',
  preferredPublisher: '',
  indexingRequired: [],
  excludedJournals: []
}

export function emptyWorkspace(profile: WorkspaceProfile): WorkspaceData {
  return {
    version: WORKSPACE_VERSION,
    profile,
    projects: [],
    savedJournals: [],
    activity: [],
    defaultPreferences: { ...DEFAULT_PREFERENCES },
    createdAt: new Date().toISOString()
  }
}

export function emptyProject(): ManuscriptProject {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: '',
    fileName: null,
    fileSize: null,
    hasStoredFile: false,
    status: 'draft',
    error: null,
    extracted: null,
    edited: null,
    preferences: { ...DEFAULT_PREFERENCES },
    analysis: null,
    audits: [],
    selectedJournalId: null,
    comparedJournalIds: [],
    actionsCompleted: [],
    submissions: []
  }
}

export function emptyExtracted(): ExtractedContent {
  return {
    title: '',
    abstract: '',
    keywords: [],
    field: '',
    articleType: '',
    objectives: '',
    methods: '',
    sections: [],
    entities: [],
    referenceCount: 0,
    wordCount: 0,
    pageCount: 0,
    extractionWarnings: []
  }
}
