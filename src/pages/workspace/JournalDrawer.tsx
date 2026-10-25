import { useEffect } from 'react'
import type { JournalMatch } from '../../types'
import { formatBytes } from '../../workspace/pdf'

interface Props {
  match: JournalMatch
  saved: boolean
  onSave: () => void
  onClose: () => void
  onCompare?: () => void
  compareActive?: boolean
  ranAt?: string
}

function fmt(iso?: string) {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function JournalDrawer({ match, saved, onSave, onClose, onCompare, compareActive, ranAt }: Props) {
  const j = match.journal
  const link = j.homepageUrl || (j.sourceUrl?.startsWith('http') ? j.sourceUrl : undefined)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
            <h2>{j.title}</h2>
            <p style={{ fontSize: 12.5, color: '#666', margin: '0.3rem 0 0' }}>{j.publisher ?? 'Publisher unknown'}</p>
          </div>
          <button type="button" className="ws-drawer-close" onClick={onClose}>
            Close ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <button type="button" className={`ws-btn ${saved ? 'ws-btn-outline' : 'ws-btn-primary'}`} onClick={onSave}>
            {saved ? 'Saved ✓' : 'Save journal'}
          </button>
          {onCompare && (
            <button type="button" className={`ws-btn ${compareActive ? 'ws-btn-outline' : 'ws-btn-ghost'}`} onClick={onCompare}>
              {compareActive ? 'In comparison ✓' : 'Add to comparison'}
            </button>
          )}
          {link && (
            <a className="ws-btn ws-btn-ghost" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              Official site ↗
            </a>
          )}
        </div>

        <dl className="ws-dl">
          <dt>Relevance score</dt>
          <dd>
            <strong>{match.score}</strong> / 100 — a keyword and metadata relevance score, not a probability of
            acceptance.
          </dd>

          <dt>Why it matches</dt>
          <dd>
            <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem' }}>
              {match.evidence.map((e, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <strong>{e.field}</strong> (weight {e.weight}): {e.detail}
                </li>
              ))}
              {match.evidence.length === 0 && <li>No positive evidence found.</li>}
            </ul>
          </dd>

          <dt>Uncertainties and mismatches</dt>
          <dd>
            <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem', color: '#666' }}>
              {match.limitations.map((l, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{l}</li>
              ))}
            </ul>
          </dd>

          <dt>Subject areas</dt>
          <dd>{j.subjects.length > 0 ? j.subjects.slice(0, 8).join('; ') : 'Not available from source metadata.'}</dd>

          <dt>Open access</dt>
          <dd>
            {j.isOpenAccess ? 'Listed as open access in OpenAlex' : j.isOpenAccess === false ? 'Not listed as open access' : 'Unknown'}
            {typeof j.apcUsd === 'number' ? ` · APC near US$${j.apcUsd.toLocaleString()} (verify before submission)` : ' · APC not available in open metadata'}
          </dd>

          <dt>Indexing</dt>
          <dd>
            No licensed indexing evidence is held by PubRooter. Appearing in OpenAlex or Crossref does{' '}
            <strong>not</strong> mean MEDLINE, PubMed, Scopus, or Web of Science indexing. Verify on the journal's
            site before claiming indexing anywhere.
          </dd>

          <dt>Article types supported</dt>
          <dd>Not verified — check the journal's guide for authors.</dd>

          <dt>Evidence sources</dt>
          <dd>
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
            <br />
            <span style={{ color: '#666' }}>Fetched at analysis time: {fmt(ranAt)}</span>
          </dd>

          <dt>Identifiers</dt>
          <dd>
            ISSN: {j.issn ?? 'Unknown'} · Documents indexed: {j.worksCount?.toLocaleString() ?? 'Unknown'} ·{' '}
            {j.citedness != null ? `2-yr mean citedness ${j.citedness.toFixed(1)}` : '2-yr citedness unknown'} ·{' '}
            {j.citedness4 != null ? `4-yr mean citedness ${j.citedness4.toFixed(1)}` : '4-yr citedness unknown'}
          </dd>

          {j.source === 'crossref' && (
            <>
              <dt>File note</dt>
              <dd>Crossref records carry less detail than OpenAlex — topics, APC, and OA flags may be missing.</dd>
            </>
          )}
        </dl>
      </aside>
    </div>
  )
}

export function fileMeta(size?: number | null) {
  return size ? formatBytes(size) : ''
}
