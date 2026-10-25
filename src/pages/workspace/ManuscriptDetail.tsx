import { useMemo, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { runAnalysis } from '../../workspace/pipeline'
import { runReadiness, auditSummary } from '../../workspace/readiness'
import { recommendationsCsv, readinessCsv, comparisonCsv, downloadFile, printReport } from '../../workspace/reports'
import { getFile } from '../../workspace/storage'
import { uid } from '../../lib/storage'
import type { FitTier, ReadinessAudit } from '../../workspace/types'
import { JournalDrawer } from './JournalDrawer'
import type { WorkspaceView } from './WorkspaceApp'

const TIER_INFO: Record<FitTier, { title: string; note: string }> = {
  tier1: { title: 'Tier 1 — Strongest fit', note: 'Strong evidence of subject and scope alignment with no known major incompatibility.' },
  tier2: { title: 'Tier 2 — Alternative fits', note: 'Relevant scope with one or more trade-offs, uncertainties, or narrower alignment.' },
  tier3: { title: 'Tier 3 — Broader options', note: 'Worth considering where scope is relevant but fit is less direct or requirements are unverified.' }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ManuscriptDetail({ id, go }: { id: string; go: (v: WorkspaceView) => void }) {
  const { data, update, log } = useWorkspace()
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [rerunNote, setRerunNote] = useState('')
  const [fileNote, setFileNote] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editAbstract, setEditAbstract] = useState('')
  const [editKeywords, setEditKeywords] = useState('')

  const project = data?.projects.find((p) => p.id === id)

  if (!data || !project) {
    return (
      <div>
        <h1 className="ws-h1">Project not found</h1>
        <p className="ws-sub">It may have been deleted from this workspace.</p>
        <button type="button" className="ws-btn ws-btn-outline" onClick={() => go({ name: 'manuscripts' })}>
          Back to manuscripts
        </button>
      </div>
    )
  }

  const matches = project.analysis?.matches ?? []
  const savedIds = new Set(data.savedJournals.map((s) => s.journalId))
  const drawerMatch = matches.find((m) => m.journal.id === drawerId) ?? null
  const compareMatches = project.comparedJournalIds.map((cid) => matches.find((m) => m.journal.id === cid)).filter((m): m is NonNullable<typeof m> => Boolean(m))
  const lastAudit = project.audits[0] ?? null

  async function retry() {
    if (!project) return
    setRerunNote('Re-running analysis against live sources…')
    const edited = project.edited ?? project.extracted
    if (!edited?.title.trim()) {
      setRerunNote('')
      setEditing(true)
      return
    }
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => (p.id === project.id ? { ...p, status: 'matching', error: null } : p))
    }))
    try {
      const result = await runAnalysis(project, project.preferences, (status) => {
        setRerunNote(status === 'matching' ? 'Querying OpenAlex and Crossref…' : status === 'generating' ? 'Assigning fit tiers…' : '')
        void update((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === project.id ? { ...p, status } : p)) }))
      })
      await update((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === project.id ? result : p)) }))
      log('analysis', `Re-ran analysis for "${result.name}" — ${result.analysis?.matches.length ?? 0} recommendations.`, project.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed'
      await update((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === project.id ? { ...p, status: 'failed', error: msg } : p)) }))
    }
    setRerunNote('')
  }

  async function saveEdits() {
    if (!project) return
    const edited = { ...(project.edited ?? project.extracted!), title: editTitle, abstract: editAbstract, keywords: editKeywords.split(',').map((k) => k.trim()).filter(Boolean) }
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => (p.id === project.id ? { ...p, edited, name: edited.title.slice(0, 120) || p.name, updatedAt: new Date().toISOString() } : p))
    }))
    log('project', `Updated extracted details for "${project.name}".`, project.id)
    setEditing(false)
  }
  void saveEdits

  async function toggleSave(journalId: string, title: string) {
    if (!data) return
    const already = data.savedJournals.find((s) => s.journalId === journalId)
    if (already) {
      await update((ws) => ({ ...ws, savedJournals: ws.savedJournals.filter((s) => s.journalId !== journalId) }))
      log('save', `Removed "${title}" from saved journals.`)
    } else {
      const m = matches.find((x) => x.journal.id === journalId)
      await update((ws) => ({
        ...ws,
        savedJournals: [
          { id: uid(), savedAt: new Date().toISOString(), journalId, title, publisher: m?.journal.publisher, issn: m?.journal.issn, link: m?.journal.homepageUrl, score: m?.score },
          ...ws.savedJournals
        ]
      }))
      log('save', `Saved "${title}".`)
    }
  }

  async function toggleCompare(journalId: string) {
    if (!project) return
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => {
        if (p.id !== project.id) return p
        const has = p.comparedJournalIds.includes(journalId)
        const next = has ? p.comparedJournalIds.filter((x) => x !== journalId) : [...p.comparedJournalIds, journalId].slice(-3)
        return { ...p, comparedJournalIds: next }
      })
    }))
  }

  async function runAudit() {
    if (!project) return
    const journal = matches.find((m) => m.journal.id === (project.selectedJournalId ?? matches[0]?.journal.id))
    const edited = project.edited ?? project.extracted
    if (!journal || !edited) return
    const audit = runReadiness(edited, journal.journal, uid())
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => (p.id === project.id ? { ...p, audits: [audit, ...p.audits].slice(0, 20) } : p))
    }))
    log('readiness', `Readiness check run for "${journal.journal.title}".`, project.id)
  }

  async function resolveCheck(auditId: string, checkId: string) {
    if (!project) return
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => {
        if (p.id !== project.id) return p
        return {
          ...p,
          audits: p.audits.map((a) =>
            a.id !== auditId
              ? a
              : { ...a, checks: a.checks.map((c) => (c.id !== checkId ? c : { ...c, status: 'pass' as const, explanation: `${c.explanation} — marked resolved by author.` })) }
          )
        }
      })
    }))
  }

  const downloadOriginal = async () => {
    setFileNote('')
    const file = await getFile(project.id).catch(() => null)
    if (!file) {
      setFileNote('The stored PDF could not be loaded — it may have been removed from this browser or bucket.')
      return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = project.fileName ?? `${project.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    log('report', `Downloaded the stored PDF for "${project.name}".`, project.id)
  }

  const isBusy = ['extracting', 'matching', 'generating'].includes(project.status)

  return (
    <div>
      <button type="button" className="ws-linkish" onClick={() => go({ name: 'manuscripts' })} style={{ fontSize: 12.5, marginBottom: 8 }}>
        ← All manuscripts
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="ws-h1">{project.name}</h1>
          <p className="ws-sub" style={{ marginBottom: 10 }}>
            {project.fileName
              ? `${project.fileName} · ${
                  project.fileSize
                    ? project.fileSize >= 1024 * 1024
                      ? `${(project.fileSize / 1024 / 1024).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(project.fileSize / 1024))} KB`
                    : ''
                } · `
              : ''}
            Created {fmt(project.createdAt)} · Updated {fmt(project.updatedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {project.hasStoredFile && (
            <button type="button" className="ws-btn ws-btn-ghost" onClick={() => void downloadOriginal()}>
              Download PDF
            </button>
          )}
          {project.status === 'completed' && (
            <>
              <button type="button" className="ws-btn ws-btn-ghost" onClick={() => printReport(project, lastAudit ?? undefined)}>
                Print / PDF report
              </button>
              <button
                type="button"
                className="ws-btn ws-btn-ghost"
                onClick={() => {
                  downloadFile(`${project.name.replace(/[^\w-]+/g, '_')}_recommendations.csv`, 'text/csv', recommendationsCsv(project))
                  log('report', `Exported recommendations CSV for "${project.name}".`, project.id)
                }}
              >
                Export CSV
              </button>
              <button type="button" className="ws-btn ws-btn-outline" onClick={() => void retry()} disabled={isBusy}>
                Run new analysis
              </button>
              {matches.length > 0 && (
                <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'submission-prep', id: project.id })}>
                  Prepare submission
                </button>
              )}
            </>
          )}
          {(project.status === 'failed' || project.status === 'reviewing') && (
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => setEditing(true)}>
              {project.status === 'failed' ? 'Fix details & retry' : 'Review details'}
            </button>
          )}
        </div>
      </div>

      {project.error && (
        <p className="ws-error-box" role="alert">
          {project.error} — provider failures are safe to retry; your manuscript data is unchanged.
        </p>
      )}
      {rerunNote && (
        <p className="ws-notice" role="status">{rerunNote}</p>
      )}
      {fileNote && (
        <p className="ws-notice" role="status">{fileNote}</p>
      )}
      {isBusy && !rerunNote && (
        <p className="ws-notice" role="status">
          Analysis in progress: {project.status === 'matching' ? 'querying sources…' : project.status === 'generating' ? 'building results…' : 'extracting…'}
        </p>
      )}

      {editing && (project.edited ?? project.extracted) && (
        <div className="ws-card" style={{ marginBottom: '1.25rem' }}>
          <h2 className="ws-h2" style={{ marginTop: 0 }}>Correct manuscript details</h2>
          <label className="ws-field">
            <span className="ws-label">Title</span>
            <input value={editTitle || (project.edited ?? project.extracted)!.title} onChange={(e) => setEditTitle(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-label">Abstract</span>
            <textarea rows={5} value={editAbstract || (project.edited ?? project.extracted)!.abstract} onChange={(e) => setEditAbstract(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-label">Keywords (comma-separated)</span>
            <input
              value={editKeywords || (project.edited ?? project.extracted)!.keywords.join(', ')}
              onChange={(e) => setEditKeywords(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              className="ws-btn ws-btn-primary"
              onClick={async () => {
                // Always re-run — even with unchanged fields (e.g. resuming an
                // interrupted analysis with nothing to fix).
                if (editTitle || editAbstract || editKeywords) {
                  const t = editTitle || (project.edited ?? project.extracted)!.title
                  const a = editAbstract || (project.edited ?? project.extracted)!.abstract
                  const k = editKeywords ? editKeywords.split(',').map((x) => x.trim()).filter(Boolean) : (project.edited ?? project.extracted)!.keywords
                  const edited = { ...(project.edited ?? project.extracted!), title: t, abstract: a, keywords: k }
                  await update((ws) => ({
                    ...ws,
                    projects: ws.projects.map((p) => (p.id === project.id ? { ...p, edited, name: t.slice(0, 120) || p.name, updatedAt: new Date().toISOString() } : p))
                  }))
                }
                setEditing(false)
                setEditTitle('')
                setEditAbstract('')
                setEditKeywords('')
                await retry()
              }}
            >
              Save & re-run analysis
            </button>
            <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* extraction summary */}
      {(project.edited ?? project.extracted) && (
        <div className="ws-card" style={{ marginBottom: '1.25rem', fontSize: 12.5 }}>
          <strong>Manuscript:</strong>{' '}
          {(project.edited ?? project.extracted)!.title || 'Untitled'} ·{' '}
          {(project.edited ?? project.extracted)!.keywords.length} keywords ·{' '}
          {(project.edited ?? project.extracted)!.wordCount.toLocaleString()} words extracted ·{' '}
          {(project.edited ?? project.extracted)!.pageCount} pages
          {(project.edited ?? project.extracted)!.field && <> · { (project.edited ?? project.extracted)!.field}</>}
        </div>
      )}

      {project.status === 'completed' && project.analysis && (
        <>
          <div className="ws-analysis-bar">
            <div>
              <strong>Analysis complete</strong> · {fmt(project.analysis.ranAt)} · {project.analysis.candidateCount} candidates retrieved · ranked with {project.analysis.engineVersion}
            </div>
            <div className="ws-analysis-note">Scores are <strong>relevance, not acceptance probability</strong>.</div>
            {project.analysis.notices.length > 0 && (
              <div className="ws-analysis-notices">
                {project.analysis.notices.map((n) => (
                  <div key={n}>• {n}</div>
                ))}
              </div>
            )}
          </div>

          <h2 className="ws-h2" style={{ marginTop: 0 }}>Journal recommendations</h2>
          {(['tier1', 'tier2', 'tier3'] as FitTier[]).map((tier) => {
            const ids = project.analysis!.tiers[tier]
            const list = ids.map((tid) => matches.find((m) => m.journal.id === tid)).filter(Boolean)
            if (list.length === 0) return null
            return (
              <section key={tier}>
                <div className="ws-tier-head">
                  <h3>{TIER_INFO[tier].title}</h3>
                  <p>{TIER_INFO[tier].note}</p>
                </div>
                {list.map((m) => {
                  const mm = m!
                  const j = mm.journal
                  const isSaved = savedIds.has(j.id)
                  const inCompare = project.comparedJournalIds.includes(j.id)
                  const link = j.homepageUrl || (j.sourceUrl?.startsWith('http') ? j.sourceUrl : undefined)
                  return (
                    <article key={j.id} className="ws-jcard">
                      <div>
                        <h4>{j.title}</h4>
                        <p className="pub">{j.publisher ?? 'Publisher unknown'}{j.issn ? ` · ISSN ${j.issn}` : ''}</p>
                        <div className="ws-meta-chips">
                          <span className="ws-chip">Relevance {mm.score}</span>
                          {j.isOpenAccess && <span className="ws-chip ws-chip-oa">Open access</span>}
                          {typeof j.apcUsd === 'number' && <span className="ws-chip">APC ~US${j.apcUsd.toLocaleString()}</span>}
                          <span className="ws-chip ws-chip-fresh">Verified {fmt(project.analysis!.ranAt)}</span>
                          <span className="ws-chip">Source: {j.source}</span>
                        </div>
                        <p className="why">
                          <strong>Why it matches:</strong> {mm.evidence.map((e) => e.detail).join('; ') || 'No positive evidence.'}
                        </p>
                        <p className="lim">
                          <strong>Unknowns:</strong> {mm.limitations.join(' ')}
                        </p>
                      </div>
                      <div className="ws-jcard-side">
                        <span className="ws-score">
                          {mm.score}
                          <small>relevance</small>
                        </span>
                        <button type="button" className="ws-btn ws-btn-outline" onClick={() => setDrawerId(j.id)}>
                          View details
                        </button>
                        <button type="button" className={`ws-btn ${inCompare ? 'ws-btn-outline' : 'ws-btn-ghost'}`} onClick={() => void toggleCompare(j.id)}>
                          {inCompare ? 'Compare ✓' : 'Compare'}
                        </button>
                        <button type="button" className={`ws-btn ${isSaved ? 'ws-btn-outline' : 'ws-btn-ghost'}`} onClick={() => void toggleSave(j.id, j.title)}>
                          {isSaved ? 'Saved ✓' : 'Save'}
                        </button>
                        {link && (
                          <a className="ws-btn ws-btn-ghost" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                            Submit ↗
                          </a>
                        )}
                      </div>
                    </article>
                  )
                })}
              </section>
            )
          })}

          {compareMatches.length >= 2 && (
            <>
              <div className="ws-tier-head">
                <h3>Compare selected journals</h3>
                <p>{compareMatches.length} of 3 slots used</p>
              </div>
              <div className="ws-card ws-compare-wrap">
                <table className="ws-compare">
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      {compareMatches.map((m) => (
                        <th key={m.journal.id}>{m.journal.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Publisher</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.publisher ?? 'Unknown'}</td>)}</tr>
                    <tr><td>ISSN</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.issn ?? 'Unknown'}</td>)}</tr>
                    <tr><td>Relevance</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.score}</td>)}</tr>
                    <tr><td>Open access</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.isOpenAccess ? 'Yes' : m.journal.isOpenAccess === false ? 'No' : 'Unknown'}</td>)}</tr>
                    <tr><td>APC (USD)</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.apcUsd ?? 'Unknown'}</td>)}</tr>
                    <tr><td>Documents</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.worksCount ?? 'Unknown'}</td>)}</tr>
                    <tr><td>2-yr citedness</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.citedness?.toFixed(1) ?? 'Unknown'}</td>)}</tr>
                    <tr><td>4-yr citedness</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.journal.citedness4?.toFixed(1) ?? 'Unknown'}</td>)}</tr>
                    <tr><td>Evidence</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.evidence.map((e) => e.detail).join(' · ')}</td>)}</tr>
                    <tr><td>Limitations</td>{compareMatches.map((m) => <td key={m.journal.id}>{m.limitations.join(' · ')}</td>)}</tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="ws-btn ws-btn-ghost"
                    onClick={() => {
                      downloadFile(`${project.name.replace(/[^\w-]+/g, '_')}_comparison.csv`, 'text/csv', comparisonCsv([project], compareMatches))
                      log('report', `Exported comparison CSV for "${project.name}".`, project.id)
                    }}
                  >
                    Export comparison CSV
                  </button>
                  <button type="button" className="ws-btn ws-btn-ghost" onClick={() => void update((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === project.id ? { ...p, comparedJournalIds: [] } : p)) }))}>
                    Clear comparison
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Readiness */}
          <div className="ws-tier-head">
            <h3>Readiness check</h3>
            <p>Automated checks against extracted content — supports your review, does not guarantee compliance.</p>
          </div>
          <div className="ws-card">
            <label className="ws-field" style={{ maxWidth: 420 }}>
              <span className="ws-label">Target journal</span>
              <select
                value={project.selectedJournalId ?? matches[0]?.journal.id ?? ''}
                onChange={(e) =>
                  void update((ws) => ({
                    ...ws,
                    projects: ws.projects.map((p) => (p.id === project.id ? { ...p, selectedJournalId: e.target.value } : p))
                  }))
                }
              >
                {matches.map((m) => (
                  <option key={m.journal.id} value={m.journal.id}>
                    {m.journal.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => void runAudit()} disabled={matches.length === 0}>
              Run readiness check
            </button>

            {lastAudit ? (
              <div style={{ marginTop: '1rem' }}>
                {(() => {
                  const s = auditSummary(lastAudit)
                  return (
                    <p style={{ fontSize: 12.5, color: '#666', margin: '0 0 0.75rem' }}>
                      Latest audit: <strong>{lastAudit.journalTitle}</strong> · {fmt(lastAudit.runAt)} · engine{' '}
                      {lastAudit.engineVersion} · {s.pass} pass · {s.attention} needs attention · {s.warning} warning ·{' '}
                      {s.unknown} unknown
                    </p>
                  )
                })()}
                <div className="ws-checks">
                  {lastAudit.checks.map((c) => (
                    <div key={c.id} className="ws-check">
                      <div>
                        <span className={`ws-badge ws-badge-${c.status}`}>{c.status.replace('-', ' ')}</span>
                        <div className="ws-check-label" style={{ marginTop: 4 }}>{c.label}</div>
                      </div>
                      <div>
                        <div className="ws-check-exp">{c.explanation}</div>
                        {c.evidence && <div className="ws-check-evidence">Evidence: {c.evidence}</div>}
                        {c.sourceUrl && (
                          <a className="ws-check-evidence" href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--ws-accent)' }}>
                            Source: {c.sourceUrl} ↗
                          </a>
                        )}
                        {(c.status === 'attention' || c.status === 'warning') && (
                          <button type="button" className="ws-linkish" style={{ fontSize: 11.5, marginTop: 4 }} onClick={() => void resolveCheck(lastAudit.id, c.id)}>
                            Mark as resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ws-btn ws-btn-ghost"
                    onClick={() => {
                      downloadFile(`${project.name.replace(/[^\w-]+/g, '_')}_readiness.csv`, 'text/csv', readinessCsv(lastAudit))
                      log('report', `Exported readiness CSV for "${project.name}".`, project.id)
                    }}
                  >
                    Export readiness CSV
                  </button>
                  <button type="button" className="ws-btn ws-btn-ghost" onClick={() => printReport(project, lastAudit)}>
                    Print readiness report
                  </button>
                </div>
                {project.audits.length > 1 && (
                  <p style={{ fontSize: 11.5, color: '#666', marginTop: '0.75rem' }}>
                    {project.audits.length} audits stored — earlier results are preserved so past reports stay
                    interpretable when checks change.
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: '#666', marginTop: '0.75rem' }}>No audit yet for this project.</p>
            )}
          </div>
        </>
      )}

      {drawerMatch && (
        <JournalDrawer
          match={drawerMatch}
          saved={savedIds.has(drawerMatch.journal.id)}
          onSave={() => void toggleSave(drawerMatch.journal.id, drawerMatch.journal.title)}
          onClose={() => setDrawerId(null)}
          onCompare={() => void toggleCompare(drawerMatch.journal.id)}
          compareActive={project.comparedJournalIds.includes(drawerMatch.journal.id)}
          ranAt={project.analysis?.ranAt}
        />
      )}
    </div>
  )
}
