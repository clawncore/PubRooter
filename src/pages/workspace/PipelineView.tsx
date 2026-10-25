import { useMemo, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import {
  SUBMISSION_STAGE_COUNT,
  SUBMISSION_STAGES,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_CLASS,
  contextFromProject,
  nextActionFor,
  stageForAttempt,
  type SubmissionAttempt,
  type SubmissionStatus
} from '../../workspace/submissions'
import type { WorkspaceView } from './WorkspaceApp'

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

const ATTEMPT_STATUSES: SubmissionStatus[] = ['draft', 'submitted', 'under_review', 'revision_requested', 'revision_submitted', 'accepted', 'rejected', 'published', 'withdrawn']

export function PipelineView({ go }: { go: (v: WorkspaceView) => void }) {
  const { data } = useWorkspace()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const attempts = useMemo(() => {
    if (!data) return []
    const list: { projectId: string; attempt: SubmissionAttempt; stage: number }[] = []
    for (const p of data.projects) {
      for (const a of p.submissions ?? []) {
        list.push({ projectId: p.id, attempt: a, stage: stageForAttempt(a, contextFromProject(p)) })
      }
    }
    const filtered = statusFilter === 'all' ? list : list.filter((x) => x.attempt.status === statusFilter)
    return filtered.sort((a, b) => b.stage - a.stage || Date.parse(b.attempt.updatedAt) - Date.parse(a.attempt.updatedAt))
  }, [data, statusFilter])

  if (!data) return null

  return (
    <div>
      <h1 className="ws-h1">Publication Pipeline</h1>
      <p className="ws-sub">
        Persistent workflow from manuscript analysis through submission, editorial decisions, revisions, and publication.
        Every attempt is an auditable event history — nothing is overwritten or lost.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        <label className="ws-field" style={{ marginBottom: 0, minWidth: 180 }}>
          <span className="ws-label">Filter by status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter attempts by status">
            <option value="all">All statuses</option>
            {ATTEMPT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUBMISSION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {attempts.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>No submission attempts yet</strong>
          Open a manuscript and choose a target journal to begin a submission attempt.
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'manuscripts' })}>
              My Manuscripts
            </button>
          </div>
        </div>
      ) : (
        <div className="ws-card" style={{ padding: '0 1.25rem' }}>
          <div className="ws-table-scroll">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Manuscript</th>
                  <th>Attempt</th>
                  <th>Target journal</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Last updated</th>
                  <th>Next action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(({ projectId, attempt, stage }) => {
                  const project = data.projects.find((p) => p.id === projectId)
                  const next = nextActionFor(attempt, contextFromProject(project!))
                  return (
                    <tr key={attempt.id}>
                      <td>
                        <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: projectId })}>
                          {project?.name ?? 'Unknown manuscript'}
                        </button>
                      </td>
                      <td>#{attempt.attemptNumber}</td>
                      <td style={{ maxWidth: 200 }}>{attempt.targetJournalTitle}</td>
                      <td>
                        <span className={`ws-status ws-status-${SUBMISSION_STATUS_CLASS[attempt.status]}`}>{SUBMISSION_STATUS_LABEL[attempt.status]}</span>
                      </td>
                      <td>
                        Stage {stage} / {SUBMISSION_STAGE_COUNT} · {SUBMISSION_STAGES[stage - 1]?.label ?? '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmt(attempt.updatedAt)}</td>
                      <td style={{ maxWidth: 220 }}>{next.action}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <button type="button" className="ws-linkish" onClick={() => go({ name: 'submission-prep', id: projectId })}>
                            Prepare
                          </button>
                          <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: projectId })}>
                            Project
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
