import { Fragment, useMemo, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import {
  SUBMISSION_STAGE_COUNT,
  SUBMISSION_STAGES,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_CLASS,
  EVENT_LABEL,
  allowedTransitions,
  contextFromProject,
  nextActionFor,
  postSubmissionStats,
  stageForAttempt,
  transitionAttempt,
  type SubmissionAttempt,
  type SubmissionStatus
} from '../../workspace/submissions'
import { auditSummary } from '../../workspace/readiness'
import { journalSiteUrl } from '../../workspace/journal-url'
import { ReroutePanel } from './ReroutePanel'
import type { WorkspaceView } from './WorkspaceApp'
import type { ManuscriptProject } from '../../workspace/types'

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'

const ATTEMPT_STATUSES: SubmissionStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'revision_submitted',
  'accepted',
  'rejected',
  'published',
  'withdrawn'
]

type ReadinessBadge = { cls: string; label: string; detail: string }

function readinessBadge(journalId: string | null, audits: { journalId: string }[]): ReadinessBadge | null {
  if (!journalId) return null
  const latest = audits.find((a) => a.journalId === journalId)
  if (!latest) return null
  const s = auditSummary(latest as Parameters<typeof auditSummary>[0])
  const label =
    s.warning > 0
      ? 'Warning'
      : s.attention > 0
        ? 'Needs attention'
        : s.pass > 0
          ? 'Ready'
          : 'Unknown'
  const cls =
    s.warning > 0
      ? 'is-warning'
      : s.attention > 0
        ? 'is-attention'
        : s.pass > 0
          ? 'is-pass'
          : 'is-unknown'
  return { cls, label, detail: `${s.pass} pass · ${s.attention} attention` }
}

type PubRow = {
  key: string
  projectId: string
  projectName: string
  project?: ManuscriptProject
  attempt?: SubmissionAttempt
  stage: number
  journalId: string | null
  journalTitle: string
  publisher?: string
  issn?: string
  journalLink?: string
  readiness: ReadinessBadge | null
  statusKey: string
  statusLabel: string
  statusClass: string
  updatedAt: string
  nextAction: string
}

type RowForm = { status: string; note: string; reroute: boolean }

