import { useWorkspace } from '../workspace/WorkspaceContext'
import { comparisonCsv, downloadFile } from '../workspace/reports'
import { journalSiteUrl } from '../workspace/journal-url'
import type { ManuscriptProject } from '../workspace/types'
import type { JournalMatch } from '../types'
import './compare-portal.css'

interface Props {
  project: ManuscriptProject
  onNavigate: (view: string, draft?: any) => void
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ComparePortal({ project, onNavigate }: Props) {
  const { log } = useWorkspace()
  const matches: JournalMatch[] = (project.analysis?.matches ?? []).filter((m) =>
    project.comparedJournalIds.includes(m.journal.id)
  )

  if (matches.length < 2) {
    return (
      <div className="cp">
        <header className="cp-top">
          <span className="cp-brand">PubRooter <span className="sep">/</span> <span className="muted">Journal comparison</span></span>
          <button type="button" className="cp-back" onClick={() => onNavigate('tool')}>
            ← Back to workspace
          </button>
        </header>
        <main className="cp-main">
          <h1>Nothing to compare yet</h1>
          <p className="cp-sub">
            Select at least two journals with the Compare button in Journal recommendations, then open the
            comparison from here.
          </p>
          <button type="button" className="cp-btn cp-btn-primary" onClick={() => onNavigate('tool')}>
            Back to workspace
          </button>
        </main>
      </div>
    )
  }

  const exportCsv = () => {
    downloadFile(
      `${project.name.replace(/[^\w-]+/g, '_')}_comparison.csv`,
      'text/csv',
      comparisonCsv([project], matches)
    )
    log('report', `Exported comparison CSV for "${project.name}".`, project.id)
  }

  return (
    <div className="cp">
      <header className="cp-top">
        <span className="cp-brand">PubRooter <span className="sep">/</span> <span className="muted">Journal comparison</span></span>
        <button type="button" className="cp-back" onClick={() => onNavigate('tool')}>
          ← Back to workspace
        </button>
      </header>

      <main className="cp-main">
        <div className="cp-hero">
          <div>
            <h1>Compare journals</h1>
            <p className="cp-sub">
              {project.name} · {matches.length} of 3 slots used · metrics side by side from open metadata
            </p>
          </div>
          <div className="cp-hero-actions">
            <button type="button" className="cp-btn cp-btn-primary" onClick={exportCsv}>
              Export comparison CSV
            </button>
            <button type="button" className="cp-btn" onClick={() => onNavigate('tool')}>
              Back to workspace
            </button>
          </div>
        </div>

        <section className="cp-section">
          <h2>At a glance</h2>
          <div className="cp-cards" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }}>
            {matches.map((m) => {
              const j = m.journal
              return (
                <article key={j.id} className="cp-card">
                  <div className="cp-card-head">
                    <span className="cp-avatar" aria-hidden="true">{initials(j.title) || 'NA'}</span>
                    <div>
                      <h3>{j.title}</h3>
                      <p>
                        {j.publisher ?? 'Publisher unknown'}
                        {j.issn ? ` · ISSN ${j.issn}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="cp-chips">
                    <span className="cp-chip cp-chip-score">Relevance {m.score}</span>
                    {j.isOpenAccess && <span className="cp-chip cp-chip-oa">Open access</span>}
                    {typeof j.apcUsd === 'number' && <span className="cp-chip">APC ~US${j.apcUsd.toLocaleString()}</span>}
                    {journalSiteUrl(j) && (
                      <a
                        className="cp-chip cp-chip-link"
                        href={journalSiteUrl(j)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official site ↗
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="cp-section">
          <h2>Metrics</h2>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  {matches.map((m) => (
                    <th key={m.journal.id}>{m.journal.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td>Publisher</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.publisher ?? 'Unknown'}</td>)}</tr>
                <tr><td>ISSN</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.issn ?? 'Unknown'}</td>)}</tr>
                <tr><td>Relevance score</td>{matches.map((m) => <td key={m.journal.id}><strong>{m.score}</strong> / 100</td>)}</tr>
                <tr><td>Open access</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.isOpenAccess ? 'Yes' : m.journal.isOpenAccess === false ? 'No' : 'Unknown'}</td>)}</tr>
                <tr><td>APC (USD)</td>{matches.map((m) => <td key={m.journal.id}>{typeof m.journal.apcUsd === 'number' ? `~US$${m.journal.apcUsd.toLocaleString()}` : 'Unknown'}</td>)}</tr>
                <tr><td>Documents indexed</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.worksCount?.toLocaleString() ?? 'Unknown'}</td>)}</tr>
                <tr><td>2-yr mean citedness</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.citedness?.toFixed(1) ?? 'Unknown'}</td>)}</tr>
                <tr><td>4-yr mean citedness</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.citedness4?.toFixed(1) ?? 'Unknown'}</td>)}</tr>
                <tr><td>Source</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.source === 'openalex' ? 'OpenAlex' : m.journal.source === 'crossref' ? 'Crossref' : 'Unknown'}</td>)}</tr>
                <tr><td>Subject areas</td>{matches.map((m) => <td key={m.journal.id}>{m.journal.subjects.length > 0 ? m.journal.subjects.slice(0, 5).join('; ') : 'Not available from source metadata.'}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="cp-section">
          <h2>Why each journal matches</h2>
          <div className="cp-cards" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }}>
            {matches.map((m) => (
              <article key={m.journal.id} className="cp-card">
                <h3 className="cp-card-title">{m.journal.title}</h3>
                {m.evidence.length > 0 ? (
                  <ul className="cp-list">
                    {m.evidence.map((e, i) => (
                      <li key={i}>
                        <span className="cp-list-label">{e.field}</span>
                        <span className="cp-list-weight">weight {e.weight}</span>
                        <span className="cp-list-detail">{e.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cp-note">No positive evidence found.</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="cp-section">
          <h2>Uncertainties and limitations</h2>
          <div className="cp-cards" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }}>
            {matches.map((m) => (
              <article key={m.journal.id} className="cp-card cp-card-warn">
                <h3 className="cp-card-title">{m.journal.title}</h3>
                {m.limitations.length > 0 ? (
                  <ul className="cp-list is-plain">
                    {m.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cp-note">No specific limitations recorded for this match.</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <p className="cp-footnote">
          Scores are keyword and metadata relevance, not acceptance probability. Verify APC, indexing, and
          requirements on each journal's official site before submitting. Fetched at analysis time from open
          metadata sources.
        </p>
      </main>
    </div>
  )
}
