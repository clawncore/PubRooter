import { useWorkspace } from '../../workspace/WorkspaceContext'
import { deleteFile } from '../../workspace/storage'
import type { WorkspaceView } from './WorkspaceApp'

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

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

export function ManuscriptsView({ go }: { go: (v: WorkspaceView) => void }) {
  const { data, update, log, mode } = useWorkspace()
  if (!data) return null

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}" and its stored PDF? Reports already exported stay on your device.`)) return
    const project = data!.projects.find((p) => p.id === id)
    if (project?.hasStoredFile) await deleteFile(id).catch(() => undefined)
    await update((ws) => ({ ...ws, projects: ws.projects.filter((p) => p.id !== id) }))
    log('project', `Deleted manuscript project "${name}".`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="ws-h1">My Manuscripts</h1>
          <p className="ws-sub">Every upload becomes a persistent project: file, extracted details, analysis, audits, and exports.</p>
        </div>
        <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
          New manuscript
        </button>
      </div>

      {data.projects.length === 0 ? (
        <div className="ws-card ws-empty">
          <strong>No manuscripts yet</strong>
          {mode === 'cloud'
            ? 'Start with a PDF upload. Files are stored in your private storage bucket. Readable only by your account.'
            : 'Start with a PDF upload. Files are stored privately in this browser and never sent anywhere. There are none.'}
        </div>
      ) : (
        <div className="ws-card" style={{ padding: '0 1.25rem' }}>
          <div className="ws-table-scroll">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>File</th>
                <th>Updated</th>
                <th>Status</th>
                <th>Recommendations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                      {p.name}
                    </button>
                    {(p.edited?.keywords ?? p.extracted?.keywords ?? []).length > 0 && (
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {(p.edited?.keywords ?? p.extracted?.keywords)!.slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: '#666' }}>{p.fileName ?? 'N/A'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(p.updatedAt)}</td>
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
                  <td>{p.analysis?.matches.length ?? 0}</td>
                  <td>
                    <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })} style={{ marginRight: 10 }}>
                      {p.status === 'completed' ? 'Open' : p.status === 'failed' ? 'Retry' : 'Continue'}
                    </button>
                    <button type="button" className="ws-linkish" style={{ color: '#af1d1d' }} onClick={() => void remove(p.id, p.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
