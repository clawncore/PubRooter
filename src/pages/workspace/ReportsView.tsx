import { useWorkspace } from '../../workspace/WorkspaceContext'
import { recommendationsCsv, readinessCsv, downloadFile, printReport } from '../../workspace/reports'
import type { WorkspaceView } from './WorkspaceApp'

export function ReportsView({ go }: { go: (v: WorkspaceView) => void }) {
  const { data, log } = useWorkspace()
  if (!data) return null
  const done = data.projects.filter((p) => p.status === 'completed')

  if (done.length === 0) {
    return (
      <div>
        <h1 className="ws-h1">Reports and Exports</h1>
        <p className="ws-sub">CSV files for spreadsheets and print-ready reports for PDF saving.</p>
        <div className="ws-card ws-empty" style={{ marginTop: '1rem' }}>
          <strong>No reports available yet</strong>
          Exports unlock once a manuscript analysis completes.
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => go({ name: 'new' })}>
              Analyze a Manuscript
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="ws-h1">Reports and Exports</h1>
      <p className="ws-sub">
        CSV files for spreadsheets and print-ready reports for PDF saving. Exports contain journal metadata and
        checklist results. Never your full manuscript text.
      </p>

      <div className="ws-card" style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
        <div className="ws-table-scroll">
        <table className="ws-table">
          <thead>
            <tr>
              <th>Manuscript</th>
              <th>Recommendations</th>
              <th>Audits</th>
              <th>Exports</th>
            </tr>
          </thead>
          <tbody>
            {done.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className="ws-linkish" onClick={() => go({ name: 'project', id: p.id })}>
                    {p.name}
                  </button>
                </td>
                <td>{p.analysis?.matches.length ?? 0}</td>
                <td>{p.audits.length}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ws-btn ws-btn-ghost"
                      onClick={() => {
                        downloadFile(`${p.name.replace(/[^\w-]+/g, '_')}_recommendations.csv`, 'text/csv', recommendationsCsv(p))
                        log('report', `Exported recommendations CSV for "${p.name}".`, p.id)
                      }}
                    >
                      Recommendations CSV
                    </button>
                    {p.audits[0] && (
                      <button
                        type="button"
                        className="ws-btn ws-btn-ghost"
                        onClick={() => {
                          downloadFile(`${p.name.replace(/[^\w-]+/g, '_')}_readiness.csv`, 'text/csv', readinessCsv(p.audits[0]!))
                          log('report', `Exported readiness CSV for "${p.name}".`, p.id)
                        }}
                      >
                        Readiness CSV
                      </button>
                    )}
                    <button
                      type="button"
                      className="ws-btn ws-btn-ghost"
                      onClick={() => printReport(p, p.audits[0] ?? undefined)}
                    >
                      Print / PDF report
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <h2 className="ws-h2">Workspace export</h2>
      <div className="ws-card">
        <p style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
          Download all projects, saved journals, and activity as JSON for backup or migration.
        </p>
        <button
          type="button"
          className="ws-btn ws-btn-outline"
          onClick={() => {
            downloadFile('pubrooter_workspace.json', 'application/json', JSON.stringify({ version: data.version, exportedAt: new Date().toISOString(), projects: data.projects, activity: data.activity }, null, 2))
            log('report', 'Exported full workspace JSON.')
          }}
        >
          Export workspace JSON
        </button>
        <p style={{ fontSize: 11.5, color: '#666', marginBottom: 0 }}>
          Comparison exports are available from an analysis page once two or more journals are selected. Treat exports
          as confidential. They reference unpublished work.
        </p>
      </div>
    </div>
  )
}
