import { useState, type ReactNode } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { auditSummary } from '../../workspace/readiness'
import { sortRows, flattenAudits, targetJournalTitle, type AuditRow, type SortDir } from '../../workspace/dashboard'
import { readinessCsv, downloadFile } from '../../workspace/reports'
import type { ReadinessAudit, SavedJournalRecord } from '../../workspace/types'
import type { WorkspaceView } from './WorkspaceApp'

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  uploaded: 'Uploaded',
  extracting: 'Extracting',
  reviewing: 'Needs review',
  matching: 'Matching journals',
  generating: 'Generating results',
  completed: 'Completed',
  failed: 'Failed'
}

type SortState<K extends string> = { key: K; dir: SortDir }

function useSort<K extends string>(initial: K, initialDir: SortDir = -1): [SortState<K>, (key: K) => void] {
  const [state, setState] = useState<SortState<K>>({ key: initial, dir: initialDir })
  const toggle = (key: K) => setState((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))
  return [state, toggle]
}

function Th({ label, active, dir, onSort, num }: { label: string; active: boolean; dir: SortDir; onSort: () => void; num?: boolean }) {
  return (
    <th className={num ? 'num' : undefined} aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={active ? 'ws-th-sort active' : 'ws-th-sort'} onClick={onSort}>
        {label}
        {active && (
          <span className="ws-th-arrow" aria-hidden="true">
            {dir === 1 ? '▲' : '▼'}
          </span>
        )}
      </button>
    </th>
  )
}

function tally(audit: ReadinessAudit): ReactNode[] {
  const s = auditSummary(audit)
  const unknown = s.unknown + s['not-checked']
  const parts: { n: number; label: string; cls: string }[] = []
  if (s.pass > 0) parts.push({ n: s.pass, label: 'pass', cls: 'ws-n-good' })
  if (s.attention > 0) parts.push({ n: s.attention, label: 'attention', cls: 'ws-n-warn' })
  if (s.warning > 0) parts.push({ n: s.warning, label: 'warning', cls: 'ws-n-bad' })
  if (unknown > 0) parts.push({ n: unknown, label: 'unknown', cls: 'ws-n-muted' })
  if (parts.length === 0) parts.push({ n: 0, label: 'pass', cls: 'ws-n-good' })
  return parts.map((p, i) => (
    <span key={p.label}>
      {i > 0 && ' · '}
      <span className={p.cls}>{p.n}</span> {p.label}
    </span>
  ))
}

type MsKey = 'name' | 'created' | 'updated' | 'status' | 'matches' | 'readiness' | 'journal'
type RdKey = 'manuscript' | 'journal' | 'runAt' | 'pass' | 'attention' | 'warning' | 'unknown'
type SjKey = 'title' | 'publisher' | 'issn' | 'score' | 'savedAt'

