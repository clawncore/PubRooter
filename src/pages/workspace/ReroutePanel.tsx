import { useMemo, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { rerouteProjectToJournal } from '../../workspace/reroute'
import type { ManuscriptProject } from '../../workspace/types'
import type { JournalMatch } from '../../types'

/**
 * Reroute picker: choose the next journal for this manuscript.
 *
 * Shows the manuscript's ranked recommendations that are not already
 * attempted. Picking one creates a new linked submission attempt, runs a
 * readiness audit for the new journal, and hands the caller the journal id so
 * the portal can open with the attached documents carried over — nothing is
 * re-uploaded, and the previous attempt keeps its full history.
 */
export function ReroutePanel({
  project,
  previousAttemptId,
  onRerouted,
  onFindJournals
}: {
  project: ManuscriptProject
  previousAttemptId: string
  onRerouted?: (journalId: string) => void
  onFindJournals?: () => void
}) {
  const { update } = useWorkspace()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const attemptedIds = useMemo(
    () => new Set(project.submissions.map((a) => a.targetJournalId).filter(Boolean)),
    [project.submissions]
  )
  const candidates = useMemo(
    () => (project.analysis?.matches ?? []).filter((m) => !attemptedIds.has(m.journal.id)).slice(0, 8),
    [project.analysis, attemptedIds]
  )

  async function reroute(match: JournalMatch) {
    setBusyId(match.journal.id)
    setError('')
    try {
      await update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === project.id
            ? rerouteProjectToJournal(p, match.journal, previousAttemptId, note.trim() || undefined)
            : p
        )
      }))
      onRerouted?.(match.journal.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reroute failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="ws-reroute">
      <strong className="ws-reroute-title">Reroute to another journal</strong>
      <p className="ws-reroute-note">
        The same manuscript and attached documents carry over. A new attempt is opened against the new journal and a
        fresh readiness check runs for it. The previous attempt and its history are kept exactly as they are.
      </p>
      <label className="ws-field">
        <span className="ws-label">Note for the history (optional)</span>
        <input
          type="text"
          value={note}
          maxLength={240}
          placeholder="e.g. Scope mismatch raised in the decision letter"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {candidates.length === 0 ? (
        <div className="ws-reroute-empty">
          <p>
            {project.analysis && project.analysis.matches.length > 0
              ? 'Every recommended journal for this manuscript already has an attempt. Run a new discovery to find more.'
              : 'This manuscript has no journal recommendations yet. Run discovery to build a target list.'}
          </p>
          {onFindJournals && (
            <button type="button" className="ws-btn ws-btn-outline" onClick={onFindJournals}>
              Find journals
            </button>
          )}
        </div>
      ) : (
        <ul className="ws-reroute-list">
          {candidates.map((m) => (
            <li key={m.journal.id} className="ws-reroute-item">
              <div className="ws-reroute-info">
                <strong>{m.journal.title}</strong>
                <small>
                  {m.journal.publisher ?? 'Publisher unknown'}
                  {m.journal.issn ? ` · ISSN ${m.journal.issn}` : ''}
                  {' · score '}
                  {m.score}
                </small>
              </div>
              <button
                type="button"
                className="ws-btn ws-btn-primary"
                disabled={busyId !== null}
                onClick={() => void reroute(m)}
              >
                {busyId === m.journal.id ? 'Routing…' : 'Reroute here'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" style={{ color: '#af1d1d', fontSize: 13, marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </div>
  )
}
