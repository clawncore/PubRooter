import { useMemo, useState } from 'react'
import type { View } from '../types-nav'
import type { JournalMatch } from '../types'
import { JournalCover } from '../components/JournalCover'

interface Props {
  matches: JournalMatch[]
  apiNotice: string
  onNewSearch: (tab?: 'abstract' | 'search') => void
}

const SAVED_KEY = 'pubrooter.savedJournals.v1'
type SortKey = 'best' | 'title' | 'if' | 'cs' | 'docs'

export function InfoDot({ text }: { text: string }) {
  return (
    <span className="jf-idot" title={text} aria-label={text}>
      i
    </span>
  )
}

function loadSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function persistSaved(ids: string[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids))
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2h8v12l-4-3-4 3V2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function Hist({ values, max, bins = 24 }: { values: number[]; max: number; bins?: number }) {
  const counts = new Array<number>(bins).fill(0)
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((Math.min(v, max) / max) * bins)))
    counts[idx] = (counts[idx] ?? 0) + 1
  }
  const peak = Math.max(1, ...counts)
  return (
    <span className="jf-hist" aria-hidden="true">
      {counts.map((c, i) => (
        <i key={i} style={{ height: `${Math.max(c === 0 ? 0 : 2, (c / peak) * 100)}%` }} />
      ))}
    </span>
  )
}

function RangeFilter({
  label,
  info,
  values,
  range,
  onRange,
  max,
  suffix = '+',
  disabled
}: {
  label: string
  info: string
  values: number[]
  range: [number, number]
  onRange?: (r: [number, number]) => void
  max: number
  suffix?: string
  disabled?: boolean
}) {
  const [lo, hi] = range
  const display = lo === 0 && hi >= max ? 'All journals' : `${lo} – ${hi >= max ? `${max}${suffix}` : hi}`
  function set(which: 'lo' | 'hi', v: number) {
    if (!onRange) return
    if (which === 'lo') onRange([Math.min(v, hi), hi])
    else onRange([lo, Math.max(v, lo)])
  }
  return (
    <fieldset className={`jf-filter-group ${disabled ? 'jf-filter-disabled' : ''}`}>
      <legend>
        {label}
        <InfoDot text={info} />
      </legend>
      <div className="jf-range-label">{display}</div>
      <Hist values={values} max={max} />
      <div className="jf-range">
        <input
          type="range"
          min={0}
          max={max}
          value={lo}
          disabled={disabled}
          aria-label={`${label} minimum`}
          onChange={(e) => set('lo', Number(e.target.value))}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={hi}
          disabled={disabled}
          aria-label={`${label} maximum`}
          onChange={(e) => set('hi', Number(e.target.value))}
        />
        <span className="jf-range-fill" style={{ left: `${(lo / max) * 100}%`, right: `${100 - (hi / max) * 100}%` }} />
      </div>
      <div className="jf-range-ends">
        <span>0</span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </fieldset>
  )
}

