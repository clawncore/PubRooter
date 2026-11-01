import { useRef, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { runReadiness, auditSummary } from '../../workspace/readiness'
import { getJournalRequirements } from '../../workspace/submissions'
import { loadAttachedDocs } from '../../workspace/attached-docs'
import { journalSiteUrl } from '../../workspace/journal-url'
import { uid } from '../../lib/storage'
import { JournalDrawer } from './JournalDrawer'
import type { ExtractedContent, ManuscriptProject } from '../../workspace/types'
import type { JournalCandidate } from '../../types'
import type { WorkspaceView } from './WorkspaceApp'
import './readiness-detail.css'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function journalInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

type Summary = ReturnType<typeof auditSummary>

function statusOf(s: Summary | null) {
  if (!s) return { cls: 'is-none', label: 'Not run' }
  if (s.warning > 0) return { cls: 'is-warning', label: 'Warning' }
  if (s.attention > 0) return { cls: 'is-attention', label: 'Needs attention' }
  if (s.pass > 0) return { cls: 'is-pass', label: 'Ready' }
  return { cls: 'is-unknown', label: 'Unknown' }
}

function msTitleOf(p: { name: string; edited: ExtractedContent | null; extracted: ExtractedContent | null }) {
  return p.edited?.title?.trim() || p.extracted?.title?.trim() || p.name
}

type RankRow = {
  m: { score: number }
  s: { attention: number; warning: number; pass: number } | null
}

function byReadiness(a: RankRow, b: RankRow) {
  const aAud = a.s ? 0 : 1
  const bAud = b.s ? 0 : 1
  if (aAud !== bAud) return aAud - bAud
  if (a.s && b.s) {
    const d = a.s.attention + a.s.warning - (b.s.attention + b.s.warning)
    if (d !== 0) return d
    const p = b.s.pass - a.s.pass
    if (p !== 0) return p
  }
  return b.m.score - a.m.score
}

type ReqRow = { req: string; have: string; status: 'met' | 'missing' | 'unknown' }

type AuditCheckLike = { label: string; status: string; evidence?: string; sourceUrl?: string }

function requirementRows(
  edited: ExtractedContent,
  journal: JournalCandidate,
  checks?: AuditCheckLike[]
): ReqRow[] {
  const r = getJournalRequirements(journal)
  const rows: ReqRow[] = []
  const abstractWords = edited.abstract.split(/\s+/).filter(Boolean).length
  const hasSection = (...keys: string[]) => edited.sections.some((s) => keys.some((k) => s.includes(k)))
  const notVerifiable = 'Not verifiable from the manuscript text'

  if (typeof r.wordLimitAbstract === 'number') {
    rows.push({
      req: `Abstract no more than ${r.wordLimitAbstract} words`,
      have: `${abstractWords} words extracted`,
      status: abstractWords > 0 && abstractWords <= r.wordLimitAbstract ? 'met' : 'missing'
    })
  } else if (abstractWords > 0) {
    rows.push({
      req: 'Abstract length',
      have: `${abstractWords} words (no published limit found)`,
      status: 'unknown'
    })
  }

  if (typeof r.wordLimitMainText === 'number') {
    rows.push({
      req: `Main text no more than ${r.wordLimitMainText.toLocaleString()} words`,
      have: `${edited.wordCount.toLocaleString()} words extracted`,
      status: edited.wordCount <= r.wordLimitMainText ? 'met' : 'missing'
    })
  }

  const sectionReqs: [string, boolean, string[]][] = [
    ['Data availability statement', r.requiresDataAvailability, ['data availability']],
    ['Ethics statement', r.requiresEthicsStatement, ['ethics', 'ethical']],
    ['Conflict of interest statement', r.requiresConflictOfInterest, ['conflict of interest', 'competing interest']],
    ['Funding statement', r.requiresFunding, ['funding', 'acknowledg']],
    ['Code availability statement', r.requiresCodeAvailability, ['code availability', 'availability of code']]
  ]
  for (const [label, required, keys] of sectionReqs) {
    if (!required) continue
    const found = hasSection(...keys)
    rows.push({
      req: label,
      have: found ? 'Detected in the extracted manuscript' : 'Not detected in the extracted manuscript',
      status: found ? 'met' : 'missing'
    })
  }

  if (r.requiresCoverLetter) rows.push({ req: 'Cover letter', have: notVerifiable, status: 'unknown' })
  if (r.requiresTitlePage) rows.push({ req: 'Title page', have: notVerifiable, status: 'unknown' })
  if (r.requiresStructuredAbstract) {
    rows.push({
      req: 'Structured abstract',
      have: `${abstractWords}-word abstract, structure not verified`,
      status: 'unknown'
    })
  }
  if (r.requiresORCID) rows.push({ req: 'ORCID for authors', have: notVerifiable, status: 'unknown' })
  if (r.requiresDoubleBlind) rows.push({ req: 'Double-blind formatting', have: notVerifiable, status: 'unknown' })

  rows.push({ req: 'Reference style', have: r.referenceStyle, status: 'unknown' })

  if (typeof r.maxReferences === 'number') {
    rows.push({
      req: `No more than ${r.maxReferences} references`,
      have: `${edited.referenceCount} references extracted`,
      status: edited.referenceCount <= r.maxReferences ? 'met' : 'missing'
    })
  }
  if (typeof r.maxFigures === 'number') {
    rows.push({ req: `No more than ${r.maxFigures} figures`, have: notVerifiable, status: 'unknown' })
  }
  if (typeof r.maxTables === 'number') {
    rows.push({ req: `No more than ${r.maxTables} tables`, have: notVerifiable, status: 'unknown' })
  }

  if (checks) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const covered = new Set(rows.map((x) => norm(x.req)))
    for (const c of checks) {
      const key = norm(c.label)
      if (covered.has(key)) continue
      covered.add(key)
      const status: ReqRow['status'] =
        c.status === 'pass' ? 'met' : c.status === 'unknown' || c.status === 'not-checked' ? 'unknown' : 'missing'
      const have =
        c.status === 'pass'
          ? c.evidence
            ? `Detected: ${c.evidence}`
            : 'Detected in the extracted manuscript text'
          : status === 'unknown'
            ? c.sourceUrl
              ? 'Verify on the journal site'
              : 'Could not be verified from the manuscript text'
            : 'Not detected in the extracted manuscript'
      rows.push({ req: c.label, have, status })
    }
  }

  return rows
}

