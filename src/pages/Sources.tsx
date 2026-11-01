import { FormEvent, useCallback, useEffect, useState } from 'react'
import { searchSources, type SourceQuery, type SourceRow } from '../api/sources'
import { JournalCover } from '../components/JournalCover'

export function Sources() {
  const [field, setField] = useState<SourceQuery['field']>('title')
  const [value, setValue] = useState('')
  const [openAccessOnly, setOpenAccessOnly] = useState(false)
  const [minWorks, setMinWorks] = useState(0)
  const [rows, setRows] = useState<SourceRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (q: SourceQuery) => {
    setLoading(true)
    setError('')
    try {
      const { rows: r, total: t } = await searchSources(q, 1)
      setRows(r)
      setTotal(t)
    } catch (e) {
      setRows([])
      setTotal(null)
      setError(e instanceof Error ? e.message : 'Source search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run({ field: 'title', value: '', openAccessOnly: false, minWorks: 0 })
  }, [run])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    void run({ field, value, openAccessOnly, minWorks })
  }

  function clearFilters() {
    setOpenAccessOnly(false)
    setMinWorks(0)
    setValue('')
    void run({ field, value: '', openAccessOnly: false, minWorks: 0 })
  }

  return (
    <div className="lp">
      <main id="main" className="sources-page">
        <div className="sources-glow" aria-hidden="true" />
        <div className="lp-container sources-head">
          <p className="lp-eyebrow">Sources catalog</p>
          <h1 className="lp-h2">Browse journals &amp; sources</h1>
          <p className="lp-body sources-lede">
            Search journal sources indexed in OpenAlex. By title, publisher, or ISSN - and refine with open-access and
            activity filters. Comparable in layout to Scopus Sources; data and metrics are OpenAlex's, labeled as such.
            The provenance of every figure is explained at the bottom of this page.
          </p>
        </div>

        <div className="lp-container sources-searchbar-wrap">
          <form className="sources-searchbar" onSubmit={handleSearch} role="search" aria-label="Source search">
            <label className="sources-field-select">
              <span className="visually-hidden">Search field</span>
              <select value={field} onChange={(e) => setField(e.target.value as SourceQuery['field'])}>
                <option value="subject">Subject</option>
                <option value="title">Title</option>
                <option value="publisher">Publisher</option>
                <option value="issn">ISSN</option>
              </select>
            </label>
            <label className="sources-field-input">
              <span className="visually-hidden">Search term</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  field === 'issn'
                    ? 'e.g. 0028-0836'
                    : field === 'publisher'
                      ? 'e.g. Elsevier'
                      : field === 'subject'
                        ? 'e.g. oncology, computer science'
                        : 'e.g. Nature'
                }
              />
            </label>
            <button type="submit" className="lp-btn lp-btn-primary">
              Search
            </button>
            <button type="button" className="lp-btn lp-btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          </form>
        </div>

        <div className="lp-container sources-layout">
          <aside className="sources-filters" aria-label="Refine results">
            <h2>Refine list</h2>

            <section className="sources-filter-group">
              <h3>Display options</h3>
              <label className="sources-check">
                <input
                  type="checkbox"
                  checked={openAccessOnly}
                  onChange={(e) => setOpenAccessOnly(e.target.checked)}
                />
                Display only open access journals
              </label>
            </section>

            <section className="sources-filter-group">
              <h3>Minimum activity</h3>
              <label className="sources-min">
                Minimum works indexed
                <select value={minWorks} onChange={(e) => setMinWorks(Number(e.target.value))}>
                  <option value={0}>No minimum</option>
                  <option value={100}>100+</option>
                  <option value={500}>500+</option>
                  <option value={1000}>1,000+</option>
                  <option value={5000}>5,000+</option>
                </select>
              </label>
            </section>

            <section className="sources-filter-group">
              <h3>Source type</h3>
              <p className="sources-filter-note">Journals only (book series &amp; proceedings on roadmap).</p>
            </section>

            <section className="sources-filter-group sources-where">
              <h3>Where this data comes from</h3>
              <p>
                Source titles, ISSNs, publishers, OA flags, works counts, and 2-year mean citedness are provided by the{' '}
                <a href="https://openalex.org" target="_blank" rel="noreferrer">
                  OpenAlex
                </a>{' '}
                public API. Not Scopus. Figures update as OpenAlex updates. Full answers on sources, and on what runs in
                the frontend vs. a backend, are at the bottom of this page.
              </p>
            </section>

            <button type="button" className="lp-btn lp-btn-primary sources-apply" onClick={() => void run({ field, value, openAccessOnly, minWorks })}>
              Apply filters
            </button>
          </aside>

          <section className="sources-results" aria-label="Source results" aria-busy={loading}>
            <header className="sources-results-head">
              <h2>
                {total === null ? 'Results' : `${total.toLocaleString()} results`}
                {loading && <span className="sources-loading">. Loading…</span>}
              </h2>
              <p className="sources-note">Sorted by works indexed (desc). OpenAlex monthly coverage.</p>
            </header>

            {error && (
              <div className="banner" role="alert">
                {error}
              </div>
            )}

            {rows.length === 0 && !loading && !error && (
              <p className="muted sources-empty">No sources matched. Try a broader title or clear filters.</p>
            )}

            {rows.length > 0 && (
              <div className="sources-table-wrap">
                <table className="sources-table">
                  <thead>
                    <tr>
                      <th scope="col">Source title</th>
                      <th scope="col">Publisher</th>
                      <th scope="col">ISSN</th>
                      <th scope="col" title="2-year mean citedness from OpenAlex">2-yr cited</th>
                      <th scope="col">Documents</th>
                      <th scope="col">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="sources-title-cell">
                            <JournalCover title={r.title} className="jf-cover sources-cover" />
                            <div className="sources-title-info">
                              {r.homepageUrl ? (
                                <a href={r.homepageUrl} target="_blank" rel="noreferrer">
                                  {r.title}
                                </a>
                              ) : (
                                <span className="sources-title-text">{r.title}</span>
                              )}
                              {r.hostOrg && <span className="sources-host">{r.hostOrg}</span>}
                            </div>
                          </div>
                        </td>
                        <td>{r.publisher ?? 'N/A'}</td>
                        <td className="sources-mono">{r.issn ?? 'N/A'}</td>
                        <td>{typeof r.citedness === 'number' ? r.citedness.toFixed(2) : 'N/A'}</td>
                        <td>{r.worksCount.toLocaleString()}</td>
                        <td>
                          {r.isOpenAccess ? (
                            <span className="oa-badge oa-yes">Open access</span>
                          ) : (
                            <span className="oa-badge oa-no">Mixed / subscription</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="sources-footnote">
              Only the first page is shown in this preview. Quartile and CiteScore filters require Scopus data and are
              not reproduced here. We will not invent proprietary metrics.
            </p>
          </section>
        </div>

        <section className="lp-container sources-qa" aria-labelledby="sources-qa-title">
          <p className="lp-eyebrow">Provenance, in full</p>
          <h2 id="sources-qa-title" className="lp-h2">
            Where this journal data comes from. And where it does not
          </h2>

          <div className="sources-qa-grid">
            <article className="sources-qa-item">
              <h3>What are the journal sources?</h3>
              <p>
                The catalog above is <strong>OpenAlex</strong>. A free, open scholarly index - queried live and
                restricted to journals (<code>type:journal</code>). Publisher names and homepages in the journal finder
                are enriched from <strong>Crossref</strong>, another open DOI registry. PubRooter does{' '}
                <strong>not</strong> use Scopus, Web of Science, or any licensed/proprietary index. We have no access
                to them. That is why quartiles, CiteScore, SJR and decision times are shown as “N/A”: they are not ours
                to display, and we will not fabricate them.
              </p>
            </article>

            <article className="sources-qa-item">
              <h3>Are the journals hardwired in the frontend, or served from a backend?</h3>
              <p>
                <strong>Neither: PubRooter has no backend at all.</strong> Every search you run above executes in{' '}
                <em>your browser</em>: the page issues a direct HTTPS request to{' '}
                <code>https://api.openalex.org/sources</code> and renders the JSON that comes back. No journal rows are
                hardcoded, cached on a server, or stored by us. What <em>is</em> fixed. In frontend source code you can
                inspect under <code>src/</code> - is the <em>logic</em>: ranking rules (<code>pubrooter-rank-v1</code>),
                fit-tier thresholds, readiness rules, and this interface. Data is fetched; rules are coded. Never the
                other way around.
              </p>
            </article>

            <article className="sources-qa-item">
              <h3>Where do the numbers come from, and how fresh are they?</h3>
              <p>
                Live from the public APIs at the moment you query:{' '}
                <code>api.openalex.org</code> for titles, ISSNs, publishers, open-access flags, works counts and 2-year
                mean citedness (a citedness proxy. Not an impact factor); <code>api.crossref.org</code> for DOI and
                publisher metadata. OpenAlex refreshes monthly, so figures reflect the last OpenAlex snapshot and are
                labeled with the source and retrieval date. Because there is no PubRooter server, these queries pass
                through no system of ours - they go from your browser to the provider directly.
              </p>
            </article>
          </div>

          <p className="sources-qa-foot">
            If a figure is not shown, we do not have it. PubRooter displays “N/A” rather than estimating proprietary
            metrics, never claims indexing that metadata presence cannot prove, and never presents a relevance score as
            an acceptance probability.
          </p>
        </section>
      </main>
    </div>
  )
}
