import type { CheckStatus, ReadinessAudit, ReadinessCheck } from '../../workspace/types'
import { auditSummary } from '../../workspace/readiness'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'pass',
  attention: 'needs attention',
  warning: 'warning',
  unknown: 'unknown',
  'not-checked': 'not checked'
}

// Actionable items first, then what passed, then what could not be verified.
const GROUPS: { key: string; title: string; note: string; statuses: CheckStatus[] }[] = [
  {
    key: 'attention',
    title: 'Needs attention',
    note: 'Fix or explicitly confirm these before submitting.',
    statuses: ['attention', 'warning']
  },
  {
    key: 'pass',
    title: 'Passed',
    note: 'Detected in the extracted manuscript text.',
    statuses: ['pass']
  },
  {
    key: 'unknown',
    title: 'Unknown',
    note: 'Could not be verified from the extracted text. Never counted as passed.',
    statuses: ['unknown', 'not-checked']
  }
]

function groupChecks(checks: ReadinessCheck[], statuses: CheckStatus[]): ReadinessCheck[] {
  return checks.filter((c) => statuses.includes(c.status))
}

export function ReadinessChecks({
  audit,
  onResolve,
  compact
}: {
  audit: ReadinessAudit
  onResolve?: (checkId: string) => void
  compact?: boolean
}) {
  const s = auditSummary(audit)
  const total = audit.checks.length || 1
  const tiles = [
    { key: 'pass', label: 'Pass', value: s.pass },
    { key: 'attention', label: 'Needs attention', value: s.attention },
    { key: 'warning', label: 'Warning', value: s.warning },
    { key: 'unknown', label: 'Unknown', value: s.unknown + s['not-checked'] }
  ]

  return (
    <div className="ws-rd">
      {/* Summary: stat tiles + segmented bar */}
      {!compact && (
        <div className="ws-rd-tiles">
          {tiles.map((t) => (
            <div key={t.key} className={`ws-rd-tile is-${t.key}`}>
              <b>{t.value}</b>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="ws-readiness-bar" role="img" aria-label={`${s.pass} pass, ${s.attention} need attention, ${s.warning} warning, ${s.unknown} unknown`}>
        <div className="ws-readiness-bar-seg pass" style={{ width: `${(s.pass / total) * 100}%` }} />
        <div className="ws-readiness-bar-seg attention" style={{ width: `${(s.attention / total) * 100}%` }} />
        <div className="ws-readiness-bar-seg warning" style={{ width: `${(s.warning / total) * 100}%` }} />
        <div className="ws-readiness-bar-seg unknown" style={{ width: `${((s.unknown + s['not-checked']) / total) * 100}%` }} />
      </div>
      {!compact && (
        <p className="ws-rd-meta">
          Latest audit: <strong>{audit.journalTitle}</strong> · {fmt(audit.runAt)} · engine {audit.engineVersion} ·{' '}
          {audit.checks.length} checks
        </p>
      )}

      {/* Checks grouped by status */}
      {GROUPS.map((g) => {
        const list = groupChecks(audit.checks, g.statuses)
        if (list.length === 0) return null
        return (
          <section key={g.key} className={`ws-rd-group is-${g.key}`}>
            <div className="ws-rd-group-head">
              <h4>{g.title}</h4>
              <span className="ws-rd-group-count">{list.length}</span>
              <p>{g.note}</p>
            </div>
            <div className="ws-checks">
              {list.map((c) => (
                <div key={c.id} className={`ws-rd-check is-${c.status}`}>
                  <div className="ws-rd-check-top">
                    <span className={`ws-badge ws-badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                    <div className="ws-check-label">{c.label}</div>
                    {onResolve && (c.status === 'attention' || c.status === 'warning') && (
                      <button type="button" className="ws-linkish ws-rd-resolve" onClick={() => onResolve(c.id)}>
                        Mark as resolved
                      </button>
                    )}
                  </div>
                  <div className="ws-rd-check-body">
                    <div className="ws-check-exp">{c.explanation}</div>
                    {c.evidence && <div className="ws-check-evidence">Evidence: {c.evidence}</div>}
                    {c.sourceUrl && (
                      <a className="ws-check-evidence" href={c.sourceUrl} target="_blank" rel="noreferrer">
                        Source: {c.sourceUrl} ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}