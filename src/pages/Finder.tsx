import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { Draft, View } from '../types-nav'
import type { JournalCandidate, JournalMatch, Manuscript } from '../types'
import { searchOpenAlex } from '../api/openalex'
import { searchCrossref } from '../api/crossref'
import { rankJournals } from '../lib/matching'
import { uid } from '../lib/storage'
import { FinderProcess, type ProcessStage } from './FinderProcess'
import { FinderResults, InfoDot, ResultsBreadcrumb } from './FinderResults'

interface Props {
  onNavigate: (v: View, d?: Draft) => void
}

const MAX_ABSTRACT = 5000
const MIN_PROCESS_MS = 2300

type Tab = 'abstract' | 'search'
type Phase = 'form' | 'process' | 'results'

const STAGE_DEFS = [
  { label: 'Collecting data', detail: 'Querying OpenAlex and Crossref in parallel' },
  { label: 'Matching keywords', detail: 'Tokenizing your abstract and comparing journal scopes' },
  { label: 'Scoring evidence', detail: 'Weighting signals and recording limitations' },
  { label: 'Showing results', detail: 'Preparing your defensible shortlist' }
] as const

function stagesFor(percent: number): ProcessStage[] {
  return STAGE_DEFS.map((s, i) => {
    const start = i * 25
    const end = start + 25
    let status: ProcessStage['status'] = 'pending'
    if (percent >= end) status = 'done'
    else if (percent >= start) status = 'active'
    return { ...s, status }
  })
}

