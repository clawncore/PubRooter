interface Props {
  onBack: () => void
  onTerms: () => void
}

export function PrivacyPolicy({ onBack, onTerms }: Props) {
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
            <a href="#overview">Overview</a>
            <a href="#data">Data we collect</a>
            <a href="#use">How we use it</a>
            <a href="#rights">Your rights</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="lp-header-actions">
            <button type="button" className="lp-btn lp-btn-ghost" onClick={onTerms}>
              Terms of use
            </button>
            <button type="button" className="lp-btn lp-btn-primary" onClick={onBack}>
              Back to home
            </button>
          </div>
        </div>
      </header>

      <main className="lp-container legal-main">
        <p className="lp-eyebrow lp-eyebrow-blue">Legal</p>
        <h1 className="lp-h2">Privacy policy</h1>
        <p className="legal-updated">Last updated: 21 October 2026</p>

        <section id="overview">
          <h2>1. Overview</h2>
          <p>
            PubRooter is a research-publication workflow tool that helps you discover journals and prepare
            submissions. We designed it to be privacy-first: by default, your manuscripts and projects stay in your
            browser and are not uploaded to our servers.
          </p>
          <p>
            This policy explains what information we handle, why, and what choices you have. It applies to the
            PubRooter website and application (the “Service”).
          </p>
        </section>

        <section id="data">
          <h2>2. Information we collect</h2>
          <h3>2.1 Information you provide</h3>
          <ul>
            <li>
              <strong>Manuscript content</strong>. Titles, abstracts, and keywords you enter for journal discovery.
              In the default local mode, this data remains in your browser’s local storage and is never transmitted
              to PubRooter servers.
            </li>
            <li>
              <strong>Account information</strong> - if you later create an account (optional, roadmap), your email
              and organisation details.
            </li>
            <li>
              <strong>Support messages</strong> - if you contact us, the content of your message and contact details.
            </li>
          </ul>
          <h3>2.2 Information collected automatically</h3>
          <ul>
            <li>
              <strong>Technical logs</strong> - standard server logs (IP address, browser type, pages visited,
              timestamps) used for security and reliability.
            </li>
            <li>
              <strong>Cookies</strong> - we use only essential cookies required for the Service to function. We do
              not use advertising or cross-site tracking cookies.
            </li>
          </ul>
          <h3>2.3 Third-party scholarly APIs</h3>
          <p>
            When you run discovery, your search terms (title fragments, keywords, abstract-derived terms) are sent to
            third-party scholarly APIs such as OpenAlex and Crossref to retrieve journal metadata. Those providers
            process those requests under their own privacy policies. We do not send your full account profile to them.
          </p>
        </section>

        <section id="use">
          <h2>3. How we use information</h2>
          <ul>
            <li>To provide journal matching, evidence displays, and readiness checklists</li>
            <li>To save and restore projects you explicitly choose to save</li>
            <li>To keep the Service secure, prevent abuse, and diagnose errors</li>
            <li>To respond to support requests</li>
            <li>To improve the product using aggregated, de-identified usage statistics</li>
          </ul>
          <p>
            We do not sell your personal data. We do not use your manuscript content to train third-party AI models.
          </p>
        </section>

        <section>
          <h2>4. Legal bases (EEA/UK users)</h2>
          <p>
            Where GDPR or UK GDPR applies, we process: (a) <strong>contractual necessity</strong> to provide the
            Service you request; (b) <strong>legitimate interests</strong> for security, fraud prevention, and product
            improvement; and (c) <strong>consent</strong> for any optional communications.
          </p>
        </section>

        <section>
          <h2>5. Retention</h2>
          <p>
            Local-mode projects stay on your device until you delete them or clear site data. Server logs are retained
            for up to 90 days unless needed longer for security investigations. Support correspondence is retained for
            up to 24 months.
          </p>
        </section>

        <section>
          <h2>6. Sharing</h2>
          <p>We share data only with:</p>
          <ul>
            <li>Scholarly metadata providers when you initiate a search (OpenAlex, Crossref, and others we add)</li>
            <li>Infrastructure processors hosting the Service under data-processing agreements</li>
            <li>Authorities when required by law</li>
          </ul>
        </section>

        <section id="rights">
          <h2>7. Your rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access, correct, or delete personal data we hold</li>
            <li>Export a copy of your data</li>
            <li>Object to or restrict certain processing</li>
            <li>Withdraw consent where processing is consent-based</li>
            <li>Lodge a complaint with a supervisory authority</li>
          </ul>
          <p>
            In local mode you can exercise most rights yourself by clearing browser storage for this site. For other
            requests, use the contact details below.
          </p>
        </section>

        <section>
          <h2>8. Security</h2>
          <p>
            We use industry-standard measures including encryption in transit (HTTPS), access controls, and
            least-privilege operational practices. No system is perfectly secure; please avoid entering unpublished
            manuscripts on shared or public devices.
          </p>
        </section>

        <section>
          <h2>9. Children</h2>
          <p>The Service is directed at professional researchers and is not intended for children under 16.</p>
        </section>

        <section>
          <h2>10. Changes</h2>
          <p>
            We may update this policy. Material changes will be announced on the Service with a revised “last updated”
            date. Continued use after changes means you accept the updated policy.
          </p>
        </section>

        <section id="contact">
          <h2>11. Contact</h2>
          <p>
            Privacy questions: <a href="mailto:privacy@pubrooter.example">privacy@pubrooter.example</a>
            <br />
            Data protection enquiries: <a href="mailto:dpo@pubrooter.example">dpo@pubrooter.example</a>
          </p>
          <p>
            See also our <button type="button" className="lp-link legal-inline-link" onClick={onTerms}>Terms of use</button>.
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
