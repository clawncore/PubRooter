import { FormEvent, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { colabwizeHandoffUrl } from '../../lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.9rem 0', color: '#999', fontSize: 12 }}>
      <span style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
      {label}
      <span style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
    </div>
  )
}

export function AuthScreen() {
  const { mode, exists, create, unlock, busy, error, signIn, signUp, signInWithProvider } = useWorkspace()
  const [tab, setTab] = useState<'signin' | 'signup'>(exists ? 'signin' : 'signup')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const cloud = mode === 'cloud'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLocalError('')
    try {
      if (cloud) {
        if (tab === 'signin') {
          if (!email.trim() || !passphrase) {
            setLocalError('Enter your email and password.')
            return
          }
          await signIn(email.trim(), passphrase)
        } else {
          if (passphrase.length < 8) {
            setLocalError('Choose a password of at least 8 characters.')
            return
          }
          if (passphrase !== confirm) {
            setLocalError('Passwords do not match.')
            return
          }
          if (!name.trim()) {
            setLocalError('Enter your name.')
            return
          }
          await signUp({ name: name.trim(), email: email.trim(), affiliation: affiliation.trim() }, passphrase)
        }
      } else {
        if (tab === 'signup') {
          if (passphrase.length < 8) {
            setLocalError('Choose a passphrase of at least 8 characters.')
            return
          }
          if (passphrase !== confirm) {
            setLocalError('Passphrases do not match.')
            return
          }
          if (!name.trim()) {
            setLocalError('Enter your name.')
            return
          }
          await create({ name: name.trim(), email: email.trim(), affiliation: affiliation.trim() }, passphrase)
        } else {
          await unlock(passphrase)
        }
      }
    } catch (e2) {
      setLocalError(e2 instanceof Error ? e2.message : 'Something went wrong.')
    }
  }

  async function provider(p: 'google' | 'azure') {
    setLocalError('')
    try {
      await signInWithProvider(p)
    } catch (e2) {
      setLocalError(e2 instanceof Error ? e2.message : 'Sign-in failed.')
    }
  }

  return (
    <div className="ws-auth-wrap">
      <form className="ws-auth" onSubmit={submit} aria-label={cloud ? (tab === 'signin' ? 'Sign in' : 'Create account') : tab === 'signup' ? 'Create workspace' : 'Unlock workspace'}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ff4203', margin: '0 0 0.5rem' }}>
          PubRooter Workspace
        </p>
        <h1>
          {cloud
            ? tab === 'signin'
              ? 'Sign in to PubRooter'
              : 'Create your PubRooter account'
            : tab === 'signup'
              ? 'Create your research workspace'
              : 'Unlock your workspace'}
        </h1>
        <p className="ws-sub">
          {cloud
            ? 'One account works across Colabwize and PubRooter. Your research workspace is created automatically on first sign-in.'
            : tab === 'signup'
              ? 'Your workspace is encrypted with your passphrase and stored only in this browser. Manuscripts never leave this device except for metadata queries to OpenAlex and Crossref.'
              : 'Enter the passphrase you chose when creating this workspace.'}
        </p>

        {cloud && (
          <>
            <a
              className="ws-provider ws-provider-colabwize"
              href={colabwizeHandoffUrl()}
              style={{ textDecoration: 'none' }}
            >
              <img src="/Colabwize-logo.png" alt="" width="22" height="22" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
              <span>Continue with Colabwize</span>
            </a>

            <div className="ws-provider-row">
              <button type="button" className="ws-provider" onClick={() => void provider('google')} disabled={busy}>
                <GoogleIcon />
                <span>Google</span>
              </button>
              <button type="button" className="ws-provider" onClick={() => void provider('azure')} disabled={busy}>
                <MicrosoftIcon />
                <span>Microsoft</span>
              </button>
            </div>

            <Divider label="or sign in with email" />
          </>
        )}

        {tab === 'signup' && (
          <>
            <label className="ws-field">
              <span className="ws-label">Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Ada Lovelace" autoComplete="name" required />
            </label>
            <label className="ws-field">
              <span className="ws-label">Affiliation (optional)</span>
              <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="Department, Institution" />
            </label>
          </>
        )}

        <label className="ws-field">
          <span className="ws-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.edu"
            autoComplete="email"
            required
          />
        </label>

        <label className="ws-field">
          <span className="ws-label">{cloud ? 'Password' : 'Passphrase'}</span>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            required
          />
          <span className="ws-hint">
            {cloud
              ? 'Same password you use for Colabwize. Forgot it? Reset it from your Colabwize account settings.'
              : 'Minimum 8 characters. Never transmitted anywhere. There is no reset — forgetting it means starting a new workspace.'}
          </span>
        </label>

        {tab === 'signup' && (
          <label className="ws-field">
            <span className="ws-label">{cloud ? 'Confirm password' : 'Confirm passphrase'}</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        )}

        {(localError || error) && (
          <p role="alert" className="ws-error-box">
            {localError || error}
          </p>
        )}

        <button type="submit" className="ws-btn ws-btn-primary" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
          {busy
            ? 'Working…'
            : cloud
              ? tab === 'signin'
                ? 'Sign in'
                : 'Create account'
              : tab === 'signup'
                ? 'Create workspace'
                : 'Unlock'}
        </button>

        {cloud && tab === 'signup' && (
          <p className="ws-hint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            Already have a Colabwize account? Just sign in — your account works here too.
          </p>
        )}
        {cloud && tab === 'signin' && (
          <p className="ws-hint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            New to PubRooter? Create an account — it will also work on Colabwize.
          </p>
        )}
        {!cloud && exists && tab === 'signup' && (
          <button type="button" className="ws-auth-toggle" onClick={() => { setTab('signin'); setLocalError('') }}>
            A workspace already exists on this device — unlock it instead
          </button>
        )}
        {!cloud && !exists && tab === 'signin' && (
          <button type="button" className="ws-auth-toggle" onClick={() => { setTab('signup'); setLocalError('') }}>
            No workspace yet — create one
          </button>
        )}
        {cloud && (
          <button type="button" className="ws-auth-toggle" onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setLocalError('') }}>
            {tab === 'signin' ? 'Create an account' : 'I already have an account — sign in'}
          </button>
        )}
        {!cloud && (
          <p className="ws-hint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            Local mode — cloud sign-in (Colabwize / Google / Microsoft) activates when Supabase keys are configured.
          </p>
        )}
      </form>
    </div>
  )
}
