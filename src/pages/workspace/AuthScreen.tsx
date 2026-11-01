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

function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="m1 1 22 22" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
  const [notice, setNotice] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const cloud = mode === 'cloud'

  function switchTab(next: 'signin' | 'signup') {
    setTab(next)
    setLocalError('')
    setNotice(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLocalError('')
    setNotice(null)
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
          const result = await signUp(
            { name: name.trim(), email: email.trim(), affiliation: affiliation.trim() },
            passphrase
          )
          if (result?.needsConfirmation) {
            setNotice(
              `We've sent a confirmation link to ${result.email}. Check your inbox, then sign in here.`
            )
            return
          }
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
      const msg = e2 instanceof Error ? e2.message : 'Something went wrong.'
      if (cloud && tab === 'signup' && /already registered|already exists/i.test(msg)) {
        setLocalError('An account with this email already exists. Sign in instead.')
        setTab('signin')
        return
      }
      setLocalError(msg)
    }
  }

  async function provider(p: 'google' | 'azure') {
    setLocalError('')
    setNotice(null)
    try {
      await signInWithProvider(p)
    } catch (e2) {
      setLocalError(e2 instanceof Error ? e2.message : 'Sign-in failed.')
    }
  }

  const headline = cloud
    ? tab === 'signin'
      ? 'Welcome back'
      : 'Create your account'
    : tab === 'signup'
      ? 'Create your research workspace'
      : 'Unlock your workspace'

  return (
    <div className="ws-auth-wrap">
      <form
        className="ws-auth"
        onSubmit={submit}
        aria-label={cloud ? (tab === 'signin' ? 'Sign in' : 'Create account') : tab === 'signup' ? 'Create workspace' : 'Unlock workspace'}
      >
        <div className="ws-auth-brand">
          <span className="ws-auth-mark" aria-hidden="true">PR</span>
          <span>PubRooter</span>
        </div>

        <h1>{headline}</h1>
        <p className="ws-sub">
          {cloud
            ? 'One account works across Colabwize and PubRooter. Your research workspace is created automatically on first sign-in.'
            : tab === 'signup'
              ? 'Your workspace is encrypted with your passphrase and stored only in this browser. Manuscripts never leave this device except for metadata queries to OpenAlex and Crossref.'
              : 'Enter the passphrase you chose when creating this workspace.'}
        </p>

        {cloud && (
          <div className="ws-auth-tabs" role="tablist" aria-label="Sign in or create account">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signin'}
              className={tab === 'signin' ? 'active' : ''}
              onClick={() => switchTab('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              className={tab === 'signup' ? 'active' : ''}
              onClick={() => switchTab('signup')}
            >
              Create account
            </button>
          </div>
        )}

        {notice && (
          <p className="ws-notice" role="status">
            {notice}{' '}
            <button type="button" className="ws-notice-action" onClick={() => switchTab('signin')}>
              Go to sign in
            </button>
          </p>
        )}
        {(localError || error) && (
          <p role="alert" className="ws-error-box">
            {localError || error}
          </p>
        )}

        {cloud && (
          <div className="ws-providers">
            <a className="ws-provider ws-provider-primary" href={colabwizeHandoffUrl()}>
              <img src="/Colabwize-logo.png" alt="" width="18" height="18" style={{ height: 18, width: 'auto', objectFit: 'contain' }} />
              <span>Continue with Colabwize</span>
            </a>
            <button type="button" className="ws-provider" onClick={() => void provider('google')} disabled={busy}>
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
            <button type="button" className="ws-provider" onClick={() => void provider('azure')} disabled={busy}>
              <MicrosoftIcon />
              <span>Continue with Microsoft</span>
            </button>
          </div>
        )}

        {cloud && (
          <div className="ws-auth-divider">
            <span>or continue with email</span>
          </div>
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
          <div className="ws-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              className="ws-input-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          <span className="ws-hint">
            {cloud
              ? 'Same password you use for Colabwize. Forgot it? Reset it from your Colabwize account settings.'
              : 'Minimum 8 characters. Never transmitted anywhere. There is no reset. Forgetting it means starting a new workspace.'}
          </span>
        </label>

        {tab === 'signup' && (
          <label className="ws-field">
            <span className="ws-label">{cloud ? 'Confirm password' : 'Confirm passphrase'}</span>
            <div className="ws-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </label>
        )}

        <button
          type="submit"
          className="ws-btn ws-btn-primary ws-auth-submit"
          disabled={busy}
        >
          {busy
            ? cloud
              ? tab === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : tab === 'signup'
                ? 'Creating workspace…'
                : 'Unlocking…'
            : cloud
              ? tab === 'signin'
                ? 'Sign in'
                : 'Create account'
              : tab === 'signup'
                ? 'Create workspace'
                : 'Unlock'}
        </button>

        {!cloud && exists && tab === 'signup' && (
          <button type="button" className="ws-auth-toggle" onClick={() => { switchTab('signin') }}>
            A workspace already exists on this device. Unlock it instead
          </button>
        )}
        {!cloud && !exists && tab === 'signin' && (
          <button type="button" className="ws-auth-toggle" onClick={() => { switchTab('signup') }}>
            No workspace yet. Create one
          </button>
        )}
        {!cloud && (
          <p className="ws-hint" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            Local mode. Cloud sign-in (Colabwize / Google / Microsoft) activates when Supabase keys are configured.
          </p>
        )}
      </form>
    </div>
  )
}
