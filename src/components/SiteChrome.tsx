export type View = 'home' | 'finder' | 'sources' | 'tool' | 'privacy' | 'terms'
export type Draft = { title?: string; abstract?: string; keywords?: string }

interface Props {
  view: View
  onNavigate: (v: View) => void
}

const NAV: { label: string; view: View }[] = [
  { label: 'Home', view: 'home' },
  { label: 'Find journals', view: 'finder' },
  { label: 'Sources', view: 'sources' }
]

export function SiteHeader({ view, onNavigate }: Props) {
  return (
    <div className="sc-top">
      <div className="sc-utility">
        <div className="lp-container sc-utility-inner">
          <span className="sc-utility-tag">Evidence-first journal discovery · OpenAlex &amp; Crossref</span>
          <nav aria-label="Utility">
            <a href="mailto:support@pubrooter.example">Help</a>
            <a href="mailto:legal@pubrooter.example">Contact us</a>
            <button type="button" onClick={() => onNavigate('tool')}>
              Sign in
            </button>
          </nav>
        </div>
      </div>
      <header className="lp-header sc-mainbar">
        <div className="lp-container lp-header-inner">
          <button type="button" className="lp-logo lp-logo-btn" onClick={() => onNavigate('home')} aria-label="PubRooter home">
            <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="3" fill="#0056D6" />
              <path d="M8 20V8h6.2a4 4 0 0 1 0 8H11l4.5 4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>PubRooter</span>
          </button>
          <nav className="lp-nav sc-nav" aria-label="Main">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                className={view === item.view ? 'lp-nav-btn lp-nav-btn-active' : 'lp-nav-btn'}
                onClick={() => onNavigate(item.view)}
              >
                {item.label}
              </button>
            ))}
            <span className="sc-nav-div" aria-hidden="true" />
            <button type="button" className="lp-nav-btn" onClick={() => onNavigate('privacy')}>
              Privacy
            </button>
          </nav>
          <div className="lp-header-actions">
            <button type="button" className="lp-btn sc-btn-secondary" onClick={() => onNavigate('tool')}>
              Sign in
            </button>
            <button type="button" className="lp-btn sc-btn-primary" onClick={() => onNavigate('tool')}>
              Get started
            </button>
          </div>
        </div>
      </header>
    </div>
  )
}

export function SiteFooter({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-grid">
        <div>
          <span className="lp-logo lp-logo-footer">
            <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#0056D6" />
              <path d="M8 20V8h6.2a4 4 0 0 1 0 8H11l4.5 4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PubRooter
          </span>
          <p className="lp-footer-tag">Evidence-backed journal discovery for researchers.</p>
        </div>
        <div>
          <h4>Product</h4>
          <button type="button" className="lp-footer-link" onClick={() => onNavigate('finder')}>Find journals</button>
          <button type="button" className="lp-footer-link" onClick={() => onNavigate('sources')}>Browse sources</button>
          <button type="button" className="lp-footer-link" onClick={() => onNavigate('tool')}>Workspace</button>
        </div>
        <div>
          <h4>Data sources</h4>
          <a href="https://openalex.org" target="_blank" rel="noreferrer">OpenAlex</a>
          <a href="https://www.crossref.org" target="_blank" rel="noreferrer">Crossref</a>
          <a href="https://europepmc.org" target="_blank" rel="noreferrer">Europe PMC</a>
        </div>
        <div>
          <h4>Legal &amp; company</h4>
          <button type="button" className="lp-footer-link" onClick={() => onNavigate('privacy')}>Privacy policy</button>
          <button type="button" className="lp-footer-link" onClick={() => onNavigate('terms')}>Terms of use</button>
          <a href="mailto:legal@pubrooter.example">Contact</a>
        </div>
      </div>
      <div className="lp-container lp-footer-bottom">
        <span>© 2026 PubRooter. Publisher-neutral. Explainable by design. Source metrics via OpenAlex.</span>
      </div>
    </footer>
  )
}
