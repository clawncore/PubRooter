import { useMemo, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { runAnalysis } from '../../workspace/pipeline'
import { auditSummary } from '../../workspace/readiness'
import { recommendationsCsv, downloadFile, printReport } from '../../workspace/reports'
import { getFile } from '../../workspace/storage'
import { journalSiteUrl } from '../../workspace/journal-url'
import type { FitTier, ManuscriptProject } from '../../workspace/types'
import { JournalDrawer } from './JournalDrawer'
import { ReroutePanel } from './ReroutePanel'
import type { WorkspaceView } from './WorkspaceApp'

const TIER_INFO: Record<FitTier, { title: string; note: string }> = {
  tier1: { title: 'Tier 1: Strongest fit', note: 'Strong evidence of subject and scope alignment with no known major incompatibility.' },
  tier2: { title: 'Tier 2: Alternative fits', note: 'Relevant scope with one or more trade-offs, uncertainties, or narrower alignment.' },
  tier3: { title: 'Tier 3: Broader options', note: 'Worth considering where scope is relevant but fit is less direct or requirements are unverified.' }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ManuscriptDetail({
  id,
  go,
  openCompare,
  openPortal
}: {
  id: string
  go: (v: WorkspaceView) => void
  openCompare?: (project: ManuscriptProject) => void
  openPortal?: (projectId: string, journalId?: string) => void
}) {
  const { data, update, log } = useWorkspace()
  const [drawerId, setDrawerId] = useState<string | null>(null)
  // Recommendations render in pages so long tier lists never dump at once.
  const [recLimits, setRecLimits] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState(false)
  const [rerunNote, setRerunNote] = useState('')
  const [fileNote, setFileNote] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editAbstract, setEditAbstract] = useState('')
  const [abstractOpen, setAbstractOpen] = useState(false)
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
      log('analysis', `Re-ran analysis for "${result.name}": ${result.analysis?.matches.length ?? 0} recommendations.`, project.id)
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

  async function toggleCompare(journalId: string) {
    if (!project) return
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => {
        if (p.id !== project.id) return p
        const has = p.comparedJournalIds.includes(journalId)
        const next = has ? p.comparedJournalIds.filter((x) => x !== journalId) : [...p.comparedJournalIds, journalId].slice(-3)
        return { ...p, comparedJournalIds: next, updatedAt: new Date().toISOString() }
      })
    }))
  }

  async function clearCompare() {
    if (!project) return
    await update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) =>
        p.id === project.id ? { ...p, comparedJournalIds: [], updatedAt: new Date().toISOString() } : p
      )
    }))
  }

  const downloadOriginal = async () => {
    setFileNote('')
    const file = await getFile(project.id).catch(() => null)
    if (!file) {
      setFileNote('The stored PDF could not be loaded. It may have been removed from this browser or bucket.')
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

  /* ---- Manuscript dashboard derived data ---- */
  const content = project.edited ?? project.extracted
  const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    uploaded: 'Uploaded',
    extracting: 'Extracting…',
    reviewing: 'Needs review',
    matching: 'Matching…',
    generating: 'Scoring…',
    completed: 'Analyzed',
    failed: 'Failed'
  }
  const SUB_LABEL: Record<string, string> = {
    draft: 'Draft package',
    submitted: 'Submitted',
    under_review: 'Under review',
    revision_requested: 'Revision requested',
    revision_submitted: 'Revision submitted',
    accepted: 'Accepted',
    rejected: 'Rejected',
    published: 'Published',
    withdrawn: 'Withdrawn'
  }
  const latestSubmission = [...project.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const selMatch = matches.find((m) => m.journal.id === project.selectedJournalId)
  const selectedJournal = selMatch?.journal ?? null
  const auditS = lastAudit ? auditSummary(lastAudit) : null
  const packagePrepared = project.actionsCompleted.includes('submission_prepared') || project.submissions.length > 0
  const journalInitials = (selectedJournal?.title ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const pipeline = [
    { label: 'Extracted', done: !!content },
    { label: 'Analyzed', done: !!project.analysis },
    { label: 'Readiness', done: project.audits.length > 0 },
    { label: 'Submission', done: project.submissions.length > 0 || project.actionsCompleted.includes('submission_prepared') },
    { label: 'Post-submission', done: project.submissions.some((s) => s.status !== 'draft') },
    { label: 'Published', done: project.submissions.some((s) => s.status === 'published' || s.status === 'accepted') }
  ]
  const fileSizeLabel = project.fileSize
    ? project.fileSize >= 1024 * 1024
      ? `${(project.fileSize / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(project.fileSize / 1024))} KB`
    : null

  const kpis = [
    {
      k: 'Length',
      v: content ? `${content.pageCount} page${content.pageCount === 1 ? '' : 's'}` : 'N/A',
      s: content ? `${content.wordCount.toLocaleString()} words` : 'Not extracted',
      tone: ''
    },
    {
      k: 'Keywords',
      v: content ? String(content.keywords.length) : 'N/A',
      s: content && content.keywords.length > 0 ? 'keywords detected' : 'None detected',
      tone: ''
    },
    {
      k: 'Candidates',
      v: project.analysis ? String(project.analysis.candidateCount) : 'N/A',
      s: project.analysis ? 'journals retrieved' : 'Analysis not run',
      tone: 'is-info'
    },
    {
      k: 'Readiness',
      v: auditS && lastAudit ? `${auditS.pass}/${lastAudit.checks.length}` : 'N/A',
      s: auditS
        ? `${auditS.attention + auditS.warning} need attention${auditS.unknown ? ` · ${auditS.unknown} unknown` : ''}`
        : 'Not run yet',
      tone: !auditS ? '' : auditS.attention + auditS.warning > 0 ? 'is-warn' : 'is-good'
    },
    {
      k: 'Target journal',
      v: selectedJournal ? selectedJournal.title : 'N/A',
      s: selectedJournal ? selectedJournal.publisher ?? 'Publisher unknown' : matches.length > 0 ? 'Not selected' : 'Run analysis first',
      tone: selectedJournal ? 'is-info' : ''
    },
    {
      k: 'Submission',
      v: latestSubmission
        ? SUB_LABEL[latestSubmission.status] ?? latestSubmission.status
        : packagePrepared
          ? 'Prepared'
          : 'Not started',
      s: latestSubmission ? `Attempt #${latestSubmission.attemptNumber}` : packagePrepared ? 'Package ready' : 'No attempt yet',
      tone: latestSubmission
        ? ['published', 'accepted'].includes(latestSubmission.status)
          ? 'is-good'
          : 'is-info'
        : packagePrepared
          ? 'is-info'
          : ''
    }
  ]


  /* ---- Tier / exclusion helpers for recommendations ---- */
  const tieredIds = project.analysis
    ? new Set([...project.analysis.tiers.tier1, ...project.analysis.tiers.tier2, ...project.analysis.tiers.tier3])
    : new Set<string>()
  const excludedMatches = matches.filter((m) => !tieredIds.has(m.journal.id))
  const tieredCount = tieredIds.size
  const exclusionReasons = (project.analysis?.notices ?? [])
    .filter((n) => n.startsWith('Excluded from tiers:'))
    .map((n) => n.replace('Excluded from tiers:', '').trim().replace(/\.$/, ''))

  const renderRecRow = (mm: (typeof matches)[number], keyPrefix: string) => {
    const j = mm.journal
    const inCompare = project.comparedJournalIds.includes(j.id)
    const unranked = !tieredIds.has(j.id)
    const evidence = mm.evidence.map((e) => e.detail).join(' · ') || 'No positive evidence.'
    return (
      <tr key={`${keyPrefix}-${j.id}`}>
        <td className="ws-rec-score">{mm.score}</td>
        <td>
          <span className="ws-rec-title" title={j.title}>{j.title}</span>
          <div className="ws-rec-sub">
            {j.publisher ?? 'Publisher unknown'}
            {j.issn ? ` · ISSN ${j.issn}` : ''}
            {j.isOpenAccess && <span className="ws-chip ws-chip-oa">OA</span>}
            {typeof j.apcUsd === 'number' && <span className="ws-chip">APC ~US${j.apcUsd.toLocaleString()}</span>}
            {unranked && <span className="ws-chip ws-chip-excl">Not ranked</span>}
          </div>
        </td>
        <td className="ws-rec-ev" title={evidence}>{evidence}</td>
        <td className="ws-rec-actions">
          <button type="button" className="ws-btn ws-btn-outline" onClick={() => setDrawerId(j.id)}>
            Details
          </button>
          <button
            type="button"
            className={`ws-btn ${inCompare ? 'ws-btn-outline' : 'ws-btn-ghost'}`}
            onClick={() => {
              void toggleCompare(j.id)
              const nextIds = inCompare
                ? project.comparedJournalIds.filter((x) => x !== j.id)
                : [...project.comparedJournalIds, j.id].slice(-3)
              if (nextIds.length >= 2) openCompare?.({ ...project, comparedJournalIds: nextIds })
            }}
          >
            {inCompare ? 'Compare ✓' : 'Compare'}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <button type="button" className="ws-linkish" onClick={() => go({ name: 'manuscripts' })} style={{ fontSize: 12.5, marginBottom: 8 }}>
        ← All manuscripts
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h1 className="ws-h1" style={{ marginBottom: 0 }}>{project.name}</h1>
            <span className={`ws-status is-${project.status}`}>{STATUS_LABEL[project.status] ?? project.status}</span>
          </div>
          <p className="ws-sub" style={{ margin: '6px 0 10px' }}>
            {project.fileName
              ? `${project.fileName} · ${fileSizeLabel ?? 'size unknown'} · `
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
                <button
                  type="button"
                  className="ws-btn ws-btn-primary"
                  onClick={() => openPortal?.(project.id, project.selectedJournalId ?? undefined)}
                >
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
          {project.error}. Provider failures are safe to retry; your manuscript data is unchanged.
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

      {/* KPI stat row */}
      <div className="ws-md-kpis">
        {kpis.map((t) => (
          <div key={t.k} className={`ws-md-kpi ${t.tone}`}>
            <span className="k">{t.k}</span>
            <b title={t.v}>{t.v}</b>
            <small>{t.s}</small>
          </div>
        ))}
      </div>

      {/* Two-column academic dashboard: main tables + super sidebar rail */}
      <div className="ws-md-grid">
        <main className="ws-md-main">
      {/* Manuscript details table */}
      <section className="ws-md-panel" id="details">
        <div className="ws-md-panel-head">
          <h2>Manuscript details</h2>
          <span>Updated {fmt(project.updatedAt)}</span>
        </div>
        <div className="ws-md-meta">
          <div className="ws-md-meta-item is-wide">
            <span className="k">Title</span>
            <p className="ws-md-meta-title">{content?.title || 'Untitled'}</p>
          </div>

          <div className="ws-md-meta-item is-wide is-abstract">
            <span className="k">Abstract</span>
            <p className={`ws-md-meta-abstract${abstractOpen ? ' is-open' : ''}`}>
              {content?.abstract || 'No abstract extracted'}
            </p>
            {content?.abstract && content.abstract.length > 400 && (
              <button type="button" className="ws-linkish" onClick={() => setAbstractOpen(!abstractOpen)}>
                {abstractOpen ? 'Show less' : 'Show full abstract'}
              </button>
            )}
          </div>

          <div className="ws-md-meta-item">
            <span className="k">File</span>
            <p className="v">
              {project.fileName ?? 'No file stored'}
              {fileSizeLabel && <> · {fileSizeLabel}</>}
              {project.hasStoredFile && (
                <> · <button type="button" className="ws-linkish" onClick={() => void downloadOriginal()}>Download PDF</button></>
              )}
            </p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Length</span>
            <p className="v">
              {content ? `${content.pageCount} page${content.pageCount === 1 ? '' : 's'} · ${content.wordCount.toLocaleString()} words` : 'Not extracted yet'}
              {content && content.referenceCount > 0 && <> · {content.referenceCount} references detected</>}
            </p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Keywords</span>
            {content && content.keywords.length > 0 ? (
              <div className="v">
                <span className="ws-meta-chips">
                  {content.keywords.map((k) => (
                    <span key={k} className="ws-chip">{k}</span>
                  ))}
                </span>
              </div>
            ) : (
              <p className="v">None detected</p>
            )}
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Field</span>
            <p className="v">
              {content?.field || 'Unknown'}
              {content?.articleType ? ` · ${content.articleType}` : ''}
            </p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Created</span>
            <p className="v">{fmt(project.createdAt)}</p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Updated</span>
            <p className="v">{fmt(project.updatedAt)}</p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Analysis</span>
            <p className="v">
              {project.analysis
                ? `${project.analysis.engineVersion} · ${project.analysis.candidateCount} candidates retrieved · ${fmt(project.analysis.ranAt)}`
                : 'Not run yet'}
            </p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Target journal</span>
            <p className="v">{selectedJournal?.title ?? (matches.length > 0 ? 'Not selected yet' : 'Run analysis to see candidates')}</p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Readiness</span>
            <p className="v">
              {lastAudit && auditS
                ? `${project.audits.length} audit${project.audits.length === 1 ? '' : 's'} · ${auditS.pass} pass · ${auditS.attention} attention · ${auditS.warning} warning · ${auditS.unknown} unknown`
                : 'Not run yet'}
            </p>
          </div>
          <div className="ws-md-meta-item">
            <span className="k">Submission</span>
            <p className="v">
              {latestSubmission ? (
                <>
                  <strong>{SUB_LABEL[latestSubmission.status] ?? latestSubmission.status}</strong>
                  {' · '}{latestSubmission.targetJournalTitle}
                  {' · attempt #'}{latestSubmission.attemptNumber}
                  {latestSubmission.submissionDate && <> · submitted {fmt(latestSubmission.submissionDate)}</>}
                </>
              ) : packagePrepared ? (
                'Package prepared. Not sent yet'
              ) : (
                'Not prepared yet'
              )}
            </p>
          </div>
        </div>
      </section>

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
                // Always re-run. Even with unchanged fields (e.g. resuming an
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

      {/* extraction summary lives in the Manuscript dashboard panel above */}

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
          {matches.length === 0 && (
            <div className="ws-notice" role="status">
              No candidates were returned from the live sources. Retry “Run new analysis” when connectivity recovers.
            </div>
          )}
          {tieredCount === 0 && matches.length > 0 && (
            <div className="ws-notice" role="status">
              <strong>
                All {matches.length} candidates were excluded from tier ranking
                {exclusionReasons.length > 0 ? ` \u2014 ${exclusionReasons.join('. ')}` : ''}.
              </strong>{' '}
              They are listed below unranked. You can still review their evidence, save, compare, or select one
              as the target journal for your readiness check.
            </div>
          )}
          {matches.length > 0 && (
            <div className="ws-table-scroll">
              <table className="ws-rec-table">
                <colgroup>
                  <col className="c-score" />
                  <col className="c-journal" />
                  <col className="c-ev" />
                  <col className="c-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="c-score">Score</th>
                    <th>Journal</th>
                    <th>Why it matches</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(['tier1', 'tier2', 'tier3'] as FitTier[]).flatMap((tier) => {
                    const ids = project.analysis!.tiers[tier]
                    const list = ids.map((tid) => matches.find((m) => m.journal.id === tid)).filter(Boolean)
                    if (list.length === 0) return []
                    const shown = Math.min(recLimits[tier] ?? 6, list.length)
                    return [
                      <tr className="ws-rec-tier" key={tier}>
                        <td colSpan={4}>
                          {TIER_INFO[tier].title}
                          <span className="ws-rec-tier-note"> · {TIER_INFO[tier].note}</span>
                        </td>
                      </tr>,
                      ...list.slice(0, shown).map((m) => renderRecRow(m!, tier)),
                      ...(list.length > shown
                        ? [
                            <tr key={`${tier}-more`} className="ws-rec-more">
                              <td colSpan={4}>
                                <button
                                  type="button"
                                  className="ws-linkish"
                                  onClick={() =>
                                    setRecLimits((r) => ({ ...r, [tier]: (r[tier] ?? 6) + 10 }))
                                  }
                                >
                                  Show more ({list.length - shown} remaining)
                                </button>
                              </td>
                            </tr>
                          ]
                        : [])
                    ]
                  })}
                  {tieredCount === 0 &&
                    (() => {
                      const shown = Math.min(recLimits.unranked ?? 6, excludedMatches.length)
                      return [
                        ...excludedMatches.slice(0, shown).map((m) => renderRecRow(m, 'unranked')),
                        ...(excludedMatches.length > shown
                          ? [
                              <tr key="unranked-more" className="ws-rec-more">
                                <td colSpan={4}>
                                  <button
                                    type="button"
                                    className="ws-linkish"
                                    onClick={() =>
                                      setRecLimits((r) => ({ ...r, unranked: (r.unranked ?? 6) + 10 }))
                                    }
                                  >
                                    Show more ({excludedMatches.length - shown} remaining)
                                  </button>
                                </td>
                              </tr>
                            ]
                          : [])
                      ]
                    })()}
                </tbody>
              </table>
            </div>
          )}

          {compareMatches.length === 1 && (
            <p className="ws-md-muted" style={{ marginTop: '0.75rem', fontSize: 12.5 }}>
              1 journal selected for comparison. Choose one more to see them side by side.
            </p>
          )}

          {compareMatches.length >= 2 && (
            <div className="ws-compare-bar">
              <div className="ws-compare-bar-info">
                <strong>Compare selected journals</strong>
                <span>{compareMatches.length} of 3 slots used</span>
              </div>
              <div className="ws-compare-bar-actions">
                <button type="button" className="ws-btn ws-btn-primary" onClick={() => openCompare?.(project)}>
                  Open comparison
                </button>
                <button type="button" className="ws-btn ws-btn-ghost" onClick={() => void clearCompare()}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Readiness: full checks live on the Readiness Checks page */}
          <div className="ws-tier-head">
            <h3>Readiness check</h3>
            <p>Automated checks against extracted content. Supports your review, does not guarantee compliance.</p>
          </div>
          <div className="ws-card">
            <p className="ws-rd-note" style={{ margin: 0 }}>
              Open the Readiness Checks page to run checks, resolve items, and export reports for this manuscript.
            </p>
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="ws-btn ws-btn-primary"
                onClick={() => go({ name: 'readiness', id: project.id })}
              >
                Go to Readiness Checks
              </button>
            </div>
          </div>
        </>
      )}
        </main>

        {/* Super sidebar rail: at-a-glance cards for this manuscript */}
        <aside className="ws-md-rail" aria-label="Manuscript summary">
          <section className="ws-md-card">
            <h3>Pipeline</h3>
            <div className="ws-md-card-body">
              <ol className="ws-md-steps is-rail" aria-label="Submission pipeline steps">
                {pipeline.map((s, i) => (
                  <li key={s.label} className={s.done ? 'done' : 'todo'}>
                    <i aria-hidden="true">{s.done ? '✓' : i + 1}</i>
                    {s.label}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="ws-md-card">
            <h3>Target journal</h3>
            <div className="ws-md-card-body">
              {selectedJournal ? (
                <>
                  <div className="ws-md-journal">
                    <span className="ws-md-avatar" aria-hidden="true">{journalInitials || 'N/A'}</span>
                    <div>
                      <strong>{selectedJournal.title}</strong>
                      <small>
                        {selectedJournal.publisher ?? 'Publisher unknown'}
                        {selectedJournal.issn ? ` · ISSN ${selectedJournal.issn}` : ''}
                      </small>
                    </div>
                  </div>
                  <div className="ws-md-chips">
                    {selMatch && <span className="ws-chip">Relevance {selMatch.score}</span>}
                    {selectedJournal.isOpenAccess && <span className="ws-chip ws-chip-oa">Open access</span>}
                    {typeof selectedJournal.apcUsd === 'number' && (
                      <span className="ws-chip">APC ~US${selectedJournal.apcUsd.toLocaleString()}</span>
                    )}
                  </div>
                  <button type="button" className="ws-btn ws-btn-ghost ws-md-full" onClick={() => setDrawerId(selectedJournal.id)}>
                    View journal details
                  </button>
                  {journalSiteUrl(selectedJournal) && (
                    <a
                      className="ws-btn ws-btn-ghost ws-md-full"
                      href={journalSiteUrl(selectedJournal)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none', justifyContent: 'center' }}
                    >
                      Visit website ↗
                    </a>
                  )}
                </>
              ) : (
                <p className="ws-md-muted">Pick a candidate from Journal recommendations below.</p>
              )}
            </div>
          </section>

          <section className="ws-md-card">
            <h3>Readiness</h3>
            <div className="ws-md-card-body">
              {lastAudit && auditS ? (
                <>
                  <div className="ws-md-mini">
                    <span className="g"><b>{auditS.pass}</b> pass</span>
                    <span className="y"><b>{auditS.attention}</b> attention</span>
                    <span className="o"><b>{auditS.warning}</b> warning</span>
                    <span className="n"><b>{auditS.unknown}</b> unknown</span>
                  </div>
                  <div className="ws-readiness-bar">
                    <div className="ws-readiness-bar-seg pass" style={{ width: `${(auditS.pass / lastAudit.checks.length) * 100}%` }} />
                    <div className="ws-readiness-bar-seg attention" style={{ width: `${(auditS.attention / lastAudit.checks.length) * 100}%` }} />
                    <div className="ws-readiness-bar-seg warning" style={{ width: `${(auditS.warning / lastAudit.checks.length) * 100}%` }} />
                    <div className="ws-readiness-bar-seg unknown" style={{ width: `${((auditS.unknown + auditS['not-checked']) / lastAudit.checks.length) * 100}%` }} />
                  </div>
                </>
              ) : (
                <p className="ws-md-muted">No readiness check yet for this journal.</p>
              )}
              <button
                type="button"
                className="ws-btn ws-btn-outline ws-md-full"
                onClick={() => go({ name: 'readiness', id: project.id })}
              >
                Go to Readiness Checks
              </button>
            </div>
          </section>

          <section className="ws-md-card">
            <h3>Submission</h3>
            <div className="ws-md-card-body">
              <div className="ws-md-sub">
                <strong>
                  {latestSubmission
                    ? SUB_LABEL[latestSubmission.status] ?? latestSubmission.status
                    : packagePrepared
                      ? 'Package prepared'
                      : 'Not prepared yet'}
                </strong>
                <small>
                  {latestSubmission
                    ? `${latestSubmission.targetJournalTitle} · attempt #${latestSubmission.attemptNumber}`
                    : packagePrepared
                      ? 'Not sent yet'
                      : 'Start from the readiness checklist'}
                </small>
              </div>
              {matches.length > 0 && (
                <button
                  type="button"
                  className="ws-btn ws-btn-primary ws-md-full"
                  onClick={() => openPortal?.(project.id, project.selectedJournalId ?? undefined)}
                >
                  Prepare submission
                </button>
              )}
              {latestSubmission && (
                <button
                  type="button"
                  className="ws-btn ws-btn-ghost ws-md-full"
                  onClick={() => go({ name: 'pipeline' })}
                >
                  Track in Publications
                </button>
              )}
              {latestSubmission && (latestSubmission.status === 'rejected' || latestSubmission.status === 'withdrawn') && (
                <ReroutePanel
                  project={project}
                  previousAttemptId={latestSubmission.id}
                  onRerouted={(journalId) => openPortal?.(project.id, journalId)}
                  onFindJournals={() => go({ name: 'find-journals' })}
                />
              )}
            </div>
          </section>
        </aside>
      </div>

      {drawerMatch && (
        <JournalDrawer
          match={drawerMatch}
          onClose={() => setDrawerId(null)}
          onCompare={() => {
            void toggleCompare(drawerMatch.journal.id)
            const active = project.comparedJournalIds.includes(drawerMatch.journal.id)
            const nextIds = active
              ? project.comparedJournalIds.filter((x) => x !== drawerMatch.journal.id)
              : [...project.comparedJournalIds, drawerMatch.journal.id].slice(-3)
            if (nextIds.length >= 2) {
              setDrawerId(null)
              openCompare?.({ ...project, comparedJournalIds: nextIds })
            }
          }}
          compareActive={project.comparedJournalIds.includes(drawerMatch.journal.id)}
          ranAt={project.analysis?.ranAt}
        />
      )}

    </div>
  )
}
