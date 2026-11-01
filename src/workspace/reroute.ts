import type { JournalCandidate } from '../types'
import type { ManuscriptProject } from './types'
import { createDraftAttempt, createRerouteAttempt } from './submissions'
import { runReadiness } from './readiness'
import { uid } from '../lib/storage'

/**
 * Reroute a manuscript to a different journal.
 *
 * Creates a NEW submission attempt against `journal` linked to the previous
 * attempt, runs a fresh readiness audit for the new journal using the
 * already-attached documents, and retargets the project. The previous attempt
 * and its event history are never modified. The document package for the new
 * journal is prepared in the journal portal — attached files stay with the
 * project, so nothing has to be re-uploaded.
 */
export function rerouteProjectToJournal(
  project: ManuscriptProject,
  journal: JournalCandidate,
  previousAttemptId: string,
  note?: string
): ManuscriptProject {
  const previous = project.submissions.find((a) => a.id === previousAttemptId)
  const attemptNumber = project.submissions.length + 1
  const attempt = previous
    ? createRerouteAttempt(project, journal, attemptNumber, previous, note)
    : createDraftAttempt(project, journal, attemptNumber)

  const edited = project.edited ?? project.extracted
  const audit = edited
    ? runReadiness(edited, journal, uid(), project.attachedDocs ?? [], project.hasStoredFile)
    : null

  return {
    ...project,
    submissions: [...project.submissions, attempt],
    selectedJournalId: journal.id,
    audits: audit ? [audit, ...project.audits].slice(0, 20) : project.audits
  }
}