const TIER_COPY = {
  tier1: { title: 'Recommended', note: 'Checked for readiness, best first' },
  tier2: { title: 'Less recommended', note: 'Not checked yet, next best by fit' },
  tier3: { title: 'Alternatives', note: 'Broader options worth considering' }
} as const

const RUN_STEPS = [
  'Reading manuscript…',
  'Extracting abstract…',
  'Checking section structure…',
  'Checking citations…',
  'Matching journal requirements…',
  'Scoring readiness…'
]

export function ReadinessDetail({
  id,
  go,
  openPortal
}: {
  id?: string
  go: (v: WorkspaceView) => void
  openPortal: (projectId: string, journalId?: string) => void
}) {
  const { data, update, log } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(null)
  const [auditId, setAuditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [runStep, setRunStep] = useState(0)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [tierTab, setTierTab] = useState<'tier1' | 'tier2' | 'tier3'>('tier1')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [reqFilter, setReqFilter] = useState<'all' | 'met' | 'missing' | 'unknown'>('all')
  const rootRef = useRef<HTMLDivElement>(null)

  const project = id ? data?.projects.find((p) => p.id === id) : undefined

  if (!data) return null
  if (!project || !project.analysis) return <ReadinessList go={go} />

  const matches = project.analysis.matches
  const audits = project.audits
  const drawerMatch = matches.find((m) => m.journal.id === drawerId) ?? null

  const rows = matches.map((m) => {
    const jAudits = audits.filter((a) => a.journalId === m.journal.id)
    const latest = jAudits[0] ?? null
    const s = latest ? auditSummary(latest) : null
    return { m, jAudits, latest, s, st: statusOf(s) }
  })
  const auditedRows = rows.filter((r) => r.latest)

  const best = [...auditedRows].sort(byReadiness)[0] ?? null
  const ranked = [...rows].sort(byReadiness)
  const tier1Rows = ranked.filter((r) => r.latest)
  const uncheckedRows = ranked.filter((r) => !r.latest)
  const tier2Rows = uncheckedRows.slice(0, 5)
  const tier3Rows = uncheckedRows.slice(5)

  const selectedRow =
    rows.find((r) => r.m.journal.id === openId) ??
    (best ?? tier1Rows[0] ?? rows[0]
      ? rows.find((r) => r.m.journal.id === (best ?? tier1Rows[0] ?? rows[0])!.m.journal.id)!
      : undefined)

  async function run(journalId: string) {
    if (!journalId) return
    setBusy(true)
    setRunStep(0)
    const timer = window.setInterval(() => {
      setRunStep((s) => (s < RUN_STEPS.length - 1 ? s + 1 : s))
    }, 320)
    try {
      const match = project!.analysis?.matches.find((m) => m.journal.id === journalId)
      const edited = project!.edited ?? project!.extracted
      if (match && edited) {
        const next = runReadiness(edited, match.journal, uid(), loadAttachedDocs(project!), project!.hasStoredFile)
        await Promise.all([
          update((ws) => ({
            ...ws,
            projects: ws.projects.map((p) =>
              p.id === project!.id
                ? { ...p, audits: [next, ...p.audits].slice(0, 20), selectedJournalId: journalId, updatedAt: new Date().toISOString() }
                : p
            )
          })),
          new Promise((r) => setTimeout(r, 1400))
        ])
        setAuditId(next.id)
        log('readiness', `Readiness check run for "${match.journal.title}".`, project!.id)
      }
    } finally {
      window.clearInterval(timer)
      setBusy(false)
    }
  }

  async function runAndOpen(journalId: string) {
    setAuditId(null)
    await run(journalId)
    setDrawerId(null)
    setOpenId(journalId)
  }

  function openJournal(jid: string | null) {
    setAuditId(null)
    setDrawerId(null)
    setOpenId(jid)
    setReqFilter('all')
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const journal = selectedRow?.m.journal ?? null
  const jAudits = selectedRow?.jAudits ?? []
  const audit = jAudits.find((a) => a.id === auditId) ?? jAudits[0] ?? null
  const auditIndex = audit ? jAudits.findIndex((a) => a.id === audit.id) : -1
  const summary = audit ? auditSummary(audit) : null
  const edited = project.edited ?? project.extracted ?? null
  const reqs = journal && edited ? requirementRows(edited, journal, audit?.checks) : []
  const reqCounts = {
    met: reqs.filter((r) => r.status === 'met').length,
    missing: reqs.filter((r) => r.status === 'missing').length,
    unknown: reqs.filter((r) => r.status === 'unknown').length,
  }
  const shownReqs = reqFilter === 'all' ? reqs : reqs.filter((r) => r.status === reqFilter)
  const journalMatch = selectedRow?.m ?? null
  const journalLink = journal ? journalSiteUrl(journal) : undefined
  const reqsSource = journal ? getJournalRequirements(journal) : null

  const tierPanel = (tier: 'tier1' | 'tier2' | 'tier3', list: (typeof rows)[number][]) => {
    const copy = TIER_COPY[tier]
    if (list.length === 0) {
      if (tier !== 'tier1') return null
      return (
        <section className="ws-md-panel" key={tier}>
          <div className="ws-md-panel-head">
            <h2>{copy.title}</h2>
            <span>nothing checked yet</span>
          </div>
          <div className="rp-panel-body">
            <p className="rp-tier-note">
              Run a check to rank journals by readiness. Every journal you check appears here, best first.
            </p>
          </div>
        </section>
      )
    }
    return (
      <section className="ws-md-panel" key={tier}>
        <div className="ws-md-panel-head">
          <h2>{copy.title}</h2>
          <span>
            {copy.note} · {list.length}
          </span>
        </div>
        <div className="rp-panel-body rp-tier">
          {list.map((r) => {
            const current = journal?.id === r.m.journal.id
            return (
              <div
                key={r.m.journal.id}
                className={`rp-tier-row${current ? ' is-current' : ''}`}
                tabIndex={0}
                role="button"
                onClick={() => openJournal(r.m.journal.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openJournal(r.m.journal.id)
                  }
                }}
              >
                <span className="ws-md-avatar" aria-hidden="true">
                  {journalInitials(r.m.journal.title) || 'NA'}
                </span>
                <div className="rp-tier-name">
                  <strong>{r.m.journal.title}</strong>
                  <small>
                    {r.m.journal.publisher ?? 'Publisher unknown'}
                    {r.m.journal.issn ? ` · ISSN ${r.m.journal.issn}` : ''}
                  </small>
                </div>
                <span className="ws-chip">Relevance {r.m.score}</span>
                <span className={`rp-status ${r.st.cls}`}>{r.st.label}</span>
                {r.s && (
                  <span className="rp-tier-counts">
                    {r.s.pass} pass · {r.s.attention} attention
                  </span>
                )}
                <div className="rp-actions">
                  <button
                    type="button"
                    className="ws-btn ws-btn-ghost"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation()
                      void runAndOpen(r.m.journal.id)
                    }}
                  >
                    {busy ? 'Running…' : 'Run check'}
                  </button>
                  <button
                    type="button"
                    className="ws-btn ws-btn-outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      openJournal(r.m.journal.id)
                    }}
                  >
                    {current ? 'Viewing' : 'View checks'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div ref={rootRef}>
      <div className="rp-head">
        <button
          type="button"
          className="ws-linkish rp-back"
          onClick={() => go({ name: 'readiness' })}
        >
          ← Readiness Checks
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 className="ws-h1 rp-title" style={{ marginBottom: 0 }}>
              {msTitleOf(project)}
            </h1>
            <p className="ws-sub rp-sub">
              Readiness Checks · {auditedRows.length} of {matches.length} journal{matches.length === 1 ? '' : 's'} checked
              {best ? ` · Best match: ${best.m.journal.title}` : ' · No checks run yet'}
            </p>
          </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {audits.length > 0 && (
            <button
              type="button"
              className="ws-btn ws-btn-outline"
              onClick={() => go({ name: 'pipeline' })}
            >
              Publications →
            </button>
          )}
        </div>
        </div>
      </div>

      <div className={`rp-bestfit${best ? '' : ' rp-bestfit-idle'}`}>
        <div className="rp-bestfit-main">
          {best ? (
            <>
              <span className="rp-bestfit-label">Best match for “{msTitleOf(project)}”</span>
              <strong>{best.m.journal.title}</strong>
              <span className="rp-bestfit-metrics">
                <span className="m is-pass">
                  <i aria-hidden="true" />
                  <b>{best.s?.pass ?? 0}</b> passed
                </span>
                {(best.s?.attention ?? 0) > 0 && (
                  <span className="m is-attention">
                    <i aria-hidden="true" />
                    <b>{best.s?.attention}</b> need attention
                  </span>
                )}
                {(best.s?.warning ?? 0) > 0 && (
                  <span className="m is-warning">
                    <i aria-hidden="true" />
                    <b>{best.s?.warning}</b> warning
                  </span>
                )}
                <span className="m is-rel">
                  <b>{best.m.score}</b> relevance
                </span>
              </span>
              <small>
                Ranked by readiness across {auditedRows.length} checked journal
                {auditedRows.length === 1 ? '' : 's'}. Run more checks to sharpen the ranking.
              </small>
            </>
          ) : (
            <>
              <strong>No checks run yet</strong>
              <small>Run a check on any journal below to see which one best suits this manuscript.</small>
            </>
          )}
        </div>
        {best && journal && best.m.journal.id !== journal.id && (
          <button type="button" className="ws-btn ws-btn-primary" onClick={() => openJournal(best.m.journal.id)}>
            Switch to best match
          </button>
        )}
      </div>

      {selectedRow && journal ? (
        <div key={journal.id} className="rp-portal-swap">
          {best && best.m.journal.id !== journal.id && (
            <button type="button" className="rp-back-best" onClick={() => openJournal(best.m.journal.id)}>
              ← Back to recommended journal
            </button>
          )}
          <div className="rp-runbar">
            <span className="rp-runbar-label" aria-hidden="true">
              Journal for checks
            </span>
            <span className="rp-runbar-static" title={journal.title}>
              {journal.title}
            </span>
            <button type="button" className="ws-btn ws-btn-primary" disabled={busy} onClick={() => void run(journal.id)}>
              {busy ? 'Running…' : 'Run check'}
            </button>
            <button
              type="button"
              className="ws-btn ws-btn-outline"
              onClick={() => openPortal(project.id, journal.id)}
            >
              Prepare submission
            </button>
            {audit && auditIndex > 0 && jAudits.length > 1 && (
              <span className="rp-viewing">
                viewing audit #{jAudits.length - auditIndex} of {jAudits.length}
              </span>
            )}
          </div>

          {busy && (
            <div className="rp-run-progress" role="status" aria-live="polite">
              <span className="rp-run-progress-track" aria-hidden="true">
                <i />
              </span>
              <span className="rp-run-progress-step">{RUN_STEPS[runStep]}</span>
            </div>
          )}

          <div className="ws-md-grid">
            <main className="ws-md-main">
              <section className="ws-md-panel rp-req-panel">
                <div className="ws-md-panel-head">
                  <h2>Publication requirements for {journal.title}</h2>
                  {reqsSource && reqsSource.sourceUrl && (
                    <a href={reqsSource.sourceUrl} target="_blank" rel="noreferrer">
                      {reqsSource.source === 'known' ? 'Registry data' : 'Site defaults'} · verify ↗
                    </a>
                  )}
                </div>
                <div className="rp-panel-body">
                  {reqs.length > 0 ? (
                    <>
                      <div className="rp-req-filter" role="group" aria-label="Filter requirements by status">
                        {(
                          [
                            ['all', 'All', reqs.length],
                            ['met', 'Met', reqCounts.met],
                            ['missing', 'Missing', reqCounts.missing],
                            ['unknown', 'Unknown', reqCounts.unknown],
                          ] as const
                        ).map(([key, label, count]) => (
                          <button
                            key={key}
                            type="button"
                            className={`rp-req-filter-btn${reqFilter === key ? ' is-active' : ''}`}
                            onClick={() => setReqFilter(key)}
                          >
                            {label}
                            <span> · {count}</span>
                          </button>
                        ))}
                      </div>
                      {shownReqs.length === 0 ? (
                        <p className="ws-md-muted">No requirements with this status.</p>
                      ) : (
                        <div className="ws-table-scroll">
                          <table className="ws-table rp-req-table">
                            <thead>
                              <tr>
                                <th>Requirement</th>
                                <th>What your manuscript has</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shownReqs.map((row) => (
                                <tr key={row.req}>
                                  <td>
                                    <strong>{row.req}</strong>
                                  </td>
                                  <td>{row.have}</td>
                                  <td>
                                    <span
                                      className={`rp-status ${
                                        row.status === 'met'
                                          ? 'is-pass'
                                          : row.status === 'missing'
                                            ? 'is-attention'
                                            : 'is-unknown'
                                      }`}
                                    >
                                      {row.status === 'met' ? 'Met' : row.status === 'missing' ? 'Missing' : 'Unknown'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="ws-md-muted">
                      No manuscript content available to compare against this journal&apos;s requirements yet.
                    </p>
                  )}
                </div>
              </section>

              <div className="rp-tier-tabs" role="tablist" aria-label="Journal shortlists">
                {(['tier1', 'tier2', 'tier3'] as const).map((t) => {
                  const count = t === 'tier1' ? tier1Rows.length : t === 'tier2' ? tier2Rows.length : tier3Rows.length
                  if (t !== 'tier1' && count === 0) return null
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tierTab === t}
                      className={`rp-tier-tab${tierTab === t ? ' is-active' : ''}`}
                      onClick={() => setTierTab(t)}
                    >
                      {TIER_COPY[t].title}
                      <span> · {count}</span>
                    </button>
                  )
                })}
              </div>
              {tierPanel(
                tierTab,
                tierTab === 'tier1' ? tier1Rows : tierTab === 'tier2' ? tier2Rows : tier3Rows
              )}
            </main>

            <aside className="ws-md-rail" aria-label="Readiness summary">
              <section className="ws-md-card">
                <h3>Journal workspace</h3>
                <div className="ws-md-card-body">
                  <div className="ws-md-journal">
                    <span className="ws-md-avatar" aria-hidden="true">
                      {journalInitials(journal.title) || 'NA'}
                    </span>
                    <div>
                      <strong>{journal.title}</strong>
                      <small>
                        {journal.publisher ?? 'Publisher unknown'}
                        {journal.issn ? ` · ISSN ${journal.issn}` : ''}
                      </small>
                    </div>
                  </div>
                  <div className="ws-md-chips">
                    <span className="ws-chip">Relevance {journalMatch?.score ?? 0}</span>
                    {journal.isOpenAccess && <span className="ws-chip ws-chip-oa">Open access</span>}
                    {typeof journal.apcUsd === 'number' && (
                      <span className="ws-chip">APC ~US${journal.apcUsd.toLocaleString()}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ws-btn ws-btn-ghost ws-md-full"
                    onClick={() => setDrawerId(journal.id)}
                  >
                    View journal details
                  </button>
                  {journalLink && (
                    <a
                      className="ws-btn ws-btn-ghost ws-md-full"
                      href={journalLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none', justifyContent: 'center' }}
                    >
                      Visit website ↗
                    </a>
                  )}
                </div>
              </section>

              <section className="ws-md-card">
                <h3>Engine &amp; scoring</h3>
                <div className="ws-md-card-body">
                  <div className="rp-engine">
                    <span>Engine</span>
                    <code>{audit?.engineVersion ?? 'pubrooter-readiness-v1'}</code>
                  </div>
                  <p className="ws-md-muted" style={{ marginTop: '0.5rem' }}>
                    Scores are relevance, not acceptance probability. Automated checks support author review and do
                    not guarantee editorial compliance or acceptance.
                  </p>
                </div>
              </section>

              <section className="ws-md-card">
                <h3>
                  Audit history <span className="rp-history-count">{jAudits.length}</span>
                </h3>
                <div className="ws-md-card-body">
                  {jAudits.length > 0 ? (
                    <>
                      <ul className="rp-history">
                        {(showAllHistory ? jAudits : jAudits.slice(0, 3)).map((a) => {
                          const hs = auditSummary(a)
                          const current = a.id === audit?.id
                          return (
                            <li key={a.id}>
                              <button
                                type="button"
                                className={`rp-history-item${current ? ' is-current' : ''}`}
                                onClick={() => setAuditId(a.id)}
                              >
                                <span className="rp-history-top">
                                  <strong>{fmtShort(a.runAt)}</strong>
                                  {current && <em className="rp-history-viewing">Viewing</em>}
                                </span>
                                <span className="rp-history-nums">
                                  <b>{hs.pass}</b> passed · <b>{hs.attention}</b> attention ·{' '}
                                  <b>{hs.warning}</b> warning · <b>{hs.unknown}</b> unknown
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      {jAudits.length > 3 && (
                        <button
                          type="button"
                          className="rp-history-more"
                          onClick={() => setShowAllHistory((v) => !v)}
                        >
                          {showAllHistory ? 'View less' : `View more (${jAudits.length - 3} hidden)`}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="ws-md-muted">
                      No audits stored for this journal yet. Each run keeps its engine version so older reports
                      remain interpretable.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : (
        <div className="ws-card ws-empty">
          <strong>No journal candidates yet</strong>
          Run an analysis first. Readiness checks run against the candidate journals from its results.
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'project', id: project.id })}>
              Open manuscript
            </button>
          </div>
        </div>
      )}

      {journal && (
        <section className="ws-md-panel rp-legend-full">
          <div className="ws-md-panel-head">
            <h2>What each status means</h2>
            <span>Read this before submitting</span>
          </div>
          <div className="rp-panel-body rp-legend-grid">
            <div className="rp-legend-item">
              <span className="rp-status is-pass">Pass / Met</span>
              <p>
                <strong>Positive evidence was found in the extracted manuscript text.</strong> The requirement is
                present and verified against what we could read from your file: an abstract within the journal&apos;s
                word limit, a detected data availability statement, or the required sections (introduction, methods,
                conclusion) being present. Met items count toward your readiness.
              </p>
            </div>
            <div className="rp-legend-item">
              <span className="rp-status is-attention">Needs attention / Missing</span>
              <p>
                <strong>Items to fix or explicitly confirm before submitting.</strong> The requirement could not be
                found in your manuscript: a funding statement, conflict-of-interest declaration, or ethics statement
                the journal expects. Add the missing text, or confirm with your co-authors that it is genuinely not
                applicable before you submit.
              </p>
            </div>
            <div className="rp-legend-item">
              <span className="rp-status is-warning">Warning</span>
              <p>
                <strong>Potential problems worth a careful review.</strong> Something in the manuscript conflicts with
                a common journal expectation: for example human or animal subject language detected without an
                accompanying ethics statement. These rarely block submission, but editors frequently ask about them,
                so review each warning carefully.
              </p>
            </div>
            <div className="rp-legend-item">
              <span className="rp-status is-unknown">Unknown</span>
              <p>
                <strong>Could not be verified from the extracted text.</strong> The check needs journal author
                instructions that live behind the journal&apos;s site (word limits, reference style, file formats,
                publication charges), or content we cannot see in the manuscript text (cover letter, title page).
                Unknown items are never counted as passed and never counted as failures either — verify them
                manually on the journal site before submitting.
              </p>
            </div>
          </div>
        </section>
      )}

      <p className="rp-footnote">
        {jAudits.length} audit{jAudits.length === 1 ? '' : 's'} stored for {journal?.title ?? 'this journal'}. Each
        keeps its engine version so older reports remain interpretable. Automated checks support author review and do
        not guarantee editorial compliance or acceptance.
      </p>

      {drawerMatch && (
        <JournalDrawer
          match={drawerMatch}
          onClose={() => setDrawerId(null)}
          ranAt={project.analysis.ranAt}
        />
      )}
    </div>
  )
}

function ReadinessList({ go }: { go: (v: WorkspaceView) => void }) {
  const { data, mode } = useWorkspace()
  if (!data) return null

  const analysed = data.projects.filter((p) => p.analysis)

  return (
    <div>
      <h1 className="ws-h1">Readiness Checks</h1>
      <p className="ws-sub">
        Pick a manuscript to see how its journals measure up: requirement-by-requirement readiness, best match
        first. Items that cannot be verified stay marked <strong>unknown</strong>, never passed.
      </p>

      {data.projects.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>No manuscripts yet</strong>
          {mode === 'cloud'
            ? 'Start with a PDF upload. Once analysis completes, its journals appear here for readiness checks.'
            : 'Start with a PDF upload. Once analysis completes, its journals appear here for readiness checks.'}
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
              Analyze a Manuscript
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
                  <th>Journals checked</th>
                  <th>Best match</th>
                  <th>Readiness</th>
                  <th>Last check</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => {
                  if (!p.analysis) {
                    return (
                      <tr key={p.id}>
                        <td>
                          <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                            {p.name}
                          </button>
                        </td>
                        <td colSpan={4} style={{ fontSize: 12.5, color: '#667085' }}>
                          {p.status === 'failed' ? (p.error ?? 'Analysis failed') : 'Analysis not finished yet'}
                        </td>
                        <td>
                          <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                            Open project
                          </button>
                        </td>
                      </tr>
                    )
                  }
                  const ranked = p.analysis.matches
                    .map((m) => {
                      const latest = p.audits.find((a) => a.journalId === m.journal.id) ?? null
                      const s = latest ? auditSummary(latest) : null
                      return { m, latest, s }
                    })
                    .sort(byReadiness)
                  const checked = ranked.filter((r) => r.latest)
                  const best = checked[0] ?? null
                  const last = p.audits[0] ?? null
                  return (
                    <tr key={p.id}>
                      <td>
                        <button type="button" className="ws-linkish" onClick={() => go({ name: 'readiness', id: p.id })}>
                          {p.name}
                        </button>
                        {msTitleOf(p) !== p.name && (
                          <div style={{ fontSize: 11.5, color: '#667085' }}>{msTitleOf(p)}</div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {checked.length} / {p.analysis.matches.length}
                      </td>
                      <td>
                        {best ? (
                          <>
                            <strong style={{ fontSize: 12.5 }}>{best.m.journal.title}</strong>
                            <div style={{ fontSize: 11, color: '#667085' }}>Relevance {best.m.score}</div>
                          </>
                        ) : (
                          <span style={{ fontSize: 12.5, color: '#667085' }}>No checks run yet</span>
                        )}
                      </td>
                      <td>
                        {best?.s ? (
                          <>
                            <span className={`rp-status ${statusOf(best.s).cls}`}>{statusOf(best.s).label}</span>
                            <div style={{ fontSize: 11, color: '#667085', marginTop: 3 }}>
                              {best.s.pass} pass · {best.s.attention} attention
                              {best.s.warning > 0 ? ` · ${best.s.warning} warning` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="rp-status is-none">Not run</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{last ? fmtShort(last.runAt) : '—'}</td>
                      <td>
                        <button type="button" className="ws-linkish" onClick={() => go({ name: 'readiness', id: p.id })}>
                          Open readiness
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analysed.length === 0 && data.projects.length > 0 && (
        <p style={{ marginTop: '0.75rem', fontSize: 12.5, color: '#667085' }}>
          No analyzed manuscripts yet. Run an analysis first; readiness checks run against the journals it returns.
        </p>
      )}
    </div>
  )
}
