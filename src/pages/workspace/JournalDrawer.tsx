import { useEffect } from 'react'
import type { JournalMatch } from '../../types'
import { formatBytes } from '../../workspace/pdf'
import { journalSiteUrl } from '../../workspace/journal-url'

interface Props {
  match: JournalMatch
  onClose: () => void
  onCompare?: () => void
  compareActive?: boolean
  ranAt?: string
}

function fmt(iso?: string) {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function JournalDrawer({ match, onClose, onCompare, compareActive, ranAt }: Props) {
  const j = match.journal
  // Real journal website only. Never fall back to openalex.org records or
  // article DOI links, which are provenance, not the journal's site.
  const link = journalSiteUrl(j)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const evidence = match.evidence
  const limitations = match.limitations

  return (
    <div className="ws-drawer-back" onClick={onClose} role="presentation">
      <aside
        className="ws-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${j.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ws-drawer-head">
          <div>
            <p className="ws-drawer-kicker">Journal details</p>
            <h2>{j.title}</h2>
            <p className="ws-drawer-sub">{j.publisher ?? 'Publisher unknown'}</p>
          </div>
          <button type="button" className="ws-drawer-close" onClick={onClose}>
            Close ✕
          </button>
        </div>

        <div className="ws-drawer-actions">
          {onCompare && (
            <button type="button" className={`ws-btn ${compareActive ? 'ws-btn-outline' : 'ws-btn-ghost'}`} onClick={onCompare}>
              {compareActive ? 'In comparison ✓' : 'Add to comparison'}
            </button>
          )}
          {link && (
            <a className="ws-btn ws-btn-ghost" href={link} target="_blank" rel="noreferrer">
              Official site ↗
            </a>
          )}
        </div>

        <section className="ws-drawer-box">
          <h3>Relevance</h3>
          <div className="ws-drawer-score">
            <span className="ws-drawer-score-num">{match.score}</span>
            <span className="ws-drawer-score-den">/ 100</span>
          </div>
          <span className="ws-drawer-score-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, match.score))}%` }} />
          </span>
          <p className="ws-drawer-note">
            A keyword and metadata relevance score. It is not a probability of acceptance.
          </p>
        </section>

        <section className="ws-drawer-box">
          <h3>Why it matches</h3>
          {evidence.length > 0 ? (
            <ul className="ws-drawer-list">
              {evidence.map((e, i) => (
                <li key={i}>
                  <span className="ws-drawer-list-label">{e.field}</span>
                  <span className="ws-drawer-list-weight">weight {e.weight}</span>
                  <span className="ws-drawer-list-detail">{e.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ws-drawer-note">No positive evidence found.</p>
          )}
        </section>

        {limitations.length > 0 && (
          <section className="ws-drawer-box is-warn">
            <h3>Uncertainties and mismatches</h3>
            <ul className="ws-drawer-list is-plain">
              {limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="ws-drawer-box">
          <h3>Journal profile</h3>
          <dl className="ws-drawer-grid">
            <div>
              <dt>Subject areas</dt>
              <dd>{j.subjects.length > 0 ? j.subjects.slice(0, 8).join('; ') : 'Not available from source metadata.'}</dd>
            </div>
            <div>
              <dt>Open access</dt>
              <dd>
                {j.isOpenAccess ? 'Listed as open access' : j.isOpenAccess === false ? 'Not listed as open access' : 'Unknown'}
              </dd>
            </div>
            <div>
              <dt>APC</dt>
              <dd>
                {typeof j.apcUsd === 'number' ? `Near US$${j.apcUsd.toLocaleString()} (verify before submission)` : 'Not available in open metadata'}
              </dd>
            </div>
            <div>
              <dt>Article types</dt>
              <dd>Not verified. Check the journal's guide for authors.</dd>
            </div>
          </dl>
        </section>

        <section className="ws-drawer-box is-warn">
          <h3>Indexing</h3>
          <p className="ws-drawer-note">
            PubRooter holds no licensed indexing evidence. Appearing in OpenAlex or Crossref does{' '}
            <strong>not</strong> mean MEDLINE, PubMed, Scopus, or Web of Science indexing. Verify on the
            journal's site before claiming indexing anywhere.
          </p>
        </section>

        <section className="ws-drawer-box">
          <h3>Identifiers</h3>
          <dl className="ws-drawer-grid">
            <div>
              <dt>ISSN</dt>
              <dd>{j.issn ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>Documents indexed</dt>
              <dd>{j.worksCount?.toLocaleString() ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>2-yr mean citedness</dt>
              <dd>{j.citedness != null ? j.citedness.toFixed(1) : 'Unknown'}</dd>
            </div>
            <div>
              <dt>4-yr mean citedness</dt>
              <dd>{j.citedness4 != null ? j.citedness4.toFixed(1) : 'Unknown'}</dd>
            </div>
          </dl>
        </section>

        <section className="ws-drawer-box">
          <h3>Evidence sources</h3>
          <p className="ws-drawer-source">
            {j.source === 'openalex' && (
              <a href="https://openalex.org" target="_blank" rel="noreferrer">OpenAlex source record</a>
            )}
            {j.source === 'crossref' && <span>Crossref journal metadata</span>}
            {j.sourceUrl?.startsWith('http') && (
              <>
                {' · '}
                <a href={j.sourceUrl} target="_blank" rel="noreferrer">Source record ↗</a>
              </>
            )}
          </p>
          <p className="ws-drawer-note">Fetched at analysis time: {fmt(ranAt)}</p>
          {j.source === 'crossref' && (
            <p className="ws-drawer-note">
              Crossref records carry less detail than OpenAlex. Topics, APC, and open-access flags may be missing.
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

export function fileMeta(size?: number | null) {
  return size ? formatBytes(size) : ''
}
