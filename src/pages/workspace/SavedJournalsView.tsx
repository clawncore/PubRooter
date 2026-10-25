import { useWorkspace } from '../../workspace/WorkspaceContext'
import { toCsv, downloadFile } from '../../workspace/reports'

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

export function SavedJournalsView() {
  const { data, update, log } = useWorkspace()
  if (!data) return null

  async function remove(id: string, title: string) {
    await update((ws) => ({ ...ws, savedJournals: ws.savedJournals.filter((s) => s.id !== id) }))
    log('save', `Removed "${title}" from saved journals.`)
  }

  async function setNote(id: string, note: string) {
    await update((ws) => ({ ...ws, savedJournals: ws.savedJournals.map((s) => (s.id === id ? { ...s, note } : s)) }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 className="ws-h1">Saved Journals</h1>
          <p className="ws-sub">Venues you shortlisted, with the score and identifiers recorded at save time.</p>
        </div>
        {data.savedJournals.length > 0 && (
          <button
            type="button"
            className="ws-btn ws-btn-ghost"
            onClick={() =>
              downloadFile(
                'pubrooter_saved_journals.csv',
                'text/csv',
                toCsv(
                  ['Journal', 'Publisher', 'ISSN', 'Relevance at save', 'Link', 'Saved', 'Note'],
                  data.savedJournals.map((s) => [s.title, s.publisher ?? '', s.issn ?? '', s.score ?? '', s.link ?? '', s.savedAt, s.note ?? ''])
                )
              )
            }
          >
            Export CSV
          </button>
        )}
      </div>

      {data.savedJournals.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>Nothing saved yet</strong>
          Save journals from analysis results or the public Journal Finder — they will appear here.
        </div>
      ) : (
        <div className="ws-card" style={{ padding: '0 1.25rem' }}>
          <div className="ws-table-scroll">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Journal</th>
                <th>Publisher</th>
                <th>ISSN</th>
                <th>Score</th>
                <th>Saved</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.savedJournals.map((s) => (
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
                  <td>{s.issn ?? '—'}</td>
                  <td>{s.score ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(s.savedAt)}</td>
                  <td>
                    <input
                      defaultValue={s.note ?? ''}
                      onBlur={(e) => void setNote(s.id, e.target.value)}
                      placeholder="Add note…"
                      aria-label={`Note for ${s.title}`}
                      style={{ font: 'inherit', fontSize: 12, padding: '0.3rem 0.45rem', border: '1px solid #dcdcdc', borderRadius: 3, width: '100%', minWidth: 120 }}
                    />
                  </td>
                  <td>
                    <button type="button" className="ws-linkish" style={{ color: '#af1d1d' }} onClick={() => void remove(s.id, s.title)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <p style={{ fontSize: 11.5, color: '#666', marginTop: '0.75rem' }}>
        Saved notes and scores are snapshots at save time — journal metadata changes on the source side, so re-run an
        analysis for fresh figures.
      </p>
    </div>
  )
}
