import { useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { runReadiness, auditSummary } from '../../workspace/readiness'
import { readinessCsv, downloadFile, printReport } from '../../workspace/reports'
import { uid } from '../../lib/storage'
import type { WorkspaceView } from './WorkspaceApp'

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ReadinessView({ go }: { go: (v: WorkspaceView) => void }) {
  const { data, update, log } = useWorkspace()
  const [busyFor, setBusyFor] = useState<string | null>(null)

  if (!data) return null
  const analysed = data.projects.filter((p) => p.status === 'completed' && p.analysis)

  async function run(projectId: string, journalId: string) {
    setBusyFor(projectId)
    const project = data!.projects.find((p) => p.id === projectId)
    const match = project?.analysis?.matches.find((m) => m.journal.id === journalId)
    const edited = project?.edited ?? project?.extracted
    if (project && match && edited) {
      const audit = runReadiness(edited, match.journal, uid())
      await update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => (p.id === projectId ? { ...p, audits: [audit, ...p.audits].slice(0, 20), selectedJournalId: journalId } : p))
      }))
      log('readiness', `Readiness check run for "${match.journal.title}".`, projectId)
    }
    setBusyFor(null)
  }

  const totalAudits = analysed.reduce((n, p) => n + p.audits.length, 0)

  return (
    <div>
      <h1 className="ws-h1">Readiness Checks</h1>
      <p className="ws-sub">
        Journal-specific checklists built from what can actually be verified in your extracted manuscript. Items that
        cannot be verified — usually because author instructions live behind the journal's site — stay marked{' '}
        <strong>unknown</strong>, never passed. Engine: <code>pubrooter-readiness-v1</code>.
      </p>

      {analysed.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>No analyzed manuscripts yet</strong>
          Run an analysis first — readiness checks run against a chosen journal from its results.
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
              Analyze a Manuscript
            </button>
          </div>
        </div>
      ) : (
        <>
          {analysed.map((p) => {
            const opts = p.analysis!.matches
            const target = p.selectedJournalId ?? opts[0]?.journal.id ?? ''
            const journal = opts.find((m) => m.journal.id === target)?.journal ?? null
            const link = journal?.homepageUrl || (journal?.sourceUrl?.startsWith('http') ? journal.sourceUrl : undefined)
            const latest = p.audits[0]
            const s = latest ? auditSummary(latest) : null
            return (
              <div key={p.id} className="ws-card" style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: 14.5, margin: 0 }}>
                      <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                        {p.name}
                      </button>
                    </h2>
                    {latest && s ? (
                      <div style={{ marginTop: '0.4rem' }}>
                        <p style={{ fontSize: 12, color: '#666', margin: '0 0 0.4rem' }}>
                          Latest: {latest.journalTitle} · {fmt(latest.runAt)}
                        </p>
                        <div className="ws-readiness-legend">
                          <span className="pass"><i></i>{s.pass} pass</span>
                          <span className="attention"><i></i>{s.attention} attention</span>
                          <span className="warning"><i></i>{s.warning} warning</span>
                          <span className="unknown"><i></i>{s.unknown} unknown</span>
                        </div>
                        <div className="ws-readiness-bar">
                          <div className="ws-readiness-bar-seg pass" style={{ width: `${(s.pass / latest.checks.length) * 100}%` }}></div>
                          <div className="ws-readiness-bar-seg attention" style={{ width: `${(s.attention / latest.checks.length) * 100}%` }}></div>
                          <div className="ws-readiness-bar-seg warning" style={{ width: `${(s.warning / latest.checks.length) * 100}%` }}></div>
                          <div className="ws-readiness-bar-seg unknown" style={{ width: `${((s.unknown + s['not-checked']) / latest.checks.length) * 100}%` }}></div>
                        </div>
                      </div>
                    ) : latest ? (
                      <p style={{ fontSize: 12, color: '#666', margin: '0.3rem 0 0' }}>
                        Latest: {latest.journalTitle} · {fmt(latest.runAt)}
                      </p>
                    ) : (
                      <p style={{ fontSize: 12, color: '#666', margin: '0.3rem 0 0' }}>No checks run yet.</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <select
                      value={target}
                      onChange={(e) =>
                        void update((ws) => ({
                          ...ws,
                          projects: ws.projects.map((x) => (x.id === p.id ? { ...x, selectedJournalId: e.target.value } : x))
                        }))
                      }
                      style={{ font: 'inherit', fontSize: 12.5, padding: '0.35rem 0.5rem', border: '1px solid #b3b3b3', borderRadius: 3, maxWidth: 240 }}
                      aria-label={`Journal for ${p.name}`}
                    >
                      {opts.map((m) => (
                        <option key={m.journal.id} value={m.journal.id}>
                          {m.journal.title}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="ws-btn ws-btn-primary" disabled={busyFor === p.id} onClick={() => void run(p.id, target)}>
                      {busyFor === p.id ? 'Running…' : 'Run check'}
                    </button>
                    {latest && (
                      <>
                        <button
                          type="button"
                          className="ws-btn ws-btn-ghost"
                          onClick={() => downloadFile(`${p.name.replace(/[^\w-]+/g, '_')}_readiness.csv`, 'text/csv', readinessCsv(latest))}
                        >
                          CSV
                        </button>
                        <button type="button" className="ws-btn ws-btn-ghost" onClick={() => printReport(p, latest)}>
                          Print
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {latest && (
                  <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, borderTop: '1px solid #e6e6e6' }}>
                    <aside style={{ borderRight: '1px solid #e6e6e6', padding: '1rem 1.25rem', background: '#f9fbfd' }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 0.6rem', color: '#205081' }}>Journal workspace</h3>
                      {journal && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '0.3rem' }}>{journal.title}</div>
                          <div style={{ fontSize: 11.5, color: '#666', marginBottom: '0.75rem' }}>
                            {journal.publisher ?? 'Publisher unknown'}{journal.issn ? ` · ISSN ${journal.issn}` : ''}
                          </div>
                          <div style={{ display: 'grid', gap: '0.4rem', fontSize: 12, marginBottom: '0.75rem' }}>
                            <div><strong>Open access:</strong> {journal.isOpenAccess ? 'Yes' : journal.isOpenAccess === false ? 'No' : 'Unknown'}</div>
                            <div><strong>APC (USD):</strong> {typeof journal.apcUsd === 'number' ? '$' + journal.apcUsd.toLocaleString() : 'Unknown'}</div>
                            <div><strong>Source:</strong> {journal.source}</div>
                          </div>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" className="ws-btn ws-btn-ghost" style={{ fontSize: 12, padding: '0.35rem 0.6rem', marginBottom: '0.75rem', display: 'inline-flex' }}>
                              Visit journal site ↗
                            </a>
                          )}
                        </>
                      )}
                      <div style={{ borderTop: '1px solid #e6e6e6', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: '0.4rem' }}>Engine</div>
                        <code style={{ fontSize: 11 }}>{latest.engineVersion}</code>
                        <div style={{ fontSize: 11.5, color: '#666', marginTop: '0.5rem' }}>Scores are relevance, not acceptance probability.</div>
                      </div>
                    </aside>
                    <main style={{ padding: '1rem 1.25rem' }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 0.75rem' }}>Readiness checklist</h3>
                      <div className="ws-checks">
                        {latest.checks.map((c) => (
                          <div key={c.id} className="ws-check">
                            <div>
                              <span className={`ws-badge ws-badge-${c.status}`}>{c.status.replace('-', ' ')}</span>
                              <div className="ws-check-label" style={{ marginTop: 4 }}>{c.label}</div>
                            </div>
                            <div>
                              <div className="ws-check-exp">{c.explanation}</div>
                              {c.evidence && <div className="ws-check-evidence">Evidence: {c.evidence}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </main>
                  </div>
                )}
              </div>
            )
          })}
          <p style={{ fontSize: 11.5, color: '#666' }}>
            {totalAudits} audits stored across projects — each keeps its engine version so older reports remain
            interpretable. Automated checks support author review and do not guarantee editorial compliance or
            acceptance.
          </p>
        </>
      )}
    </div>
  )
}
