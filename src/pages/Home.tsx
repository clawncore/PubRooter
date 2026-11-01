import { useEffect, useState } from 'react'
import type { Draft, View } from '../types-nav'

interface Props {
  onNavigate: (v: View, d?: Draft) => void
}

const TYPE_PHRASES = [
  'Empowering research with evidence-backed journal discovery',
  'Match your paper to journals that actually fit',
  'Turn desk rejections into a better-matched shortlist',
  'From manuscript to published, with the evidence shown'
]

interface TickerJournal {
  slug: string
  file: string
  name: string
  short: string
}

const TICKER: TickerJournal[] = [
  { slug: 'pnas', file: 'pnas.png', name: 'PNAS', short: 'PN' },
  { slug: 'bmj', file: 'bmj.png', name: 'BMJ', short: 'BMJ' },
  { slug: 'cell', file: 'cell.png', name: 'Cell', short: 'C' },
  { slug: 'jama', file: 'jama.png', name: 'JAMA', short: 'J' },
  { slug: 'plos-one', file: 'plos-one.png', name: 'PLOS ONE', short: 'PO' },
  { slug: 'sci-reports', file: 'sci-reports.png', name: 'Scientific Reports', short: 'SR' },
  { slug: 'nature-comms', file: 'nature-comms.png', name: 'Nature Communications', short: 'NC' },
  { slug: 'ieee-access', file: 'ieee-access.jpg', name: 'IEEE Access', short: 'IA' },
  { slug: 'elife', file: 'elife.png', name: 'eLife', short: 'eL' },
  { slug: 'neuron', file: 'neuron.png', name: 'Neuron', short: 'N' }
]

function TickerItem({ j }: { j: TickerJournal }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <span className="lp-ticker-item">
      {imgOk ? (
        <img className="lp-ticker-logo" src={`/journals/${j.file}`} alt="" onError={() => setImgOk(false)} />
      ) : (
        <span className="lp-ticker-fallback" aria-hidden="true">{j.short}</span>
      )}
      <span className="lp-ticker-name">{j.name}</span>
    </span>
  )
}

function useTypewriter(phrases: readonly string[]) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduced) {
      setText(phrases[0] ?? '')
      return
    }
    const full = phrases[index] ?? ''
    let t: number
    if (!deleting) {
      if (text.length < full.length) {
        t = window.setTimeout(() => setText(full.slice(0, text.length + 1)), 26)
      } else {
        t = window.setTimeout(() => setDeleting(true), 2400)
      }
    } else {
      if (text.length > 0) {
        t = window.setTimeout(() => setText(full.slice(0, text.length - 1)), 12)
      } else {
        setDeleting(false)
        setIndex((i) => (i + 1) % phrases.length)
        return
      }
    }
    return () => window.clearTimeout(t)
  }, [text, deleting, index, phrases, reduced])

  return { text, reduced }
}

const EXPLORE = [
  {
    view: 'finder' as const,
    num: '01',
    kicker: 'Journal Finder',
    title: 'Match your abstract to journals',
    body: 'Paste a title and abstract. We query OpenAlex and Crossref in parallel and return explainable matches.',
    meta: ['OpenAlex + Crossref', 'Evidence per match', '≤ 5,000 char abstract'],
    art: 'finder',
    accent: 'blue'
  },
  {
    view: 'sources' as const,
    num: '02',
    kicker: 'Sources',
    title: 'Browse journals like a catalog',
    body: 'Search by title, publisher, or ISSN. Filter open-access journals and minimum output. Sort the list.',
    meta: ['Title · Publisher · ISSN', 'OA & activity filters', '50k+ sources'],
    art: 'sources',
    accent: 'orange'
  },
  {
    view: 'tool' as const,
    num: '03',
    kicker: 'Workspace',
    title: 'Track submission readiness',
    body: 'Save shortlists, survive rejections with a resubmission path, and work a readiness checklist until the work is published.',
    meta: ['Saved projects', 'Readiness checklist', 'Local-first storage'],
    art: 'workspace',
    accent: 'ink'
  }
] as const

