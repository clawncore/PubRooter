import { FormEvent, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { DEFAULT_PREFERENCES } from '../../workspace/types'

export function SettingsView() {
  const { data, update, lock, wipe, log, mode } = useWorkspace()
  const [name, setName] = useState(data?.profile.name ?? '')
  const [affiliation, setAffiliation] = useState(data?.profile.affiliation ?? '')
  const [saved, setSaved] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  if (!data) return null

  function saveProfile(e: FormEvent) {
    e.preventDefault()
    void update((ws) => ({ ...ws, profile: { ...ws.profile, name: name.trim(), affiliation: affiliation.trim() } })).then(() => {
      log('settings', 'Updated profile.')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="ws-h1">Settings</h1>
      <p className="ws-sub">Profile, default analysis constraints, data retention, and workspace security.</p>

      <form onSubmit={saveProfile} className="ws-card" style={{ marginBottom: '1rem' }}>
        <h2 className="ws-h2" style={{ marginTop: 0 }}>Profile</h2>
        <label className="ws-field">
          <span className="ws-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ws-field">
          <span className="ws-label">Affiliation</span>
          <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
        </label>
        <button type="submit" className="ws-btn ws-btn-primary">
          {saved ? 'Saved ✓' : 'Save profile'}
        </button>
      </form>

      <div className="ws-card" style={{ marginBottom: '1rem' }}>
        <h2 className="ws-h2" style={{ marginTop: 0 }}>Default research constraints</h2>
        <p style={{ fontSize: 12.5, color: '#666' }}>
          Applied to new manuscripts. Each project can override them.
        </p>
        <div className="ws-grid-2">
          <label className="ws-field">
            <span className="ws-label">Preferred subject area</span>
            <input
              value={data.defaultPreferences.subjectArea}
              onChange={(e) => void update((ws) => ({ ...ws, defaultPreferences: { ...ws.defaultPreferences, subjectArea: e.target.value } }))}
            />
          </label>
          <label className="ws-field">
            <span className="ws-label">Preferred publisher</span>
            <input
              value={data.defaultPreferences.preferredPublisher}
              onChange={(e) => void update((ws) => ({ ...ws, defaultPreferences: { ...ws.defaultPreferences, preferredPublisher: e.target.value } }))}
            />
          </label>
          <label className="ws-field">
            <span className="ws-label">Default max APC (US$)</span>
            <input
              type="number"
              min={0}
              value={data.defaultPreferences.apcMaxUsd ?? ''}
              onChange={(e) =>
                void update((ws) => ({
                  ...ws,
                  defaultPreferences: { ...ws.defaultPreferences, apcMaxUsd: e.target.value === '' ? null : Number(e.target.value) }
                }))
              }
            />
          </label>
          <label className="ws-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={data.defaultPreferences.oaPreferred}
              onChange={(e) => void update((ws) => ({ ...ws, defaultPreferences: { ...ws.defaultPreferences, oaPreferred: e.target.checked } }))}
            />
            <span className="ws-label" style={{ margin: 0 }}>Prefer open access</span>
          </label>
        </div>
        <button
          type="button"
          className="ws-btn ws-btn-ghost"
          onClick={() => void update((ws) => ({ ...ws, defaultPreferences: { ...DEFAULT_PREFERENCES } }))}
        >
          Reset defaults
        </button>
      </div>

      <div className="ws-card" style={{ marginBottom: '1rem' }}>
        <h2 className="ws-h2" style={{ marginTop: 0 }}>Privacy and data retention</h2>
        <ul style={{ fontSize: 12.5, color: '#333', lineHeight: 1.6, paddingLeft: '1.1rem', margin: 0 }}>
          {mode === 'cloud' ? (
            <>
              <li>Workspace rows and PDFs are stored in your Colabwize Supabase project, scoped to your account (row-level security).</li>
              <li>Your account is shared with Colabwize — the same email and password sign you into both products.</li>
              <li>Manuscript PDFs live in a private storage bucket readable only by your user id.</li>
              <li>Manuscript text is never written to application logs.</li>
            </>
          ) : (
            <>
              <li>Workspace contents are encrypted at rest with your passphrase (AES-GCM, PBKDF2-SHA256, 310k iterations).</li>
              <li>PDFs are stored in this browser's IndexedDB only. Manuscript text is never written to application logs.</li>
              <li>Metadata queries to OpenAlex and Crossref send title/keyword text — never file contents.</li>
              <li>Retention: data lives until you delete it. Clearing browser site data destroys the workspace permanently.</li>
            </>
          )}
          <li>Metadata queries to OpenAlex and Crossref send title/keyword text — never file contents.</li>
          <li>Third parties: OpenAlex and Crossref (metadata). No AI or OCR provider receives your manuscript.</li>
          <li>Retention: data lives until you delete it.</li>
          <li>Deleting a manuscript project removes its record; stored PDFs are removed with it.</li>
        </ul>
      </div>

      <div className="ws-card" style={{ borderColor: confirmWipe ? '#af1d1d' : undefined }}>
        <h2 className="ws-h2" style={{ marginTop: 0 }}>Workspace actions</h2>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="ws-btn ws-btn-ghost" onClick={lock}>
            Lock workspace
          </button>
          {!confirmWipe ? (
            <button type="button" className="ws-btn ws-btn-danger" onClick={() => setConfirmWipe(true)}>
              Delete workspace…
            </button>
          ) : (
            <>
              <span style={{ fontSize: 12.5, color: '#af1d1d', alignSelf: 'center' }}>
                This permanently erases all manuscripts, results, and saved journals. It cannot be undone.
              </span>
              <button type="button" className="ws-btn ws-btn-danger" onClick={() => wipe()}>
                Yes, delete everything
              </button>
              <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setConfirmWipe(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
