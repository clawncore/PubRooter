export interface ProcessStage {
  label: string
  detail: string
  status: 'done' | 'active' | 'pending'
}

interface Props {
  percent: number
  stages: ProcessStage[]
}

export function FinderProcess({ percent, stages }: Props) {
  return (
    <div className="lp-container jf-process-wrap">
      <section className="jf-process" aria-label="Searching journals">
        <p className="jf-process-kicker">Journal Finder</p>
        <h1 className="jf-process-h1">Finding journals for your paper</h1>
        <p className="jf-process-sub">
          Querying live scholarly indexes, matching scopes, and scoring evidence. Nothing is cached or guessed.
        </p>

        <div className="jf-bar-block">
          <div
            className="jf-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Search progress"
          >
            <span className="jf-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="jf-percent" aria-hidden="true">
            {percent}
            <small>%</small>
          </span>
        </div>

        <ol className="jf-stages">
          {stages.map((s) => (
            <li key={s.label} className={`jf-stage jf-stage-${s.status}`}>
              <span className="jf-stage-mark" aria-hidden="true">
                {s.status === 'done' ? (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <i />
                )}
              </span>
              <span className="jf-stage-text">
                <span className="jf-stage-label">{s.label}</span>
                <span className="jf-stage-detail">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="jf-process-covers" aria-hidden="true">
          <span className="jf-process-cover" />
          <span className="jf-process-cover" />
          <span className="jf-process-cover" />
        </div>
      </section>
    </div>
  )
}