const WHY = [
  {
    tint: 'blue',
    icon: 'search',
    title: 'Increase submission efficiency',
    body: 'Abstract matching, saved projects, and readiness checklists. Less guesswork, faster shortlists.'
  },
  {
    tint: 'orange',
    icon: 'evidence',
    title: 'Transparent evidence',
    body: 'Every match shows shared terms, source coverage, and limitations. No black-box scores.'
  },
  {
    tint: 'yellow',
    icon: 'trend',
    title: 'Emerging venues',
    body: 'Live metadata from community indexes so new and shifting scopes surface early.'
  },
  {
    tint: 'green',
    icon: 'scale',
    title: 'Strategic decisions',
    body: 'Compare open-access status, APC indicators, and activity before you format a submission.'
  },
  {
    tint: 'purple',
    icon: 'check',
    title: 'Requirements you can trust',
    body: 'Unverified checklist items stay unknown. Never silently marked complete.'
  }
]

const MOSAIC = [
  {
    src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80&auto=format&fit=crop',
    alt: 'Researcher analyzing data on a laptop',
    caption: 'Individual researchers'
  },
  {
    src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80&auto=format&fit=crop',
    alt: 'Lab team collaborating around laptops',
    caption: 'Labs & groups'
  },
  {
    src: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80&auto=format&fit=crop',
    alt: 'Laboratory glassware and experiments',
    caption: 'Life sciences'
  },
  {
    src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop',
    alt: 'Analytics charts on a monitor',
    caption: 'Research offices'
  }
]

const NUMBERS = [
  { value: '100M+', label: 'Scholarly works discoverable' },
  { value: '50k+', label: 'Journals in browse' },
  { value: '2', label: 'Live metadata APIs' },
  { value: '0', label: 'Paid placements' },
  { value: '100%', label: 'Evidence per match' }
]

const NEWS = [
  {
    tint: 'orange',
    title: 'Evidence-first matching is live',
    body: 'Weights, rationale, and limitations on every journal card. Built for defensible shortlists.',
    cta: 'Try the finder'
  },
  {
    tint: 'blue',
    title: 'Sources browse with open-access filters',
    body: 'Search journals by title, publisher, or ISSN. Filter OA-only and minimum works. Powered by OpenAlex.',
    cta: 'Open Sources'
  },
  {
    tint: 'green',
    title: 'Checklists keep unknowns explicit',
    body: 'Requirements you have not verified stay marked unknown. Never assumed met.',
    cta: 'Open workspace'
  }
]

function Icon({ name }: { name: string }) {
  const common = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'search':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      )
    case 'evidence':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" {...common} aria-hidden="true">
          <path d="M4 6h16M4 12h10M4 18h13" />
          <circle cx="18" cy="12" r="2" />
        </svg>
      )
    case 'trend':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" {...common} aria-hidden="true">
          <path d="M4 16l5-5 4 4 7-7" />
          <path d="M14 8h6v6" />
        </svg>
      )
    case 'scale':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" {...common} aria-hidden="true">
          <path d="M12 4v16M6 8l-3 6h6L6 8zm12 0l-3 6h6l-3-6zM5 20h14" />
        </svg>
      )
    case 'check':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" {...common} aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      )
    default:
      return null
  }
}

