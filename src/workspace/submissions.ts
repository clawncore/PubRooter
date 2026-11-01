import type { JournalCandidate } from '../types'
import type { ManuscriptProject, ReadinessAudit } from './types'
import { journalSiteUrl } from './journal-url'

/**
 * Persistent submission workflow model.
 *
 * A submission attempt is a separate auditable record tied to one manuscript
 * project and one target journal. Attempts are never overwritten. Status
 * changes append events to the attempt's own history.
 */

export const SUBMISSION_STAGE_COUNT = 16

export const SUBMISSION_STAGES: { id: string; label: string }[] = [
  { id: 'manuscript_uploaded', label: '1 · Manuscript uploaded' },
  { id: 'details_reviewed', label: '2 · Details reviewed' },
  { id: 'discovery_completed', label: '3 · Discovery completed' },
  { id: 'target_selected', label: '4 · Target selected' },
  { id: 'readiness_reviewed', label: '5 · Readiness reviewed' },
  { id: 'files_prepared', label: '6 · Files prepared' },
  { id: 'package_checked', label: '7 · Package checked' },
  { id: 'submitted', label: '8 · Submitted' },
  { id: 'editorial_screening', label: '9 · Editorial screening' },
  { id: 'under_review', label: '10 · Under review' },
  { id: 'revision_requested', label: '11 · Revision requested' },
  { id: 'revision_submitted', label: '12 · Revision submitted' },
  { id: 'accepted', label: '13 · Accepted' },
  { id: 'rejected', label: '14 · Rejected' },
  { id: 'withdrawn', label: '15 · Withdrawn' },
  { id: 'published', label: '16 · Published' }
]

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'revision_submitted'
  | 'accepted'
  | 'rejected'
  | 'published'
  | 'withdrawn'

export type SubmissionEventType =
  | 'created'
  | 'status'
  | 'submission_recorded'
  | 'decision'
  | 'revision_requested'
  | 'revision_submitted'
  | 'withdrawn'
  | 'resubmitted'
  | 'rerouted'
  | 'note_added'

export interface SubmissionEvent {
  id: string
  at: string
  type: SubmissionEventType
  status?: SubmissionStatus
  note?: string
}

export interface SubmissionDoc {
  id: string
  label: string
  required: boolean
  status: 'present' | 'missing' | 'unknown' | 'preparing'
  note?: string
}

/** Journal-specific submission requirements.
 * In production this would come from scraping journal "Instructions for Authors"
 * or an integrated service. For now, a small built-in registry covers common
 * publishers; for unknown journals we fall back to the journal homepage and
 * surface the generic checks the readiness engine can verify.
 */
export interface JournalRequirements {
  journalId: string
  journalTitle: string
  wordLimitAbstract?: number
  wordLimitMainText?: number
  referenceStyle: string
  /** Accepted formats for the main manuscript file (editable source preferred). */
  manuscriptFormat: string[]
  figureFormat: string[]
  tableFormat: string[]
  supplementaryFormat: string[]
  requiresCoverLetter: boolean
  requiresTitlePage: boolean
  requiresStructuredAbstract: boolean
  requiresDataAvailability: boolean
  requiresEthicsStatement: boolean
  requiresConflictOfInterest: boolean
  requiresFunding: boolean
  requiresORCID: boolean
  acceptsSeparateImageFiles: boolean
  acceptsSeparateTableFiles: boolean
  requiresDoubleBlind: boolean
  requiresCodeAvailability: boolean
  maxFileSizeMb?: number
  maxFigures?: number
  maxTables?: number
  maxReferences?: number
  /** Where these requirements came from. */
  source: 'known' | 'homepage'
  /** Link the user should verify these against. */
  sourceUrl: string
}