export function Finder({ onNavigate }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
  const [tab, setTab] = useState<Tab>('abstract')
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [formError, setFormError] = useState('')
  const [institution, setInstitution] = useState('')
  const [institutionNote, setInstitutionNote] = useState('')

  const [percent, setPercent] = useState(0)
  const [allMatches, setAllMatches] = useState<JournalMatch[]>([])
  const [apiNotice, setApiNotice] = useState('')
  const targetRef = useRef(35)

  useEffect(() => {
    if (phase !== 'process') return
    const id = window.setInterval(() => {
      setPercent((p) => {
        const t = targetRef.current
        if (p >= t) return p
        return Math.min(t, p + Math.max(1, Math.round((t - p) * 0.14)))
      })
    }, 70)
    return () => window.clearInterval(id)
  }, [phase])

  const runSearch = useCallback(
    async (mode: 'abstract' | 'search') => {
      const q = query.trim()
      if (mode === 'abstract' && q.length < 50) {
        setFormError(`Please enter an abstract of at least 50 characters (maximum ${MAX_ABSTRACT.toLocaleString()}).`)
        return
      }
      if (mode === 'search' && q.length < 3) {
        setFormError('Please enter journal title, subject area, or aims & scope terms.')
        return
      }
      setFormError('')
      setApiNotice('')
      setPercent(0)
      targetRef.current = 38
      setPhase('process')
      window.scrollTo({ top: 0 })

      const started = performance.now()
      const manuscript: Manuscript = {
        id: uid(),
        title: title.trim() || q.slice(0, 90),
        abstract: mode === 'abstract' ? q : `Search terms: ${q}. Journal discovery based on author-supplied terms.`,
        keywords: [q],
        createdAt: new Date().toISOString()
      }

      const results: JournalCandidate[] = []
      const notices: string[] = []
      const [oaRes, crRes] = await Promise.allSettled([
        searchOpenAlex(manuscript.title, manuscript.keywords),
        searchCrossref(manuscript.title, manuscript.keywords)
      ])
      if (oaRes.status === 'fulfilled') results.push(...oaRes.value)
      else notices.push('OpenAlex unreachable — matches below may be partial.')
      if (crRes.status === 'fulfilled') results.push(...crRes.value)
      else notices.push('Crossref unreachable — matches below may be partial.')
      if (results.length === 0) notices.push('No live results. Check your connection and try again.')

      targetRef.current = 72
      const matches = rankJournals(manuscript, results)
      targetRef.current = 92

      const elapsed = performance.now() - started
      const wait = Math.max(0, MIN_PROCESS_MS - elapsed)
      await new Promise((r) => window.setTimeout(r, wait))

      setAllMatches(matches)
      setApiNotice(notices.join(' '))
      targetRef.current = 100
      await new Promise((r) => window.setTimeout(r, 420))
      setPercent(100)
      await new Promise((r) => window.setTimeout(r, 320))
      setPhase('results')
      window.scrollTo({ top: 0 })
    },
    [query, title]
  )

  function handleFind(e: FormEvent) {
    e.preventDefault()
    void runSearch(tab === 'abstract' ? 'abstract' : 'search')
  }

  function handleNewSearch(nextTab?: 'abstract' | 'search') {
    if (nextTab) setTab(nextTab)
    setPhase('form')
    window.scrollTo({ top: 0 })
  }

  function checkInstitution() {
    if (!institution.trim()) {
      setInstitutionNote('')
      return
    }
    setInstitutionNote(
      "Institutional open-access agreements are negotiated per publisher and cannot be verified in this open preview. Ask your library or check the journal's OA agreement page before submitting."
    )
  }

  return (
    <div className="lp">
      <main id="main" className="finder-page">
        <div>
          {phase === 'results' ? (
            <ResultsBreadcrumb onNavigate={onNavigate} />
          ) : (
            <nav className="sc-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => onNavigate('home')}>
                Home
              </button>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Journal Finder</span>
            </nav>
          )}
        </div>

        {phase === 'form' && (
          <div className="finder-top">
            <h1 className="finder-h1">Find the right journal for your research</h1>
            <p className="finder-sub">
              Search the world's sources of academic journals using your abstract, or search by journal title, subject
              area, and aims &amp; scope. Results are live from OpenAlex and Crossref.
            </p>

            <form className="jf-card" onSubmit={handleFind} aria-label="Journal finder">
              <div className="jf-tabs" role="tablist" aria-label="Search mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'abstract'}
                  className={tab === 'abstract' ? 'jf-tab jf-tab-active' : 'jf-tab'}
                  onClick={() => {
                    setTab('abstract')
                    setFormError('')
                  }}
                >
                  Match my abstract
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'search'}
                  className={tab === 'search' ? 'jf-tab jf-tab-active' : 'jf-tab'}
                  onClick={() => {
                    setTab('search')
                    setFormError('')
                  }}
                >
                  Search by journal title, subject area, or aims &amp; scope
                </button>
              </div>

              <label className="jf-field">
                <span className="jf-label">
                  Paper title <span className="jf-optional">(optional)</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI in drug discovery"
                  maxLength={300}
                />
              </label>

              <div className="jf-field">
                <label className="jf-label" htmlFor="jf-query">
                  {tab === 'abstract' ? 'Abstract' : 'Journal title, subject area, or aims & scope'}
                </label>
                <textarea
                  id="jf-query"
                  value={query}
                  onChange={(e) => {
                    if (tab === 'abstract') {
                      if (e.target.value.length <= MAX_ABSTRACT) setQuery(e.target.value)
                    } else setQuery(e.target.value)
                  }}
                  rows={9}
                  placeholder={tab === 'abstract' ? 'Paste your abstract…' : 'e.g. AI in drug discovery, medicinal chemistry, QSAR…'}
                  aria-describedby="jf-count"
                />
                <span id="jf-count" className="jf-count">
                  {tab === 'abstract'
                    ? `${query.length.toLocaleString()} / ${MAX_ABSTRACT.toLocaleString()} characters`
                    : `${query.length.toLocaleString()} characters`}
                </span>
              </div>

              {formError && (
                <p role="alert" className="jf-error">
                  {formError}
                </p>
              )}

              <div className="jf-actions">
                <button type="submit" className="sc-btn-primary sc-btn-lg">
                  Find journals
                </button>
                <span className="jf-max">Maximum {MAX_ABSTRACT.toLocaleString()} characters</span>
              </div>
            </form>

            <section className="jf-oa" aria-label="Open access agreement">
              <h2>
                Open access agreement
                <InfoDot text="Institutional agreements vary by publisher and country." />
              </h2>
              <p>
                Many institutions have agreements which cover some or all of the cost of publishing open access. Enter
                the corresponding author's institution to see what to verify before submission. Other information
                provided at submission — country, funder, or society membership — can also reduce the price.
              </p>
              <label className="jf-field jf-oa-field">
                <span className="jf-label">Corresponding author's institution</span>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  onBlur={checkInstitution}
                  placeholder="Start typing your institution…"
                />
              </label>
              {institutionNote && <p className="jf-oa-note">{institutionNote}</p>}
            </section>
          </div>
        )}

        {phase === 'process' && <FinderProcess percent={percent} stages={stagesFor(percent)} />}

        {phase === 'results' && (
          <FinderResults matches={allMatches} apiNotice={apiNotice} onNewSearch={handleNewSearch} />
        )}
      </main>
    </div>
  )
}