function ExploreArt({ kind }: { kind: string }) {
  if (kind === 'finder') {
    return (
      <svg className="ex-art" viewBox="0 0 300 150" aria-hidden="true">
        <rect x="30" y="16" width="160" height="118" rx="6" fill="#ffffff" stroke="#d9dee5" />
        <rect x="46" y="34" width="92" height="9" rx="4.5" fill="#0056D6" opacity="0.85" />
        <rect x="46" y="56" width="128" height="7" rx="3.5" fill="#c3ccd6" />
        <rect x="46" y="72" width="112" height="7" rx="3.5" fill="#c3ccd6" />
        <rect x="46" y="88" width="122" height="7" rx="3.5" fill="#dde3ea" />
        <rect x="46" y="104" width="78" height="7" rx="3.5" fill="#dde3ea" />
        <rect x="46" y="118" width="52" height="6" rx="3" fill="#e9edf2" />
        <rect x="206" y="34" width="72" height="72" rx="8" fill="#ffffff" stroke="#0056D6" strokeWidth="1.5" />
        <text x="242" y="76" textAnchor="middle" fill="#0056D6" fontSize="26" fontWeight="700" fontFamily="Georgia, serif">92</text>
        <rect x="218" y="88" width="48" height="5" rx="2.5" fill="#c3ccd6" />
        <rect x="206" y="116" width="34" height="14" rx="7" fill="#EBF1F9" />
        <rect x="246" y="116" width="32" height="14" rx="7" fill="#f0f2f5" />
      </svg>
    )
  }
  if (kind === 'sources') {
    return (
      <svg className="ex-art" viewBox="0 0 300 150" aria-hidden="true">
        <rect x="30" y="14" width="240" height="30" rx="6" fill="#ffffff" stroke="#d9dee5" />
        <rect x="44" y="24" width="70" height="9" rx="4.5" fill="#0056D6" opacity="0.8" />
        <circle cx="252" cy="29" r="7" fill="none" stroke="#666" strokeWidth="1.8" />
        <path d="M257 34l5 5" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(30 ${54 + i * 24})`}>
            <rect width="240" height="18" rx="4" fill="#ffffff" stroke={i === 0 ? '#0056D6' : '#e2e6eb'} strokeWidth={i === 0 ? 1.5 : 1} opacity={1 - i * 0.08} />
            <rect x="10" y="5.5" width={104 - i * 12} height="7" rx="3.5" fill="#8b95a1" />
            <rect x="178" y="5.5" width="30" height="7" rx="3.5" fill="#0056D6" opacity={0.75 - i * 0.12} />
            <rect x="216" y="4.5" width="14" height="9" rx="4.5" fill={i % 2 === 0 ? '#e9f9ee' : '#f0f2f5'} stroke={i % 2 === 0 ? '#0C8930' : '#d9dee5'} strokeWidth="1" />
          </g>
        ))}
      </svg>
    )
  }
  return (
    <svg className="ex-art" viewBox="0 0 300 150" aria-hidden="true">
      <rect x="30" y="14" width="164" height="122" rx="6" fill="#ffffff" stroke="#d9dee5" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(46 ${32 + i * 24})`}>
          <rect width="14" height="14" rx="3" fill={i < 2 ? '#0C8930' : i === 2 ? '#fff8e0' : '#f6f6f6'} stroke={i < 2 ? '#0C8930' : i === 2 ? '#c9a227' : '#cccccc'} strokeWidth="1.3" />
          {i < 2 && <path d="M4 7.5l2.8 2.8L11 5.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {i === 2 && <text x="7" y="11" textAnchor="middle" fontSize="9" fontWeight="700" fill="#c9a227">?</text>}
          <rect x="24" y="3.5" width={104 - i * 14} height="7" rx="3.5" fill="#8b95a1" opacity={i < 2 ? 0.85 : 0.4} />
        </g>
      ))}
      <circle cx="240" cy="66" r="40" fill="#ffffff" stroke="#d9dee5" />
      <circle cx="240" cy="66" r="27" fill="none" stroke="#e6e6e6" strokeWidth="7" />
      <circle cx="240" cy="66" r="27" fill="none" stroke="#0C8930" strokeWidth="7" strokeLinecap="round"
        strokeDasharray="169.6" strokeDashoffset="67.8" transform="rotate(-90 240 66)" />
      <text x="240" y="64" textAnchor="middle" fill="#0C0F12" fontSize="13" fontWeight="700" fontFamily="Georgia, serif">6/10</text>
      <text x="240" y="78" textAnchor="middle" fill="#808080" fontSize="8" fontWeight="600">4 unknown</text>
      <rect x="204" y="116" width="74" height="16" rx="8" fill="#ffffff" stroke="#d9dee5" />
      <rect x="212" y="122" width="58" height="4" rx="2" fill="#0056D6" opacity="0.55" />
    </svg>
  )
}