/** Required supporting documents for a journal (shared by readiness + package checks). */
export function requiredSupportingDocs(reqs: JournalRequirements): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = []
  if (reqs.requiresCoverLetter) out.push({ id: 'cover_letter', label: 'Cover letter' })
  if (reqs.requiresTitlePage) out.push({ id: 'title_page', label: 'Title page' })
  if (reqs.requiresStructuredAbstract) out.push({ id: 'structured_abstract', label: 'Structured abstract' })
  if (reqs.requiresDataAvailability) out.push({ id: 'data_availability', label: 'Data availability statement' })
  if (reqs.requiresEthicsStatement) out.push({ id: 'ethics_statement', label: 'Ethics statement' })
  if (reqs.requiresConflictOfInterest) out.push({ id: 'coi_statement', label: 'Conflict of interest statement' })
  if (reqs.requiresFunding) out.push({ id: 'funding_statement', label: 'Funding statement' })
  if (reqs.requiresORCID) out.push({ id: 'orcid', label: 'ORCID IDs' })
  return out
}

/* ---- Built-in registry for common publishers/journals ---- */
function baseRequirements(journalId: string, title: string, url: string): JournalRequirements {
  return {
    journalId, journalTitle: title,
    referenceStyle: 'Verify on journal site',
    manuscriptFormat: ['DOC', 'DOCX', 'PDF'],
    figureFormat: [], tableFormat: [], supplementaryFormat: [],
    requiresCoverLetter: true, requiresTitlePage: true,
    requiresStructuredAbstract: false,
    requiresDataAvailability: false, requiresEthicsStatement: false,
    requiresConflictOfInterest: false, requiresFunding: false,
    requiresORCID: false,
    acceptsSeparateImageFiles: false, acceptsSeparateTableFiles: false,
    requiresDoubleBlind: false, requiresCodeAvailability: false,
    source: 'homepage', sourceUrl: url
  }
}

const KNOWN_REQUIREMENTS: Record<string, Partial<JournalRequirements>> = {
  // PLOS journals
  'openalex:W2744378909': {
    referenceStyle: 'Vancouver (numbered), DOI required',
    manuscriptFormat: ['DOC', 'DOCX', 'ODT', 'PDF', 'LaTeX'],
    figureFormat: ['TIFF', 'EPS', 'PNG', 'JPEG'],
    tableFormat: ['CSV', 'XLSX'],
    supplementaryFormat: ['PDF', 'XLSX', 'DOCX', 'ZIP'],
    requiresStructuredAbstract: true,
    requiresDataAvailability: true,
    requiresEthicsStatement: true,
    requiresConflictOfInterest: true,
    requiresFunding: true,
    requiresORCID: true,
    acceptsSeparateImageFiles: true,
    acceptsSeparateTableFiles: true,
    requiresDoubleBlind: true,
    requiresCodeAvailability: true,
    source: 'known',
    sourceUrl: 'https://journals.plos.org/plosone/submitting'
  },
  // Elsevier (generic)
  'publisher:elsevier': {
    referenceStyle: 'Harvard or journal-specific (verify on site)',
    manuscriptFormat: ['DOC', 'DOCX', 'PDF'],
    figureFormat: ['TIFF', 'EPS', 'PNG', 'JPEG'],
    tableFormat: ['Word', 'Excel', 'LaTeX'],
    supplementaryFormat: ['PDF', 'XLSX', 'DOCX', 'ZIP', 'MP4', 'AVI'],
    requiresCoverLetter: true,
    requiresTitlePage: true,
    requiresORCID: true,
    maxFileSizeMb: 35,
    source: 'known',
    sourceUrl: 'https://www.elsevier.com/authors'
  },
  // Springer Nature (generic)
  'publisher:springer': {
    referenceStyle: 'Vancouver (numbered) or journal-specific',
    manuscriptFormat: ['DOCX', 'PDF'],
    figureFormat: ['EPS', 'TIFF', 'PNG', 'JPEG', 'SVG'],
    tableFormat: ['Word', 'Excel'],
    supplementaryFormat: ['PDF', 'XLSX', 'DOCX', 'ZIP'],
    requiresCoverLetter: true,
    requiresTitlePage: true,
    requiresORCID: true,
    requiresDataAvailability: true,
    maxFileSizeMb: 15,
    source: 'known',
    sourceUrl: 'https://www.springer.com/gp/authors-editors'
  },
  // IEEE
  'publisher:ieee': {
    referenceStyle: 'IEEE (numbered)',
    manuscriptFormat: ['PDF', 'LaTeX', 'DOCX'],
    figureFormat: ['EPS', 'TIFF', 'PNG', 'JPEG', 'PDF'],
    tableFormat: ['Word', 'Excel', 'LaTeX'],
    supplementaryFormat: ['PDF', 'ZIP', 'MP4'],
    requiresCoverLetter: true,
    requiresTitlePage: true,
    requiresStructuredAbstract: true,
    maxFileSizeMb: 10,
    source: 'known',
    sourceUrl: 'https://ieeeauthorcenter.ieee.org'
  },
  // Wiley
  'publisher:wiley': {
    referenceStyle: 'APA (author-year) or journal-specific',
    manuscriptFormat: ['DOC', 'DOCX', 'PDF'],
    figureFormat: ['TIFF', 'EPS', 'PNG', 'JPEG'],
    tableFormat: ['Word', 'Excel', 'LaTeX'],
    supplementaryFormat: ['PDF', 'XLSX', 'DOCX', 'ZIP', 'MP4'],
    requiresCoverLetter: true,
    requiresTitlePage: true,
    requiresDataAvailability: true,
    requiresConflictOfInterest: true,
    maxFileSizeMb: 20,
    source: 'known',
    sourceUrl: 'https://authorservices.wiley.com'
  }
}