export function PipelineView({
  go,
  openPortal
}: {
  go: (v: WorkspaceView) => void
  openPortal: (projectId: string, journalId?: string) => void
}) {
  const { data, update } = useWorkspace()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, RowForm>>({})

  const baseRows = useMemo(() => {
    if (!data) return []
    const list: PubRow[] = []
    for (const p of data.projects) {
      const matches = p.analysis?.matches ?? []
      const attempts = p.submissions ?? []
      const attemptedJournalIds = new Set(attempts.map((a) => a.targetJournalId).filter(Boolean))

      for (const a of attempts) {
        const ctx = contextFromProject(p)
        const stage = stageForAttempt(a, ctx)
        const match = matches.find((m) => m.journal.id === a.targetJournalId)
        list.push({
          key: a.id,
          projectId: p.id,
          projectName: p.name,
          project: p,
          attempt: a,
          stage,
          journalId: a.targetJournalId,
          journalTitle: a.targetJournalTitle || match?.journal.title || 'Unknown journal',
          publisher: match?.journal.publisher,
          issn: match?.journal.issn,
          journalLink: match ? journalSiteUrl(match.journal) : undefined,
          readiness: readinessBadge(a.targetJournalId, p.audits),
          statusKey: a.status,
          statusLabel: SUBMISSION_STATUS_LABEL[a.status],
          statusClass: `ws-status-${SUBMISSION_STATUS_CLASS[a.status]}`,
          updatedAt: a.updatedAt,
          nextAction: nextActionFor(a, ctx).action
        })
      }

      const auditedIds = [...new Set(p.audits.map((a) => a.journalId))]
      for (const jid of auditedIds) {
        if (attemptedJournalIds.has(jid)) continue
        const match = matches.find((m) => m.journal.id === jid)
        const audit = p.audits.find((a) => a.journalId === jid)
        list.push({
          key: `${p.id}-${jid}`,
          projectId: p.id,
          projectName: p.name,
          project: p,
          stage: 0,
          journalId: jid,
          journalTitle: audit?.journalTitle || match?.journal.title || 'Unknown journal',
          publisher: match?.journal.publisher,
          issn: match?.journal.issn,
          journalLink: match ? journalSiteUrl(match.journal) : undefined,
          readiness: readinessBadge(jid, p.audits),
          statusKey: 'not_submitted',
          statusLabel: 'Not submitted',
          statusClass: 'ws-status-planned',
          updatedAt: audit?.runAt ?? p.updatedAt,
          nextAction: 'Prepare a submission package for this journal'
        })
      }
    }
    return list.sort((a, b) => b.stage - a.stage || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [data])

  const rows = useMemo(() => {
    if (statusFilter === 'all') return baseRows
    if (statusFilter === 'not_submitted') return baseRows.filter((r) => !r.attempt)
    return baseRows.filter((r) => r.attempt?.status === statusFilter)
  }, [baseRows, statusFilter])

  const counts = useMemo(() => {
    const c = (fn: (r: PubRow) => boolean) => baseRows.filter(fn).length
    return {
      tracked: baseRows.length,
      notSubmitted: c((r) => !r.attempt)
    }
  }, [baseRows])

  const stats = useMemo(() => (data ? postSubmissionStats(data.projects) : null), [data])

  const formFor = (key: string): RowForm => forms[key] ?? { status: '', note: '', reroute: false }
  const patchForm = (key: string, patch: Partial<RowForm>) =>
    setForms((f) => ({ ...f, [key]: { ...formFor(key), ...patch } }))

  async function recordStatus(row: PubRow) {
    const attempt = row.attempt
    if (!attempt) return
    const form = formFor(row.key)
    if (!form.status) return
    const next = form.status as SubmissionStatus
    const note = form.note.trim() || undefined
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) =>
        p.id === row.projectId
          ? {
              ...p,
              submissions: p.submissions.map((a) => (a.id === attempt.id ? transitionAttempt(a, next, note) : a))
            }
          : p
      )
    }))
    patchForm(row.key, { status: '', note: '' })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="ws-h1">Publications</h1>
          <p className="ws-sub">
            Every journal you are tracking, with its readiness verdict and submission status. Attempts are auditable
            event histories: nothing is overwritten or lost.
          </p>
        </div>
        <label className="ws-field" style={{ marginBottom: 0, minWidth: 190 }}>
          <span className="ws-label">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter journals by publication status"
          >
            <option value="all">All statuses</option>
            <option value="not_submitted">Not submitted</option>
            {ATTEMPT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUBMISSION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {baseRows.length > 0 && (
        <div className="pub-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13.5, color: '#475467' }}>
            <strong>{counts.tracked}</strong> journal{counts.tracked === 1 ? '' : 's'} tracked
            {counts.notSubmitted > 0 && <span style={{ marginLeft: '1rem' }}><strong>{counts.notSubmitted}</strong> not submitted</span>}
            {stats && stats.submitted > 0 && <span style={{ marginLeft: '1rem', color: '#2456a6' }}><strong>{stats.submitted}</strong> submitted</span>}
            {stats && stats.inReview > 0 && <span style={{ marginLeft: '1rem', color: '#d9a441' }}><strong>{stats.inReview}</strong> in review</span>}
            {stats && stats.decided > 0 && (
              <span style={{ marginLeft: '1rem', color: '#b34700' }}>
                <strong>{stats.decided}</strong> decided ({stats.accepted} accepted · {stats.rejected} rejected)
              </span>
            )}
            {stats && stats.reroutes > 0 && <span style={{ marginLeft: '1rem', color: '#6d28a8' }}><strong>{stats.reroutes}</strong> rerouted</span>}
            {stats && stats.acceptanceRate !== null && (
              <span style={{ marginLeft: '1rem', color: '#0c8930' }}>
                <strong>{stats.acceptanceRate}%</strong> acceptance
              </span>
            )}
            {stats && stats.published > 0 && <span style={{ marginLeft: '1rem', color: '#0c8930' }}><strong>{stats.published}</strong> published</span>}
          </div>
          <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'manuscripts' })}>
            Analyze a manuscript
          </button>
        </div>
      )}

      {baseRows.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>No journals tracked yet</strong>
          Open a manuscript, review its recommendations, and run a readiness check to start tracking a journal here.
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
                  <th>Journal</th>
                  <th>Readiness</th>
                  <th>Publication status</th>
                  <th>Stage</th>
                  <th>Last updated</th>
                  <th>Next action</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expanded = Boolean(r.attempt) && expandedId === r.key
                  return (
                    <Fragment key={r.key}>
                      <tr>
                    <td>
                      <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: r.projectId })}>
                        {r.projectName}
                      </button>
                    </td>
                    <td style={{ maxWidth: 230 }}>
                      <strong style={{ fontSize: 13 }}>{r.journalTitle}</strong>
                      <div style={{ fontSize: 11.5, color: '#808080', marginTop: 2 }}>
                        {r.publisher ?? 'Publisher unknown'}
                        {r.issn ? ` · ISSN ${r.issn}` : ''}
                        {r.journalLink && (
                          <>
                            {' · '}
                            <a href={r.journalLink} target="_blank" rel="noreferrer">
                              site ↗
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {r.readiness ? (
                        <>
                          <span className={`rp-status ${r.readiness.cls}`}>{r.readiness.label}</span>
                          <div style={{ fontSize: 11, color: '#808080', marginTop: 2 }}>{r.readiness.detail}</div>
                        </>
                      ) : (
                        <span className="rp-status is-none">Not run</span>
                      )}
                    </td>
                    <td>
                      <span className={`ws-status ${r.statusClass}`}>{r.statusLabel}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.attempt
                        ? `Stage ${r.stage} / ${SUBMISSION_STAGE_COUNT} · ${SUBMISSION_STAGES[r.stage - 1]?.label ?? 'N/A'}`
                        : '–'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.updatedAt)}</td>
                    <td style={{ maxWidth: 220 }}>{r.nextAction}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {r.attempt && (
                          <button
                            type="button"
                            className="ws-linkish"
                            aria-expanded={expanded}
                            onClick={() => {
                              setExpandedId(expandedId === r.key ? null : r.key)
                              if (expandedId !== r.key && !forms[r.key]) {
                                setForms((f) => ({ ...f, [r.key]: { status: '', note: '', reroute: false } }))
                              }
                            }}
                          >
                            {expanded ? 'Close' : 'Track'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ws-linkish"
                          onClick={() => openPortal(r.projectId, r.journalId ?? undefined)}
                        >
                          Prepare
                        </button>
                        <button
                          type="button"
                          className="ws-linkish"
                          onClick={() => go({ name: 'readiness', id: r.projectId })}
                        >
                          Readiness
                        </button>
                        <button
                          type="button"
                          className="ws-linkish"
                          onClick={() => go({ name: 'project', id: r.projectId })}
                        >
                          Project
                        </button>
                      </div>
                    </td>
                      </tr>
                      {expanded && r.attempt && (
                        <tr className="pub-expand-row">
                          <td colSpan={8}>
                            <div className="pub-expand">
                              <div className="pub-expand-col">
                                <h4>Event history</h4>
                                <ol className="pub-events" aria-label={`Event history for attempt ${r.attempt.attemptNumber}`}>
                                  {[...r.attempt.events].reverse().map((ev) => (
                                    <li key={ev.id}>
                                      <span className="pub-ev-label">{EVENT_LABEL[ev.type] ?? ev.type}</span>
                                      <time dateTime={ev.at}>{fmt(ev.at)}</time>
                                      {ev.note && <p>{ev.note}</p>}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                              <div className="pub-expand-col">
                                <h4>Record status</h4>
                                {(() => {
                                  const opts = allowedTransitions(r.attempt!.status)
                                  const form = formFor(r.key)
                                  if (opts.length === 0) {
                                    return (
                                      <p className="pub-expand-note">
                                        {SUBMISSION_STATUS_LABEL[r.attempt!.status]} is a final status, so this
                                        attempt's history is closed. Use reroute below to continue the manuscript
                                        against another journal.
                                      </p>
                                    )
                                  }
                                  return (
                                    <>
                                      <div className="pub-status-form">
                                        <select
                                          aria-label="New publication status"
                                          value={form.status}
                                          onChange={(e) => patchForm(r.key, { status: e.target.value })}
                                        >
                                          <option value="">Select status…</option>
                                          {opts.map((s) => (
                                            <option key={s} value={s}>
                                              {SUBMISSION_STATUS_LABEL[s]}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          type="text"
                                          aria-label="Status note"
                                          placeholder="Note (optional), e.g. editor reference"
                                          maxLength={240}
                                          value={form.note}
                                          onChange={(e) => patchForm(r.key, { note: e.target.value })}
                                        />
                                        <button
                                          type="button"
                                          className="ws-btn ws-btn-primary"
                                          disabled={!form.status}
                                          onClick={() => void recordStatus(r)}
                                        >
                                          Record
                                        </button>
                                      </div>
                                      <p className="pub-expand-note">
                                        Status changes append an event to this attempt; nothing in its history is
                                        overwritten.
                                      </p>
                                    </>
                                  )
                                })()}
                                {(r.attempt.status === 'rejected' || r.attempt.status === 'withdrawn') && (
                                  <div style={{ marginTop: '0.75rem' }}>
                                    {!formFor(r.key).reroute ? (
                                      <button
                                        type="button"
                                        className="ws-btn ws-btn-outline"
                                        onClick={() => patchForm(r.key, { reroute: true })}
                                      >
                                        Reroute to another journal →
                                      </button>
                                    ) : (
                                      <ReroutePanel
                                        project={r.project!}
                                        previousAttemptId={r.attempt.id}
                                        onRerouted={(journalId) => {
                                          setExpandedId(null)
                                          setForms((f) => {
                                            const next = { ...f }
                                            delete next[r.key]
                                            return next
                                          })
                                          openPortal(r.projectId, journalId)
                                        }}
                                        onFindJournals={() => go({ name: 'find-journals' })}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: '#666', textAlign: 'center', padding: '1.25rem' }}>
                      No journals match this status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="ws-table-note">
            Readiness comes from your latest check for each journal. Stages reflect recorded submission events, never
            assumptions.
          </p>
        </div>
      )}
    </div>
  )
}