export function Home({ onNavigate }: Props) {
  const { text, reduced } = useTypewriter(TYPE_PHRASES)
  return (
    <div className="lp">
      <main id="main">
        {/* Hero. Product mock, not stock photo */}
        <section className="lp-hero">
          <div className="lp-hero-glow" aria-hidden="true" />
          <div className="lp-container lp-hero-inner home-hero">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">Journal discovery &amp; submission readiness</p>
              <h1 className="lp-hero-typed">
                <span aria-hidden="true">{text}</span>
                <span className={reduced ? 'lp-caret lp-caret-plain' : 'lp-caret'} aria-hidden="true" />
                <span className="lp-sr-only">
                  Empowering research with evidence-backed journal discovery. Match your paper to journals that
                  actually fit, turn desk rejections into a better-matched shortlist, and go from manuscript to
                  published with the evidence shown.
                </span>
              </h1>
              <p className="lp-lede">
                Move from manuscript to a defensible shortlist. PubRooter matches your abstract against live scholarly
                indexes and shows the evidence. Provenance, weights, and limitations - for every recommendation. It
                also handles rejection-and-resubmission loops and submission readiness, until your work is published.
              </p>
              <div className="lp-hero-actions">
                <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => onNavigate('finder')}>
                  Find journals
                </button>
                <button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => onNavigate('sources')}>
                  Browse sources
                </button>
              </div>
            </div>
            <div className="home-mock" aria-hidden="true">
              <div className="home-mock-card home-mock-main">
                <div className="home-mock-top">
                  <span className="home-mock-title">Journal of Biomedical Informatics</span>
                  <span className="home-mock-score">94</span>
                </div>
                <div className="home-mock-pills">
                  <span>OpenAlex</span>
                  <span>OA</span>
                  <span>ISSN listed</span>
                </div>
                <div className="home-mock-rows">
                  <div className="home-mock-row"><b>Topic overlap</b>. Clinical, NLP, trial matching</div>
                  <div className="home-mock-row"><b>Activity</b>. High works volume indexed</div>
                  <div className="home-mock-row muted-row"><b>Limitation</b>. Verify aims &amp; scope on site</div>
                </div>
              </div>
              <div className="home-mock-card home-mock-side">
                <span className="home-mock-side-label">Sources queried</span>
                <span className="home-mock-chip">OpenAlex</span>
                <span className="home-mock-chip">Crossref</span>
              </div>
              <div className="home-mock-card home-mock-check">
                <span className="home-mock-side-label">Readiness</span>
                <div className="home-check-bar"><i style={{ width: '60%' }} /></div>
                <span className="home-mock-side-label">6 / 10 items met · 4 unknown</span>
              </div>
            </div>
          </div>
          <div className="lp-ticker">
            <div className="lp-container">
              <span className="lp-ticker-label">Journals you can match against, including</span>
            </div>
            <div className="lp-ticker-viewport" aria-hidden="true">
              <div className="lp-ticker-track">
                {[...TICKER, ...TICKER].map((j, i) => (
                  <TickerItem key={`${j.slug}-${i}`} j={j} />
                ))}
              </div>
            </div>
            <p className="lp-sr-only">{TICKER.map((j) => j.name).join(', ')}</p>
          </div>
        </section>

        {/* Explore cards */}
        <section className="lp-section">
          <div className="lp-container">
            <h2 className="lp-h2">Explore PubRooter</h2>
            <p className="lp-body">Three focused tools. The same ones research teams use every submission cycle.</p>
            <div className="home-explore">
              {EXPLORE.map((card) => (
                <button
                  key={card.view}
                  type="button"
                  className={`home-explore-card ex-accent-${card.accent}`}
                  onClick={() => onNavigate(card.view)}
                >
                  <span className="home-explore-art" aria-hidden="true">
                    <ExploreArt kind={card.art} />
                  </span>
                  <span className="home-explore-body">
                    <span className="home-explore-kicker">{card.kicker}</span>
                    <span className="home-explore-title">{card.title}</span>
                    <span className="home-explore-desc">{card.body}</span>
                    <span className="home-explore-meta">
                      {card.meta.map((m) => (
                        <span key={m} className="home-explore-chip">
                          {m}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="home-explore-cta">
                    Open {card.kicker.toLowerCase()}
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Why. Icon cards */}
        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <h2 className="lp-h2">Why PubRooter?</h2>
            <div className="home-why-grid">
              {WHY.map((f) => (
                <article key={f.title} className={`home-why-card lp-tint-${f.tint}`}>
                  <span className={`home-why-icon home-why-icon-${f.tint}`}>
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Photo mosaic. Small cards, not one giant image */}
        <section className="lp-section">
          <div className="lp-container">
            <h2 className="lp-h2">Designed for everyone in the publication loop</h2>
            <p className="lp-body">From solo authors to institutional research offices. One evidence-first workflow.</p>
            <div className="home-mosaic">
              {MOSAIC.map((m) => (
                <figure key={m.caption} className="home-mosaic-card">
                  <img src={m.src} alt={m.alt} width="280" height="180" loading="lazy" />
                  <figcaption>{m.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section className="lp-numbers" id="numbers">
          <div className="lp-numbers-glow" aria-hidden="true" />
          <div className="lp-container">
            <h2 className="lp-h2 lp-h2-light">PubRooter by the numbers</h2>
            <div className="lp-numbers-grid">
              {NUMBERS.map((n) => (
                <div key={n.label} className="lp-number">
                  <span className="lp-number-value">{n.value}</span>
                  <span className="lp-number-label">{n.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section className="lp-section lp-section-alt">
          <div className="lp-container">
            <h2 className="lp-h2">Content coverage</h2>
            <div className="lp-coverage-grid">
              <div className="lp-coverage">
                <h3>OpenAlex</h3>
                <p>100M+ works and tens of thousands of sources with OA status, topics, and citation indicators. Powers the Sources catalog.</p>
              </div>
              <div className="lp-coverage">
                <h3>Crossref</h3>
                <p>Registered journals with ISSN and publisher metadata. Queried in parallel with OpenAlex by the Journal Finder.</p>
              </div>
              <div className="lp-coverage">
                <h3>Europe PMC</h3>
                <p>Biomedical literature with abstracts and full-text links. On the roadmap for abstract-native matching.</p>
              </div>
            </div>
          </div>
        </section>

        {/* News */}
        <section className="lp-section" id="news">
          <div className="lp-container">
            <h2 className="lp-h2">What's new</h2>
            <div className="lp-news-grid">
              {NEWS.map((n, i) => (
                <article key={n.title} className={`lp-news lp-tint-${n.tint}`}>
                  <div className="home-news-art" aria-hidden="true">
                    <svg viewBox="0 0 120 48" width="120" height="48">
                      {i === 0 && <path d="M8 36l20-16 16 10 28-22 20 12" stroke="currentColor" strokeWidth="3" fill="none" />}
                      {i === 1 && (
                        <>
                          <rect x="8" y="10" width="80" height="10" rx="5" fill="currentColor" opacity="0.85" />
                          <rect x="8" y="26" width="104" height="8" rx="4" fill="currentColor" opacity="0.4" />
                        </>
                      )}
                      {i === 2 && <path d="M14 26l12 12 28-30" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />}
                    </svg>
                  </div>
                  <div className="lp-news-body">
                    <h3>{n.title}</h3>
                    <p>{n.body}</p>
                    <button
                      type="button"
                      className="lp-link"
                      onClick={() => onNavigate(i === 1 ? 'sources' : i === 2 ? 'tool' : 'finder')}
                    >
                      {n.cta} <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-container lp-cta-inner">
            <h2 className="lp-h2 lp-h2-light">Ready to find where your work belongs?</h2>
            <button type="button" className="lp-btn lp-btn-orange lp-btn-lg" onClick={() => onNavigate('finder')}>
              Start with your abstract
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