/** Look up journal-specific submission requirements.
 * Tries exact journal ID match, then publisher-level match, then falls back
 * to the journal homepage with generic requirements.
 */
export function getJournalRequirements(journal: JournalCandidate): JournalRequirements {
  const base = baseRequirements(
    journal.id,
    journal.title,
    journalSiteUrl(journal) ?? ''
  )

  // 1. Exact journal match in registry
  const exact = KNOWN_REQUIREMENTS[journal.id]
  if (exact) {
    return { ...base, journalId: journal.id, journalTitle: journal.title, ...exact } as JournalRequirements
  }

  // 2. Publisher-level match (extract publisher from journal id or dedupe)
  const publisherKey = journal.publisher
    ? `publisher:${journal.publisher.toLowerCase().replace(/\s+/g, '')}`
    : ''
  const pubMatch = publisherKey && KNOWN_REQUIREMENTS[publisherKey]
  if (pubMatch) {
    return { ...base, journalId: journal.id, journalTitle: journal.title, ...pubMatch } as JournalRequirements
  }

  // 3. Fallback. Homepage, generic requirements
  return {
    ...base,
    referenceStyle: 'Verify author instructions on the journal homepage',
    requiresCoverLetter: true,
    requiresTitlePage: true,
    requiresDataAvailability: true,
    requiresEthicsStatement: true,
    requiresConflictOfInterest: true,
    requiresFunding: true,
    source: 'homepage'
  }
}

export interface RevisionComment {
  id: string
  reviewer: string
  comment: string
  response?: string
}

export interface RevisionResponse {
  id: string
  reviewer: string
  response: string
}

export interface Revision {
  status?: SubmissionStatus
  deadline?: string
  comments: RevisionComment[]
  responses: RevisionResponse[]
}

export interface Decision {
  status: 'accepted' | 'rejected'
  date?: string
  notes?: string
}

export interface SubmissionAttempt {
  id: string
  projectId: string
  attemptNumber: number
  status: SubmissionStatus
  targetJournalId: string | null
  targetJournalTitle: string
  officialPortalUrl?: string
  externalManuscriptId?: string
  submissionDate?: string | null
  correspondingAuthorNotes?: string
  requiredDocs: SubmissionDoc[]
  readinessAuditId?: string | null
  decision?: Decision
  revision?: Revision
  /** When this attempt was rerouted from an earlier attempt on the same
   *  manuscript, the previous attempt it continues from. */
  reroutedFromAttemptId?: string | null
  reroutedFromJournalTitle?: string | null
  createdAt: string
  updatedAt: string
  events: SubmissionEvent[]
}

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  revision_requested: 'Revision requested',
  revision_submitted: 'Revision submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  published: 'Published',
  withdrawn: 'Withdrawn'
}

