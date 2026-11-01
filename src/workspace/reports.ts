import type { JournalMatch } from '../types'
import type { ManuscriptProject, ReadinessAudit } from './types'
import { auditSummary } from './readiness'

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
}

export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function recommendationsCsv(project: ManuscriptProject): string {
  const matches = project.analysis?.matches ?? []
  const tierOf = (id: string): string => {
    const t = project.analysis?.tiers
    if (!t) return ''
    if (t.tier1.includes(id)) return 'Tier 1: Strongest fit'
    if (t.tier2.includes(id)) return 'Tier 2: Alternative fit'
    if (t.tier3.includes(id)) return 'Tier 3: Broader option'
    return 'Not tiered'
  }
  const headers = ['Journal', 'Publisher', 'ISSN', 'Fit tier', 'Relevance score (0-100)', 'Open access', 'APC (USD)', 'Why it matches', 'Known limitations', 'Source', 'Source URL', 'Last verified']
  const rows = matches.map((m: JournalMatch) => [
    m.journal.title,
    m.journal.publisher ?? '',
    m.journal.issn ?? '',
    tierOf(m.journal.id),
    m.score,
    m.journal.isOpenAccess ? 'Yes' : m.journal.isOpenAccess === false ? 'No' : 'Unknown',
    m.journal.apcUsd ?? '',
    m.evidence.map((e) => `${e.field}: ${e.detail}`).join(' | '),
    m.limitations.join(' | '),
    m.journal.source,
    m.journal.sourceUrl ?? '',
    project.analysis?.ranAt ?? ''
  ])
  return toCsv(headers, rows)
}

export function readinessCsv(audit: ReadinessAudit): string {
  const headers = ['Check', 'Status', 'Explanation', 'Evidence', 'Source URL', 'Engine version', 'Run at']
  const rows = audit.checks.map((c) => [c.label, c.status, c.explanation, c.evidence ?? '', c.sourceUrl ?? '', audit.engineVersion, audit.runAt])
  return toCsv(headers, rows)
}

export function comparisonCsv(projects: ManuscriptProject[], matches: JournalMatch[]): string {
  const headers = ['Attribute', ...matches.map((m) => m.journal.title)]
  const rows: unknown[][] = [
    ['Publisher', ...matches.map((m) => m.journal.publisher ?? 'Unknown')],
    ['ISSN', ...matches.map((m) => m.journal.issn ?? 'Unknown')],
    ['Open access', ...matches.map((m) => (m.journal.isOpenAccess ? 'Yes' : m.journal.isOpenAccess === false ? 'No' : 'Unknown'))],
    ['APC (USD)', ...matches.map((m) => m.journal.apcUsd ?? 'Unknown')],
    ['Relevance score', ...matches.map((m) => m.score)],
    ['Documents indexed', ...matches.map((m) => m.journal.worksCount ?? 'Unknown')],
    ['2-yr mean citedness', ...matches.map((m) => m.journal.citedness ?? 'Unknown')],
    ['4-yr mean citedness', ...matches.map((m) => m.journal.citedness4 ?? 'Unknown')],
    ['Evidence', ...matches.map((m) => m.evidence.map((e) => e.detail).join(' | '))],
    ['Limitations', ...matches.map((m) => m.limitations.join(' | '))]
  ]
  void projects
  return toCsv(headers, rows)
}

export function printReport(project: ManuscriptProject, audit?: ReadinessAudit): void {
  const matches = project.analysis?.matches ?? []
  const ed = project.edited ?? project.extracted
  const tierLabel = (id: string) => {
    const t = project.analysis?.tiers
    if (t?.tier1.includes(id)) return 'Tier 1'
    if (t?.tier2.includes(id)) return 'Tier 2'
    if (t?.tier3.includes(id)) return 'Tier 3'
    return 'N/A'
  }
  const summary = audit ? auditSummary(audit) : null
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>PubRooter report: ${escapeHtml(project.name)}</title>
  <style>
    body{font-family:Georgia,serif;color:#0c0f12;margin:2.5rem;line-height:1.5}
    h1{font-size:1.6rem;border-bottom:2px solid #0056d6;padding-bottom:.5rem}
    h2{font-size:1.15rem;margin-top:1.8rem}
    table{border-collapse:collapse;width:100%;font-size:.82rem;margin-top:.6rem}
    th,td{border:1px solid #ccc;padding:.4rem .5rem;text-align:left;vertical-align:top}
    th{background:#f2f2f2}
    .meta{color:#555;font-size:.85rem}
    .badge{display:inline-block;padding:.1rem .45rem;border:1px solid #0056d6;color:#0056d6;border-radius:2px;font-size:.7rem;margin-right:.3rem}
    .foot{margin-top:2.5rem;font-size:.75rem;color:#666;border-top:1px solid #ddd;padding-top:.8rem}
  </style></head><body>
  <h1>PubRooter report - ${escapeHtml(project.name)}</h1>
  <p class="meta">Generated ${new Date().toISOString()} · Ranking engine ${project.analysis?.engineVersion ?? 'n/a'} · This report supports author review and does not guarantee editorial compliance or acceptance.</p>
  <h2>Manuscript</h2>
  <p><strong>Title:</strong> ${escapeHtml(ed?.title ?? '')}<br/>
  <strong>Keywords:</strong> ${escapeHtml((ed?.keywords ?? []).join(', ') || 'N/A')}<br/>
  <strong>Words extracted:</strong> ${ed?.wordCount ?? 0} · <strong>Pages:</strong> ${ed?.pageCount ?? 0}</p>
  <h2>Journal recommendations (${matches.length})</h2>
  <table><tr><th>Journal</th><th>Tier</th><th>Score</th><th>Why it matches</th><th>Limitations</th></tr>
  ${matches
    .slice(0, 25)
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.journal.title)}<br/><span class="meta">${escapeHtml(m.journal.publisher ?? '')}</span></td><td>${tierLabel(m.journal.id)}</td><td>${m.score}</td><td>${escapeHtml(m.evidence.map((e) => e.detail).join('; '))}</td><td>${escapeHtml(m.limitations.join('; '))}</td></tr>`
    )
    .join('')}
  </table>
  ${
    audit && summary
      ? `<h2>Readiness: ${escapeHtml(audit.journalTitle)}</h2>
  <p class="meta">Engine ${audit.engineVersion} · Run ${audit.runAt} · Pass ${summary.pass} · Needs attention ${summary.attention} · Warning ${summary.warning} · Unknown ${summary.unknown}</p>
  <table><tr><th>Check</th><th>Status</th><th>Explanation</th></tr>
  ${audit.checks.map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${c.status}</td><td>${escapeHtml(c.explanation)}</td></tr>`).join('')}
  </table>`
      : ''
  }
  <p class="foot">Data sources: OpenAlex and Crossref live metadata at analysis time. Impact / citation figures shown elsewhere in the app are open-data proxies, not licensed Clarivate or Scopus values. PubRooter does not handle journal submission.</p>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