export function Overview({ go, openFinder }: { go: (v: WorkspaceView) => void; openFinder: () => void }) {
  const { data, log } = useWorkspace()
  const [ms, toggleMs] = useSort<MsKey>('updated')
  const [rd, toggleRd] = useSort<RdKey>('runAt')
  const [sj, toggleSj] = useSort<SjKey>('savedAt')

  if (!data) return null

  const projects = data.projects
  const completed = projects.filter((p) => p.status === 'completed')
  const recommendationCount = completed.reduce((n, p) => n + (p.analysis?.matches.length ?? 0), 0)
  const attention = projects.filter((p) => p.status === 'failed' || p.status === 'reviewing')
  const savedCount = data.savedJournals.length
  const attemptCount = projects.reduce((n, p) => n + p.submissions.length, 0)
  const awaitingAttempt = completed.filter((p) => p.selectedJournalId != null && p.submissions.length === 0)

  const auditRows = flattenAudits(projects)
  const totalAudits = auditRows.length
  const projectsWithAudits = new Set(auditRows.map((r) => r.project.id)).size

  const nextActions: { text: string; run: () => void }[] = []
  if (projects.some((p) => p.status === 'reviewing')) {
    nextActions.push({ text: 'Finish reviewing extracted manuscript details before analysis.', run: () => go({ name: 'manuscripts' }) })
  }
  if (projects.some((p) => p.status === 'failed')) {
    nextActions.push({ text: 'Retry analyses that failed — provider errors are safe to retry.', run: () => go({ name: 'manuscripts' }) })
  }
  if (completed.some((p) => p.audits.length === 0)) {
    nextActions.push({ text: 'Run a journal-specific readiness check on an analysed manuscript.', run: () => go({ name: 'readiness' }) })
  }
  if (savedCount > 0 && completed.length > 0 && completed.every((p) => p.selectedJournalId == null)) {
    nextActions.push({ text: 'Select a target journal from your recommendations.', run: () => go({ name: 'manuscripts' }) })
  }
  if (awaitingAttempt.length > 0) {
    nextActions.push({
      text: `Prepare a submission for ${awaitingAttempt.length} analysed manuscript${awaitingAttempt.length === 1 ? '' : 's'} with a target journal selected.`,
      run: () => go({ name: 'submission-prep', id: awaitingAttempt[0].id })
    })
  }
  if (projects.length === 0) {
    nextActions.push({ text: 'Upload your first manuscript PDF to start an analysis.', run: () => go({ name: 'new' }) })
    nextActions.push({ text: 'Or search journals directly with the public Journal Finder.', run: openFinder })
  }

  const emptyWorkspace = projects.length === 0 && savedCount === 0 && totalAudits === 0

  const msAcc: Record<MsKey, (p: (typeof projects)[number]) => number | string> = {
    name: (p) => p.name,
    created: (p) => Date.parse(p.createdAt),
    updated: (p) => Date.parse(p.updatedAt),
    status: (p) => STATUS_LABEL[p.status] ?? p.status,
    matches: (p) => p.analysis?.matches.length ?? 0,
    readiness: (p) => (p.audits[0] ? auditSummary(p.audits[0]).pass : -1),
    journal: (p) => targetJournalTitle(p)
  }
  const msRows = sortRows(projects, ms.key, ms.dir, msAcc)

  const rdAcc: Record<RdKey, (r: AuditRow) => number | string> = {
    manuscript: (r) => r.project.name,
    journal: (r) => r.audit.journalTitle,
    runAt: (r) => Date.parse(r.audit.runAt),
    pass: (r) => auditSummary(r.audit).pass,
    attention: (r) => auditSummary(r.audit).attention,
    warning: (r) => auditSummary(r.audit).warning,
    unknown: (r) => auditSummary(r.audit).unknown + auditSummary(r.audit)['not-checked']
  }
  const rdRows = sortRows(auditRows, rd.key, rd.dir, rdAcc)

  const sjAcc: Record<SjKey, (s: SavedJournalRecord) => number | string> = {
    title: (s) => s.title,
    publisher: (s) => s.publisher ?? '',
    issn: (s) => s.issn ?? '',
    score: (s) => s.score ?? -1,
    savedAt: (s) => Date.parse(s.savedAt)
  }
  const sjRows = sortRows(data.savedJournals, sj.key, sj.dir, sjAcc)

  const rdTotals = rdRows.reduce(
    (t, r) => {
      const s = auditSummary(r.audit)
      t.pass += s.pass
      t.attention += s.attention
      t.warning += s.warning
      t.unknown += s.unknown + s['not-checked']
      return t
    },
    { pass: 0, attention: 0, warning: 0, unknown: 0 }
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="ws-h1">Welcome back{data.profile.name ? `, ${data.profile.name.split(' ')[0]}` : ''}</h1>
          <p className="ws-sub">
            Your publication desk: manuscripts, evidence-backed journal matches, readiness checks, and saved venues.
            Every figure on this page is computed from your own workspace records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
            Analyze a Manuscript
          </button>
          <button type="button" className="ws-btn ws-btn-outline" onClick={openFinder}>
            Find journals ↗
          </button>
        </div>
      </div>

      <div className="ws-metrics ws-metrics-7">
        <button type="button" className="ws-metric ws-metric-btn" onClick={() => go({ name: 'manuscripts' })}>
          <span className="ws-metric-value">{projects.length}</span>
          <span className="ws-metric-label">Manuscripts</span>
        </button>
        <button type="button" className="ws-metric ws-metric-btn green" onClick={() => go({ name: 'manuscripts' })}>
          <span className="ws-metric-value">{completed.length}</span>
          <span className="ws-metric-label">Analyses completed</span>
        </button>
        <button type="button" className="ws-metric ws-metric-btn violet" onClick={() => go({ name: 'manuscripts' })}>
          <span className="ws-metric-value">{recommendationCount}</span>
          <span className="ws-metric-label">Journal matches</span>
        </button>
        <button type="button" className="ws-metric ws-metric-btn teal" onClick={() => go({ name: 'saved' })}>
          <span className="ws-metric-value">{savedCount}</span>
          <span className="ws-metric-label">Saved journals</span>
        </button>
        <button type="button" className="ws-metric ws-metric-btn gold" onClick={() => go({ name: 'readiness' })}>
          <span className="ws-metric-value">{totalAudits}</span>
          <span className="ws-metric-label">Readiness checks run</span>
        </button>
        <button type="button" className={`ws-metric ws-metric-btn ${attention.length > 0 ? 'red' : 'muted'}`} onClick={() => go({ name: 'manuscripts' })}>
          <span className="ws-metric-value">{attention.length}</span>
          <span className="ws-metric-label">Need attention</span>
        </button>
        <button type="button" className={`ws-metric ws-metric-btn ${attemptCount > 0 ? 'indigo' : 'muted'}`} onClick={() => go({ name: 'pipeline' })}>
          <span className="ws-metric-value">{attemptCount}</span>
          <span className="ws-metric-label">Submission attempts</span>
        </button>
      </div>

      {emptyWorkspace ? (
        <div className="ws-card ws-empty" style={{ marginTop: '1.5rem' }}>
          <strong>Your workspace is empty</strong>
          Upload a PDF and PubRooter will extract its details, match it against live indexes, and produce tiered,
          explained recommendations — no estimated figures, only evidence you can open.
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
              Analyze a Manuscript
            </button>
            <button type="button" className="ws-btn ws-btn-outline" onClick={openFinder}>
              Find journals ↗
            </button>
          </div>
        </div>
      ) : (
        <div className="ws-overview-layout">
          <div className="ws-overview-main">
            <section className="ws-card" style={{ marginTop: '1.5rem' }}>
            <div className="ws-card-head">
              <h2 className="ws-h2" style={{ margin: 0 }}>
                Manuscripts
              </h2>
              <button type="button" className="ws-linkish" onClick={() => go({ name: 'manuscripts' })}>
                Open My Manuscripts →
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="ws-empty" style={{ border: 'none', padding: '1rem 0' }}>
                <strong>No manuscripts yet</strong>
                Upload a PDF to start an analysis — results, audits, and exports all attach to the project.
                <div style={{ marginTop: '1rem' }}>
                  <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
                    Analyze a Manuscript
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="ws-table-scroll">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <Th label="Manuscript" active={ms.key === 'name'} dir={ms.dir} onSort={() => toggleMs('name')} />
                        <Th label="Created" active={ms.key === 'created'} dir={ms.dir} onSort={() => toggleMs('created')} />
                        <Th label="Updated" active={ms.key === 'updated'} dir={ms.dir} onSort={() => toggleMs('updated')} />
                        <Th label="Status" active={ms.key === 'status'} dir={ms.dir} onSort={() => toggleMs('status')} />
                        <Th label="Matches" num active={ms.key === 'matches'} dir={ms.dir} onSort={() => toggleMs('matches')} />
                        <Th label="Attempts" num active={false} dir={1} onSort={() => undefined} />
                        <Th label="Latest readiness" active={ms.key === 'readiness'} dir={ms.dir} onSort={() => toggleMs('readiness')} />
                        <Th label="Target journal" active={ms.key === 'journal'} dir={ms.dir} onSort={() => toggleMs('journal')} />
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {msRows.map((p) => {
                        const latest = p.audits[0]
                        const journal = targetJournalTitle(p)
                        return (
                          <tr key={p.id}>
                            <td>
                              <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                                {p.name}
                              </button>
                              <div style={{ fontSize: 11, color: '#666' }}>{p.fileName ?? 'No file stored'}</div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmt(p.createdAt)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(p.updatedAt)}</td>
                            <td>
                              <span
                                className={`ws-status ws-status-${
                                  p.status === 'completed' ? 'completed' : p.status === 'failed' ? 'failed' : ['extracting', 'matching', 'generating'].includes(p.status) ? 'active' : 'idle'
                                }`}
                              >
                                {STATUS_LABEL[p.status] ?? p.status}
                              </span>
                              {p.error && <div style={{ fontSize: 11, color: '#af1d1d', marginTop: 4 }}>{p.error}</div>}
                            </td>
                            <td className="num">{p.analysis?.matches.length ?? 0}</td>
                            <td className="num">
                              {p.submissions.length > 0 ? (
                                <button type="button" className="ws-linkish" onClick={() => go({ name: 'submission-prep', id: p.id })}>
                                  {p.submissions.length}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{latest ? tally(latest) : '—'}</td>
                            <td style={{ maxWidth: 220 }}>{journal || (p.status === 'completed' ? <span style={{ color: '#808080' }}>Not selected</span> : '—')}</td>
                            <td>
                              <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                                {p.status === 'completed' ? 'View results' : p.status === 'failed' ? 'Retry' : 'Open'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>
                          {projects.length} manuscript{projects.length === 1 ? '' : 's'} · {completed.length} completed ·{' '}
                          {attention.length} need attention
                        </td>
                        <td className="num">{recommendationCount}</td>
                        <td className="num">{attemptCount}</td>
                        <td colSpan={2} style={{ color: '#666' }}>
                          Totals across your workspace
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="ws-table-note">Journal matches come from live OpenAlex and Crossref queries run at analysis time.</p>
              </>
            )}
          </section>

          <section className="ws-card" style={{ marginTop: '1.5rem' }}>
            <div className="ws-card-head">
              <h2 className="ws-h2" style={{ margin: 0 }}>
                Readiness checks
              </h2>
              <button type="button" className="ws-linkish" onClick={() => go({ name: 'readiness' })}>
                Open Readiness Checks →
              </button>
            </div>
            {totalAudits === 0 ? (
              <div className="ws-empty" style={{ border: 'none', padding: '1rem 0' }}>
                <strong>No readiness checks yet</strong>
                Checks run against a journal chosen from a completed analysis — items that cannot be verified stay
                marked unknown, never passed.
                <div style={{ marginTop: '1rem' }}>
                  <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'readiness' })}>
                    Open Readiness Checks
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="ws-table-scroll">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <Th label="Manuscript" active={rd.key === 'manuscript'} dir={rd.dir} onSort={() => toggleRd('manuscript')} />
                        <Th label="Journal" active={rd.key === 'journal'} dir={rd.dir} onSort={() => toggleRd('journal')} />
                        <Th label="Run" active={rd.key === 'runAt'} dir={rd.dir} onSort={() => toggleRd('runAt')} />
                        <Th label="Pass" num active={rd.key === 'pass'} dir={rd.dir} onSort={() => toggleRd('pass')} />
                        <Th label="Attention" num active={rd.key === 'attention'} dir={rd.dir} onSort={() => toggleRd('attention')} />
                        <Th label="Warning" num active={rd.key === 'warning'} dir={rd.dir} onSort={() => toggleRd('warning')} />
                        <Th label="Unknown" num active={rd.key === 'unknown'} dir={rd.dir} onSort={() => toggleRd('unknown')} />
                        <th>Engine</th>
                        <th>Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rdRows.map(({ project, audit }) => {
                        const s = auditSummary(audit)
                        return (
                          <tr key={audit.id}>
                            <td>
                              <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: project.id })}>
                                {project.name}
                              </button>
                            </td>
                            <td style={{ maxWidth: 240 }}>{audit.journalTitle}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(audit.runAt)}</td>
                            <td className="num ws-n-good">{s.pass}</td>
                            <td className="num ws-n-warn">{s.attention}</td>
                            <td className="num ws-n-bad">{s.warning}</td>
                            <td className="num ws-n-muted">{s.unknown + s['not-checked']}</td>
                            <td>
                              <code style={{ fontSize: 11 }}>{audit.engineVersion}</code>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="ws-linkish"
                                onClick={() => {
                                  downloadFile(`${project.name.replace(/[^\w-]+/g, '_')}_readiness.csv`, 'text/csv', readinessCsv(audit))
                                  log('report', `Exported readiness CSV for "${project.name}".`, project.id)
                                }}
                              >
                                CSV
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>
                          {totalAudits} check{totalAudits === 1 ? '' : 's'} across {projectsWithAudits} manuscript
                          {projectsWithAudits === 1 ? '' : 's'}
                        </td>
                        <td className="num ws-n-good">{rdTotals.pass}</td>
                        <td className="num ws-n-warn">{rdTotals.attention}</td>
                        <td className="num ws-n-bad">{rdTotals.warning}</td>
                        <td className="num ws-n-muted">{rdTotals.unknown}</td>
                        <td colSpan={2} style={{ color: '#666' }}>
                          Totals shown
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="ws-table-note">
                  Automated checks support author review — they do not guarantee editorial compliance or acceptance.
                </p>
              </>
            )}
          </section>

          <section className="ws-card" style={{ marginTop: '1.5rem' }}>
            <div className="ws-card-head">
              <h2 className="ws-h2" style={{ margin: 0 }}>
                Saved journals
              </h2>
              <button type="button" className="ws-linkish" onClick={() => go({ name: 'saved' })}>
                Open Saved Journals →
              </button>
            </div>
            {savedCount === 0 ? (
              <div className="ws-empty" style={{ border: 'none', padding: '1rem 0' }}>
                <strong>Nothing saved yet</strong>
                Save journals from analysis results or the Journal Finder — scores are recorded at save time, never
                estimated.
                <div style={{ marginTop: '1rem' }}>
                  <button type="button" className="ws-btn ws-btn-outline" onClick={openFinder}>
                    Find journals ↗
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="ws-table-scroll">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <Th label="Journal" active={sj.key === 'title'} dir={sj.dir} onSort={() => toggleSj('title')} />
                        <Th label="Publisher" active={sj.key === 'publisher'} dir={sj.dir} onSort={() => toggleSj('publisher')} />
                        <Th label="ISSN" active={sj.key === 'issn'} dir={sj.dir} onSort={() => toggleSj('issn')} />
                        <Th label="Score at save" num active={sj.key === 'score'} dir={sj.dir} onSort={() => toggleSj('score')} />
                        <Th label="Saved" active={sj.key === 'savedAt'} dir={sj.dir} onSort={() => toggleSj('savedAt')} />
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sjRows.map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.link ? (
                              <a href={s.link} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                                {s.title} ↗
                              </a>
                            ) : (
                              <span style={{ fontWeight: 600 }}>{s.title}</span>
                            )}
                          </td>
                          <td>{s.publisher ?? '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{s.issn ?? '—'}</td>
                          <td className="num">{s.score ?? '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(s.savedAt)}</td>
                          <td style={{ maxWidth: 240, color: s.note ? '#333' : '#808080' }}>{s.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={{ color: '#666' }}>
                          {savedCount} journal{savedCount === 1 ? '' : 's'} saved · scores are snapshots recorded at save time
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="ws-table-note">
                  Journal metadata changes on the source side — re-run an analysis for fresh figures.
                </p>
              </>
            )}
          </section>
          </div>
          <aside className="ws-overview-side">
            <div className="ws-insight-card">
              <h3>Publication Command Center</h3>
            </div>
            <div className="ws-insight-card">
              <h3>Your Next Steps</h3>
              {nextActions.length === 0 ? (
                <p>All clear. No outstanding tasks.</p>
              ) : (
                <ul>
                  {nextActions.slice(0, 5).map((a) => (
                    <li key={a.text}>
                      <button type="button" className="ws-linkish" onClick={() => { log('project', `Opened next action: ${a.text.slice(0, 60)}`); a.run() }}>
                        {a.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ws-insight-card">
              <h3>Recent Activity</h3>
              {data.activity.length === 0 ? (
                <p>No activity yet.</p>
              ) : (
                <ul style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {data.activity.slice(0, 6).map((a) => (
                    <li key={a.id} style={{ fontSize: 11.5, marginBottom: '0.5rem' }}>
                      <div style={{ color: '#666' }}>{fmt(a.at)}</div>
                      <div>{a.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ws-insight-card">
              <h3>Pipeline Summary</h3>
              <div style={{ display: 'grid', gap: '0.4rem', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pending analysis</span>
                  <span style={{ fontWeight: 600 }}>{projects.filter(p => p.status !== 'completed' && p.status !== 'failed').length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Completed</span>
                  <span style={{ fontWeight: 600 }}>{completed.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Submission attempts</span>
                  <span style={{ fontWeight: 600 }}>{attemptCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Journal matches</span>
                  <span style={{ fontWeight: 600 }}>{recommendationCount}</span>
                </div>
              </div>
            </div>
            <div className="ws-insight-card">
              <h3>Recent activity (full)</h3>
              <div className="ws-card" style={{ padding: '0.75rem 1rem' }}>
                {data.activity.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: '#666', margin: 0 }}>No activity recorded yet.</p>
                ) : (
                  <ul className="ws-activity ws-activity-cap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {data.activity.slice(0, 10).map((a) => (
                      <li key={a.id}>
                        <time>{fmt(a.at)}</time>
                        <span>{a.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: '#808080', marginTop: '1.25rem', marginBottom: 0 }}>
        All figures are computed from your own workspace records — no estimated, model-generated, or sample numbers.
        Journal metadata comes from OpenAlex and Crossref as recorded at analysis or save time.
      </p>
    </div>
  )
}