/** Submission status keyed to a CSS badge class suffix. */
export const SUBMISSION_STATUS_CLASS: Record<SubmissionStatus, string> = {
  draft: 'idle',
  submitted: 'submitted',
  under_review: 'under_review',
  revision_requested: 'revision_requested',
  revision_submitted: 'revision_submitted',
  accepted: 'accepted',
  rejected: 'rejected',
  published: 'published',
  withdrawn: 'withdrawn'
}

/** Human labels for event history entries. */
export const EVENT_LABEL: Record<SubmissionEventType, string> = {
  created: 'Created',
  status: 'Status updated',
  submission_recorded: 'Submission recorded',
  decision: 'Decision recorded',
  revision_requested: 'Revision requested',
  revision_submitted: 'Revision submitted',
  withdrawn: 'Withdrawn',
  resubmitted: 'Resubmitted',
  rerouted: 'Rerouted',
  note_added: 'Note added'
}

/** Statuses reachable from each status. Terminal statuses (rejected,
 *  published, withdrawn) have no successors: a rejected attempt is continued
 *  by rerouting to a new journal, never by mutating its outcome. */
const TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: ['submitted', 'rejected', 'withdrawn'],
  submitted: ['under_review', 'revision_requested', 'accepted', 'rejected', 'withdrawn'],
  under_review: ['revision_requested', 'accepted', 'rejected', 'withdrawn'],
  revision_requested: ['revision_submitted', 'accepted', 'rejected', 'withdrawn'],
  revision_submitted: ['under_review', 'accepted', 'rejected', 'withdrawn'],
  accepted: ['published'],
  rejected: [],
  published: [],
  withdrawn: []
}

export function allowedTransitions(status: SubmissionStatus): SubmissionStatus[] {
  return TRANSITIONS[status] ?? []
}

export interface SubmissionContext {
  hasAnalysis: boolean
  hasTarget: boolean
  hasReadiness: boolean
  hasPackage: boolean
}

function stageId(id: string) {
  return SUBMISSION_STAGES.findIndex((s) => s.id === id) + 1
}

/**
 * Map an attempt onto the 16-stage publication pipeline. The stage reflects
 * real persisted state (analysis → target → readiness → package → submit).
 * never the passage of time and never an inferred editorial outcome.
 */
export function stageForAttempt(attempt: SubmissionAttempt, ctx: SubmissionContext): number {
  switch (attempt.status) {
    case 'withdrawn':
      return stageId('withdrawn')
    case 'published':
      return stageId('published')
    case 'accepted':
      return stageId('accepted')
    case 'rejected':
      return stageId('rejected')
    case 'revision_submitted':
      return stageId('revision_submitted')
    case 'revision_requested':
      return stageId('revision_requested')
    case 'under_review':
      return stageId('under_review')
    case 'submitted':
      return stageId('submitted')
    case 'draft':
    default: {
      if (!ctx.hasAnalysis) return stageId('manuscript_uploaded')
      if (!ctx.hasTarget) return stageId('details_reviewed')
      if (!ctx.hasReadiness) return stageId('target_selected')
      if (!ctx.hasPackage) return stageId('readiness_reviewed')
      return stageId('package_checked')
    }
  }
}

export interface NextAction {
  stage: number
  action: string
  detail: string
}