export function FinderResults({ matches, apiNotice, onNewSearch }: Props) {
  const [sort, setSort] = useState<SortKey>('best')
  const [showOA, setShowOA] = useState(true)
  const [showSub, setShowSub] = useState(true)
  const [ifRange, setIfRange] = useState<[number, number]>([0, 10])
  const [csRange, setCsRange] = useState<[number, number]>([0, 10])
  const [saved, setSaved] = useState<string[]>(() => loadSaved())

  const ifValues = useMemo(() => matches.map((m) => m.journal.citedness ?? 0), [matches])
  const csValues = useMemo(() => matches.map((m) => m.journal.citedness4 ?? m.journal.citedness ?? 0), [matches])

  const visible = useMemo(() => {
    const inRange = (v: number | undefined, [lo, hi]: [number, number], cap: number) => {
      const n = v ?? 0
      if (n < lo) return false
      if (hi < cap && n > hi) return false
      return true
    }
    let list = matches.filter((m) => {
      const isOA = !!m.journal.isOpenAccess
      if (isOA && !showOA) return false
      if (!isOA && !showSub) return false
      if (!inRange(m.journal.citedness, ifRange, 10)) return false
      if (!inRange(m.journal.citedness4 ?? m.journal.citedness, csRange, 10)) return false
      return true
    })
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.journal.title.localeCompare(b.journal.title))
    else if (sort === 'if') list.sort((a, b) => (b.journal.citedness ?? -1) - (a.journal.citedness ?? -1))
    else if (sort === 'cs')
      list.sort((a, b) => (b.journal.citedness4 ?? b.journal.citedness ?? -1) - (a.journal.citedness4 ?? a.journal.citedness ?? -1))
    else if (sort === 'docs') list.sort((a, b) => (b.journal.worksCount ?? 0) - (a.journal.worksCount ?? 0))
    else list.sort((a, b) => b.score - a.score)
    return list
  }, [matches, showOA, showSub, ifRange, csRange, sort])

  function toggleSave(id: string) {
    const next = saved.includes(id) ? saved.filter((s) => s !== id) : [...saved, id]
    setSaved(next)
    persistSaved(next)
  }

  function clearFilters() {
    setShowOA(true)
    setShowSub(true)
    setIfRange([0, 10])
    setCsRange([0, 10])
    setSort('best')
  }

  return (
    <div className="lp-container jf-results-wrap">
      <div className="jf-results-head">
        <h2>
          Showing <strong>{visible.length}</strong> journals matching your paper
        </h2>
        <div className="jf-results-tools">
          <button type="button" className="jf-newsearch" onClick={() => onNewSearch()}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M10 6H3M5.5 3.5L3 6l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            New search
          </button>
          <label className="jf-sort">
            Sort by:
            <span className="jf-sort-box">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort results">
                <option value="best">Best match</option>
                <option value="title">Title A–Z</option>
                <option value="if">Impact factor</option>
                <option value="cs">CiteScore</option>
                <option value="docs">Documents</option>
              </select>
              <svg className="jf-sort-chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </label>
        </div>
      </div>

      {apiNotice && (
        <p className="jf-notice" role="status">
          {apiNotice}
        </p>
      )}

      <div className="jf-results-layout">
        <aside className="jf-filters" aria-label="Refine results">
          <fieldset className="jf-filter-group jf-filter-group-first">
            <legend>
              Publication type
              <InfoDot text="An article can either be published gold open access (a publication fee may be required) or with subscription (an embargo period may apply)." />
            </legend>
            <label className="jf-toggle-row">
              <button
                type="button"
                role="switch"
                aria-checked={showOA}
                className={showOA ? 'jf-toggle jf-toggle-oa on' : 'jf-toggle jf-toggle-oa'}
                onClick={() => setShowOA((v) => !v)}
              >
                <span className="jf-toggle-knob">OA</span>
              </button>
              <span>Journals that offer OA</span>
            </label>
            <label className="jf-toggle-row">
              <button
                type="button"
                role="switch"
                aria-checked={showSub}
                className={showOA && showSub ? 'jf-toggle jf-toggle-sub on' : 'jf-toggle jf-toggle-sub'}
                onClick={() => setShowSub((v) => !v)}
              >
                <span className="jf-toggle-knob">S</span>
              </button>
              <span>Journals with subscription</span>
            </label>
          </fieldset>

          <RangeFilter
            label="Impact factor"
            info="OpenAlex 2-year mean citations per document — the same two-year window as Clarivate's Impact Factor, shown from open data."
            values={ifValues}
            range={ifRange}
            onRange={setIfRange}
            max={10}
          />

          <RangeFilter
            label="CiteScore"
            info="OpenAlex 4-year mean citations per document — the same four-year window as Scopus CiteScore, shown from open data."
            values={csValues}
            range={csRange}
            onRange={setCsRange}
            max={10}
          />

          <RangeFilter
            label="Time to 1st decision"
            info="Time from manuscript submission to the initial decision, in days. Not available for open multi-publisher data — check each journal's guide for authors."
            values={[]}
            range={[0, 365]}
            max={365}
            disabled
          />

          <RangeFilter
            label="Time to acceptance"
            info="Time from 1st decision to acceptance, in days. Not available for open multi-publisher data — verify with the journal directly."
            values={[]}
            range={[0, 365]}
            max={365}
            disabled
          />

          <button type="button" className="jf-clear jf-clear-bottom" onClick={clearFilters}>
            Clear filters
          </button>
        </aside>

        <section className="jf-list" aria-label="Journal results">
          {visible.length === 0 && (
            <div className="jf-empty">
              <p className="jf-empty-title">No matching journals found</p>
              <p>Please refine your search words and try again.</p>
              <p>
                Or use{' '}
                <button type="button" className="lp-link" onClick={() => onNewSearch('abstract')}>
                  'Match my abstract'
                </button>{' '}
                for search.
              </p>
            </div>
          )}

          {visible.map((m, idx) => {
            const j = m.journal
            const isSaved = saved.includes(j.id)
            const link = j.homepageUrl || (j.sourceUrl?.startsWith('http') ? j.sourceUrl : undefined)
            const oa = !!j.isOpenAccess
            return (
              <article key={j.id} className="jf-journal">
                <JournalCover title={j.title} />

                <div className="jf-journal-main">
                  <div className="jf-journal-title-row">
                    <div>
                      <h3>{j.title}</h3>
                      <button
                        type="button"
                        className={isSaved ? 'jf-save saved' : 'jf-save'}
                        onClick={() => toggleSave(j.id)}
                        aria-pressed={isSaved}
                      >
                        <BookmarkIcon />
                        {isSaved ? 'Saved' : 'Save journal'}
                      </button>
                    </div>
                    <div className="jf-journal-ctas">
                      <a className="jf-visit" href={link ?? j.sourceUrl ?? '#'} target="_blank" rel="noreferrer">
                        Visit journal page
                      </a>
                      <a
                        className="jf-submit"
                        href={link ?? j.sourceUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        title="PubRooter does not handle submission — you continue on the journal's own site"
                      >
                        Submit paper
                      </a>
                    </div>
                  </div>

                  <div className="jf-metrics">
                    <span className="jf-metric">
                      <span className="jf-metric-label">
                        Impact Factor
                        <InfoDot text="2-year mean citedness (OpenAlex) — same window as Clarivate's Impact Factor." />
                      </span>
                      <span className="jf-metric-value">{typeof j.citedness === 'number' ? j.citedness.toFixed(1) : '—'}</span>
                    </span>
                    <span className="jf-metric">
                      <span className="jf-metric-label">
                        CiteScore
                        <InfoDot text="4-year mean citedness (OpenAlex) — same window as Scopus CiteScore." />
                      </span>
                      <span className="jf-metric-value">{typeof j.citedness4 === 'number' ? j.citedness4.toFixed(1) : '—'}</span>
                    </span>
                    <span className="jf-metric">
                      <span className="jf-metric-label">
                        Submission to first decision
                        <InfoDot text="Not available for open multi-publisher data." />
                      </span>
                      <span className="jf-metric-value">—</span>
                    </span>
                    <span className="jf-metric">
                      <span className="jf-metric-label">
                        Acceptance to publication
                        <InfoDot text="Not available for open multi-publisher data." />
                      </span>
                      <span className="jf-metric-value">—</span>
                    </span>
                  </div>

                  <div className="jf-oa-block">
                    {oa ? (
                      <>
                        <span className="jf-oa-badge">Open access</span>
                        {typeof j.apcUsd === 'number' && (
                          <p className="jf-apc-line">
                            <strong>US${j.apcUsd.toLocaleString()}</strong>{' '}
                            <span>Article Publishing Charge (APC), excl. taxes</span>
                          </p>
                        )}
                        <p className="jf-oa-note-line">Your article will be made publicly available upon publication.</p>
                        {link && (
                          <a className="jf-outer-link" href={link} target="_blank" rel="noreferrer">
                            About publishing options ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="jf-oa-badge jf-oa-badge-sub">Subscription</span>
                        <p className="jf-oa-note-line">
                          This journal is not listed as open access — subscription or hybrid terms apply. Check
                          publishing options on the journal's site.
                        </p>
                        {link && (
                          <a className="jf-outer-link" href={link} target="_blank" rel="noreferrer">
                            About publishing options ↗
                          </a>
                        )}
                      </>
                    )}
                  </div>

                  <details className="jf-more">
                    <summary>
                      More about this journal
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </summary>
                    <div className="jf-more-body">
                      <p className="jf-more-score">
                        Match score <strong>{m.score}</strong> / 100 — rank {idx + 1} of {visible.length} shown
                      </p>
                      <ul>
                        {m.evidence.map((e, i) => (
                          <li key={`e${i}`}>
                            <strong>{e.field}</strong> (weight {e.weight}): {e.detail}
                          </li>
                        ))}
                        {m.limitations.map((l, i) => (
                          <li key={`l${i}`} className="jf-limitation">
                            {l}
                          </li>
                        ))}
                        <li>
                          <strong>Publisher:</strong> {j.publisher ?? 'Unknown'} · <strong>ISSN:</strong> {j.issn ?? '—'} ·{' '}
                          <strong>Documents:</strong> {j.worksCount?.toLocaleString() ?? '—'} · <strong>Source:</strong> {j.source}
                        </li>
                        {j.subjects.length > 0 && (
                          <li>
                            <strong>Subjects:</strong> {j.subjects.slice(0, 6).join('; ')}
                          </li>
                        )}
                      </ul>
                    </div>
                  </details>
                </div>
              </article>
            )
          })}
        </section>
      </div>

      <p className="sources-footnote">
        Impact Factor and CiteScore slots show OpenAlex mean-citedness figures with matching 2-year and 4-year windows —
        Clarivate and Scopus values require licences we don't hold, so we never fabricate them. Time to decision metrics
        are not available in open data. PubRooter does not handle submission: "Submit paper" routes you to the
        journal's own site.
      </p>
    </div>
  )
}

export function ResultsBreadcrumb({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <nav className="sc-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={() => onNavigate('home')}>
        Home
      </button>
      <span aria-hidden="true">›</span>
      <button type="button" onClick={() => onNavigate('finder')}>
        Journal Finder
      </button>
      <span aria-hidden="true">›</span>
      <span aria-current="page">Results</span>
    </nav>
  )
}
