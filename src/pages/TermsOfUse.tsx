interface Props {
  onBack: () => void
  onPrivacy: () => void
}

export function TermsOfUse({ onBack, onPrivacy }: Props) {
  return (
    <div className="lp legal">
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <button type="button" className="lp-logo lp-logo-btn" onClick={onBack}>
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#0056D6" />
              <path d="M8 20V8h6.2a4 4 0 0 1 0 8H11l4.5 4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>PubRooter</span>
          </button>
          <nav className="lp-nav" aria-label="Legal">
            <a href="#acceptance">Acceptance</a>
            <a href="#acceptable-use">Acceptable use</a>
            <a href="#ip">Intellectual property</a>
            <a href="#disclaimer">Disclaimer</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="lp-header-actions">
            <button type="button" className="lp-btn lp-btn-ghost" onClick={onPrivacy}>
              Privacy policy
            </button>
            <button type="button" className="lp-btn lp-btn-primary" onClick={onBack}>
              Back to home
            </button>
          </div>
        </div>
      </header>

      <main className="lp-container legal-main">
        <p className="lp-eyebrow lp-eyebrow-blue">Legal</p>
        <h1 className="lp-h2">Terms of use</h1>
        <p className="legal-updated">Last updated: 21 October 2026</p>

        <section id="acceptance">
          <h2>1. Acceptance of terms</h2>
          <p>
            By accessing or using PubRooter (the “Service”), you agree to these Terms of Use. If you do not agree, do
            not use the Service. Additional terms may apply to specific features; those will be presented where the
            feature is offered.
          </p>
        </section>

        <section>
          <h2>2. The Service</h2>
          <p>
            PubRooter helps researchers discover potential journals and organise submission readiness using
            third-party scholarly metadata (such as OpenAlex and Crossref) and transparent matching heuristics. The
            Service is provided for informational and workflow purposes.
          </p>
        </section>

        <section>
          <h2>3. No guarantee of publication</h2>
          <p>
            Match scores, evidence summaries, and checklists are advisory. Journal editors independently review every
            submission. PubRooter does not guarantee acceptance, peer-review outcomes, timelines, or editorial
            decisions. You remain responsible for verifying each journal’s aims &amp; scope, author guidelines, fees,
            and policies before submitting.
          </p>
        </section>

        <section id="acceptable-use">
          <h2>4. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for unlawful purposes or to infringe others’ rights</li>
            <li>Attempt to probe, scan, or disrupt the Service or bypass security controls</li>
            <li>Scrape the Service at scale or resell match results as a competing database product</li>
            <li>Upload content you do not have the right to process (for example, confidential third-party manuscripts without authorisation)</li>
            <li>Misrepresent PubRooter endorsements. We do not endorse journals</li>
          </ul>
        </section>

        <section id="ip">
          <h2>5. Intellectual property</h2>
          <p>
            The Service’s software, design, and original content belong to PubRooter or its licensors. Journal names,
            logos, and metadata belong to their respective owners and are used descriptively for discovery. OpenAlex,
            Crossref, and other source marks belong to their owners; see our{' '}
            <button type="button" className="lp-link legal-inline-link" onClick={onPrivacy}>
              privacy policy
            </button>{' '}
            for how queries to those services are handled.
          </p>
        </section>

        <section>
          <h2>6. Your content</h2>
          <p>
            You retain all rights to manuscripts and project content you enter. You grant PubRooter only the limited
            rights needed to operate the Service (for example, transmitting search terms to metadata APIs when you
            run discovery). In local mode, content stays in your browser.
          </p>
        </section>

        <section id="disclaimer">
          <h2>7. Disclaimer of warranties</h2>
          <p>
            The Service is provided “as is” and “as available” without warranties of any kind, express or implied,
            including merchantability, fitness for a particular purpose, and non-infringement. Metadata from third
            parties may be incomplete, delayed, or incorrect.
          </p>
        </section>

        <section>
          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, PubRooter and its contributors will not be liable for indirect,
            incidental, special, consequential, or punitive damages, or for lost profits, data, or submission
            opportunities arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2>9. Termination</h2>
          <p>
            We may suspend or terminate access for violations of these Terms or to protect the Service. You may stop
            using the Service at any time; local projects can be deleted from your browser.
          </p>
        </section>

        <section>
          <h2>10. Changes to these Terms</h2>
          <p>
            We may revise these Terms. Material changes will be indicated by updating the date above and, where
            appropriate, in-product notice. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section id="contact">
          <h2>11. Contact</h2>
          <p>
            Questions about these Terms: <a href="mailto:legal@pubrooter.example">legal@pubrooter.example</a>
          </p>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-bottom">
          <span>© 2026 PubRooter. Publisher-neutral. Explainable by design.</span>
        </div>
      </footer>
    </div>
  )
}