/** Honest next action: derived from persisted state, not from elapsed time. */
export function nextActionFor(attempt: SubmissionAttempt, ctx: SubmissionContext): NextAction {
  switch (attempt.status) {
    case 'draft': {
      const stage = stageForAttempt(attempt, ctx)
      const action = !ctx.hasAnalysis
        ? 'Upload and analyze the manuscript'
        : !ctx.hasTarget
          ? 'Choose a target journal'
          : !ctx.hasReadiness
            ? 'Run the readiness check'
            : !ctx.hasPackage
              ? 'Prepare the submission package'
              : 'Check the submission package'
      const detail = !ctx.hasAnalysis
        ? 'A submission cannot start before analysis completes.'
        : !ctx.hasTarget
          ? 'Pick a journal from the manuscript recommendations to continue.'
          : !ctx.hasReadiness
            ? `Run a readiness audit for ${attempt.targetJournalTitle} before preparing files.`
            : !ctx.hasPackage
              ? 'Resolve outstanding items before package check.'
              : 'Verify required documents before starting a submission.'
      return { stage, action, detail }
    }
    case 'submitted':
      return { stage: stageForAttempt(attempt, ctx), action: 'Await editorial decision', detail: 'PubRooter did not submit anywhere. Record the portal outcome when the researcher confirms it.' }
    case 'under_review':
      return { stage: stageForAttempt(attempt, ctx), action: 'Await decision or revision', detail: 'Track reviewer/editor communications in the attempt history.' }
    case 'revision_requested':
      return { stage: stageForAttempt(attempt, ctx), action: 'Respond to revision request', detail: 'Record the decision date, gather reviewer comments, and prepare responses.' }
    case 'revision_submitted':
      return { stage: stageForAttempt(attempt, ctx), action: 'Await next editorial decision', detail: 'A revised package was recorded. Wait for the editor’s next move.' }
    case 'accepted':
      return { stage: stageForAttempt(attempt, ctx), action: 'Record acceptance and proceed to publication steps', detail: 'Retain full attempt history; confirm final author actions.' }
    case 'rejected':
      return { stage: stageForAttempt(attempt, ctx), action: 'Choose a new target journal or withdraw', detail: 'Start a new attempt for a different journal; keep this attempt for decision history.' }
    case 'published':
      return { stage: stageForAttempt(attempt, ctx), action: 'Archive and retain history', detail: 'Published. Retain the attempt record and exports.' }
    case 'withdrawn':
      return { stage: stageForAttempt(attempt, ctx), action: 'Closed. No further action', detail: 'Attempt withdrawn; history is retained.' }
  }
}

export function contextFromProject(project: ManuscriptProject): SubmissionContext {
  const hasAnalysis = Boolean(project.analysis && project.analysis.matches.length > 0)
  const hasTarget = Boolean(project.selectedJournalId)
  const hasReadiness = project.audits.length > 0
  // A package can only be said to be ready when every checkable item passes.
  // unknowns are surfaced as unknown, never passed.
  const latest = project.audits[0]
  let hasPackage = false
  if (latest) {
    const checkable = latest.checks.filter((c) => c.status !== 'unknown' && c.status !== 'not-checked')
    hasPackage = checkable.length > 0 && checkable.every((c) => c.status === 'pass')
  }
  return { hasAnalysis, hasTarget, hasReadiness, hasPackage }
}

/** Build journal-specific required-docs checklist.
 * Uses the journal's requirements (from getJournalRequirements) to determine
 * what documents are needed, their status, and notes linking to the journal's
 * author instructions.
 */
export function buildRequiredDocs(project: ManuscriptProject, journal: JournalCandidate, audit?: ReadinessAudit): SubmissionDoc[] {
  const reqs = getJournalRequirements(journal)
  const docs: SubmissionDoc[] = [
    {
      id: 'manuscript',
      label: 'Manuscript file (final version)',
      required: true,
      status: project.hasStoredFile ? 'present' : 'missing',
      note: project.hasStoredFile
        ? 'Stored manuscript PDF.'
        : 'No manuscript file stored for this project.' +
          (reqs.maxFileSizeMb ? ` Journal accepts up to ${reqs.maxFileSizeMb} MB.` : '')
    }
  ]

  docs.push({
    id: 'cover_letter',
    label: `Cover letter${reqs.requiresCoverLetter ? ' (required)' : ' (optional)'}`,
    required: reqs.requiresCoverLetter,
    status: 'unknown',
    note: reqs.source === 'known'
      ? `Journal guidelines: cover letter required.`
      : `Verify on journal site. Cover letter requirement not confirmed in open metadata.`
  })

  docs.push({
    id: 'title_page',
    label: `Title page / author declarations${reqs.requiresTitlePage ? ' (required)' : ''}`,
    required: reqs.requiresTitlePage,
    status: 'unknown',
    note: reqs.source === 'known'
      ? `Journal guidelines: title page with declarations required.`
      : `Verify on journal site. Author declaration requirements may include COI, funding, ethics statements.`
  })

  if (reqs.requiresStructuredAbstract) {
    docs.push({
      id: 'structured_abstract',
      label: 'Structured abstract',
      required: true,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires a structured abstract with section headings.`
        : `Verify on journal site. Structured abstract format required.`
    })
  }

  if (reqs.requiresDataAvailability) {
    docs.push({
      id: 'data_availability',
      label: 'Data availability statement',
      required: true,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires a data availability statement.`
        : `Verify on journal site. Data sharing statement required.`
    })
  }

  if (reqs.requiresEthicsStatement) {
    docs.push({
      id: 'ethics_statement',
      label: 'Ethics statement',
      required: reqs.requiresEthicsStatement,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires an ethics statement.`
        : `Verify on journal site. Ethics/IRB statement may be required.`
    })
  }

  if (reqs.requiresConflictOfInterest) {
    docs.push({
      id: 'coi_statement',
      label: 'Conflict of interest statement',
      required: true,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires a conflict-of-interest disclosure.`
        : `Verify on journal site: COI disclosure may be required.`
    })
  }

  if (reqs.requiresFunding) {
    docs.push({
      id: 'funding_statement',
      label: 'Funding statement',
      required: true,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires a funding statement.`
        : `Verify on journal site. Funding/grant information may be required.`
    })
  }

  if (reqs.requiresORCID) {
    docs.push({
      id: 'orcid',
      label: 'ORCID for all authors',
      required: true,
      status: 'unknown',
      note: reqs.source === 'known'
        ? `Journal requires ORCID iDs for all authors.`
        : `Verify on journal site: ORCID may be required.`
    })
  }

  docs.push({
    id: 'figures',
    label: `Figures and supplementary material${reqs.requiresCodeAvailability ? ' + code' : ''}`,
    required: false,
    status: 'unknown',
    note: reqs.acceptsSeparateImageFiles || reqs.acceptsSeparateTableFiles
      ? `Journal accepts separate ${reqs.acceptsSeparateImageFiles ? 'image' : ''}${reqs.acceptsSeparateImageFiles && reqs.acceptsSeparateTableFiles ? ' and ' : ''}${reqs.acceptsSeparateTableFiles ? 'table' : ''} files. Accepted formats: ${[...reqs.figureFormat, ...reqs.tableFormat, ...reqs.supplementaryFormat].join(', ') || 'verify on site'}.`
      : `Verify file-format requirements on the journal site.` +
        (reqs.requiresCodeAvailability ? ' Code/data availability statement also required.' : '')
  })

  return docs
}

export function makeEvent(type: SubmissionEventType, note?: string, status?: SubmissionStatus): SubmissionEvent {
  return { id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), type, note, status }
}

export function appendEvent(attempt: SubmissionAttempt, type: SubmissionEventType, note?: string, status?: SubmissionStatus): SubmissionAttempt {
  const ev = makeEvent(type, note, status)
  return { ...attempt, status: status ?? attempt.status, updatedAt: ev.at, events: [...attempt.events, ev] }
}

export function transitionAttempt(attempt: SubmissionAttempt, next: SubmissionStatus, note?: string, at?: string): SubmissionAttempt {
  const typeMap: Record<string, SubmissionEventType> = {
    draft: 'created',
    submitted: 'submission_recorded',
    under_review: 'status',
    revision_requested: 'revision_requested',
    revision_submitted: 'revision_submitted',
    accepted: 'decision',
    rejected: 'decision',
    published: 'status',
    withdrawn: 'withdrawn'
  }
  const ev = makeEvent(typeMap[next] ?? 'status', note, next)
  const nextAttempt: SubmissionAttempt = { ...attempt, status: next, updatedAt: at ?? ev.at, events: [...attempt.events, ev] }
  if (next === 'submitted' && !nextAttempt.submissionDate) {
    nextAttempt.submissionDate = at ?? ev.at
  }
  if ((next === 'accepted' || next === 'rejected') && attempt.decision) {
    nextAttempt.decision = { ...attempt.decision, status: next, date: ev.at, notes: note ?? attempt.decision.notes }
  }
  if (next === 'revision_requested' && attempt.revision) {
    nextAttempt.revision = { ...attempt.revision, status: next }
  }
  if (next === 'revision_submitted' && attempt.revision) {
    nextAttempt.revision = { ...attempt.revision, status: next }
  }
  return nextAttempt
}

export function createDraftAttempt(project: ManuscriptProject, journal: JournalCandidate, attemptNumber: number): SubmissionAttempt {
  const now = new Date().toISOString()
  const attempt: SubmissionAttempt = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    attemptNumber,
    status: 'draft',
    targetJournalId: journal.id,
    targetJournalTitle: journal.title,
    requiredDocs: buildRequiredDocs(project, journal, project.audits[0]),
    createdAt: now,
    updatedAt: now,
    events: [makeEvent('created', `Submission attempt ${attemptNumber} started against ${journal.title}.`, 'draft')]
  }
  return attempt
}

/** A rerouted attempt continues the same manuscript against a new journal.
 *  The previous attempt is never touched — the link and the reason live on
 *  the new attempt, so both histories stay intact and auditable. */
export function createRerouteAttempt(
  project: ManuscriptProject,
  journal: JournalCandidate,
  attemptNumber: number,
  previous: SubmissionAttempt,
  note?: string
): SubmissionAttempt {
  const now = new Date().toISOString()
  const reason = note?.trim()
    ? ` ${note.trim()}`
    : ''
  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    attemptNumber,
    status: 'draft',
    targetJournalId: journal.id,
    targetJournalTitle: journal.title,
    requiredDocs: buildRequiredDocs(project, journal, project.audits[0]),
    reroutedFromAttemptId: previous.id,
    reroutedFromJournalTitle: previous.targetJournalTitle,
    createdAt: now,
    updatedAt: now,
    events: [
      makeEvent(
        'rerouted',
        `Rerouted from ${previous.targetJournalTitle} (attempt #${previous.attemptNumber}, ${SUBMISSION_STATUS_LABEL[previous.status]}). New target: ${journal.title}.${reason}`,
        'draft'
      )
    ]
  }
}

export interface PostSubmissionStats {
  manuscripts: number
  attempts: number
  draft: number
  submitted: number
  inReview: number
  revisionRequested: number
  decided: number
  accepted: number
  rejected: number
  published: number
  withdrawn: number
  reroutes: number
  /** accepted + published ÷ decided, or null when nothing has been decided. */
  acceptanceRate: number | null
}

/** Aggregate post-submission outcomes across every manuscript project.
 *  Counts only persisted attempt state — no elapsed time, no inferred
 *  editorial outcomes. */
export function postSubmissionStats(projects: ManuscriptProject[]): PostSubmissionStats {
  const stats: PostSubmissionStats = {
    manuscripts: projects.length,
    attempts: 0,
    draft: 0,
    submitted: 0,
    inReview: 0,
    revisionRequested: 0,
    decided: 0,
    accepted: 0,
    rejected: 0,
    published: 0,
    withdrawn: 0,
    reroutes: 0,
    acceptanceRate: null
  }
  for (const p of projects) {
    for (const a of p.submissions ?? []) {
      stats.attempts++
      if (a.reroutedFromAttemptId) stats.reroutes++
      switch (a.status) {
        case 'draft': stats.draft++; break
        case 'submitted': stats.submitted++; break
        case 'under_review': stats.inReview++; break
        case 'revision_requested':
        case 'revision_submitted':
          stats.inReview++
          stats.revisionRequested++
          break
        case 'accepted': stats.accepted++; stats.decided++; break
        case 'rejected': stats.rejected++; stats.decided++; break
        case 'published': stats.published++; stats.accepted++; stats.decided++; break
        case 'withdrawn': stats.withdrawn++; break
      }
    }
  }
  if (stats.decided > 0) stats.acceptanceRate = Math.round((stats.accepted / stats.decided) * 100)
  return stats
}
