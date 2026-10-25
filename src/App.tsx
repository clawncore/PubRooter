import React, { useState } from 'react'
import { AuthProvider, useAuth } from './components/AuthProvider'
import { SessionManager } from './lib/session-manager'
import type { View } from './types-nav'
import { SiteHeader, SiteFooter } from './components/SiteChrome'
import { Home } from './pages/Home'
import { Finder } from './pages/Finder'
import { Sources } from './pages/Sources'
import { WorkspaceApp } from './pages/workspace/WorkspaceApp'
import { JournalPortal } from './pages/JournalPortal'
import { SubmissionPrepView } from './pages/workspace/SubmissionPrepView'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { TermsOfUse } from './pages/TermsOfUse'
import './landing.css'
import './App.css'

function initialView(): View {
  try {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (q.get('colabwize_auth') || q.get('oauth') || q.get('email_confirmed') || h.get('access_token')) return 'tool'
  } catch {
    /* no window — ignore */
  }
  return 'home'
}

function initialDraft(): any {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('colabwize_auth') === '1') {
      // Return draft data for Colabwize handoff
      return {
        project: {
          id: 'colabwize-draft',
          name: 'Colabwize Import',
          createdAt: new Date().toISOString(),
          manuscript: { title: '', abstract: '', keywords: [], field: '', articleType: '', objectives: '', methods: '', sections: [], entities: [], referenceCount: 0, wordCount: 0, pageCount: 0, extractionWarnings: [] },
          edited: { title: '', abstract: '', keywords: [], field: '', articleType: '', objectives: '', methods: '', sections: [], entities: [], referenceCount: 0, wordCount: 0, pageCount: 0, extractionWarnings: [] },
          preferences: {
            subjectArea: '',
            oaPreferred: false,
            apcMaxUsd: null,
            articleType: '',
            preferredPublisher: '',
            indexingRequired: [],
            excludedJournals: []
          },
          analysis: null,
          audits: [],
          selectedJournalId: null,
          comparedJournalIds: [],
          actionsCompleted: [],
          submissions: []
        },
        selectedJournal: null
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function LoginPage() {
  const { login, register, loginWithProvider, isLoading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        if (!name.trim()) {
          setError('Name is required')
          return
        }
        await register(email, password, name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  const handleProviderLogin = async (provider: 'google' | 'azure') => {
    setError('')
    try {
      await loginWithProvider(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Login with ${provider} failed`)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>PubRooter</h1>
          <p>Research Publication Platform</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />

            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="social-auth">
          <button
            onClick={() => handleProviderLogin('google')}
            className="social-btn"
            disabled={isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v13.5h5.56c-1.26.85-2.78 1.34-4.56 1.34-3.58 0-6.48-2.42-7.56-5.68l-1.3 1.3-1.3-1.3c1.84-2.34 4.42-3.78 7.18-3.78 4.82 0 8.89 3.26 11.64 8.27z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-6.52-5.34c-1.46 1.08-3.33 1.72-5.42 1.72-4.16 0-7.69-2.8-8.94-6.74l-1.42 1.1 1.42 1.1c2.25 3.94 5.78 6.48 9.74 6.48z"/>
             иновная ошибка
              <path fill="#FBBC05" d="M5.84 14.36c-.21-.63-.32-1.3-.32-1.96 0-1.21.12-2.39.35-3.54l-3.06-2.38C1.68 7.61 1 9.77 1 12.18c0 2.41.88 4.57 2.32 6.18l3.52-2.82z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.13-3.13C17.27 1.69 14.66 0.42 12 0.42 4.96 0 1.86 2.54 0.67 6.12l3.13 2.44c.92-2.93 3.59-5.24 7.06-5.24z"/>
            </svg>
            Sign in with Google
          </button>

          <button
            onClick={() => handleProviderLogin('azure')}
            className="social-btn"
            disabled={isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="#0078d4"/>
              <path fill="white" d="M4 4h8v16H4z"/>
              <path fill="white" d="M12 4h8v8h-8z"/>
              <path fill="white" d="M12 12h8v8h-8z"/>
            </svg>
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const [draft, setDraft] = useState<any>(initialDraft)

  function navigate(v: View, d?: any) {
    if (d !== undefined) setDraft(d)
    else if (v !== 'tool') setDraft(null)
    setView(v)
    window.scrollTo({ top: 0 })
  }

  const chromeViews: View[] = ['home', 'finder', 'sources']

  return (
    <AuthProvider>
      <>
        {chromeViews.includes(view) && <SiteHeader view={view} onNavigate={navigate} />}
        {view === 'home' && <Home onNavigate={navigate} />}
        {view === 'finder' && <Finder onNavigate={navigate} />}
        {view === 'sources' && <Sources />}
        {view === 'tool' && <WorkspaceApp onNavigate={navigate} />}
        {view === 'journal-portal' && draft?.project && draft?.selectedJournal && (
          <JournalPortal
            project={draft.project}
            selectedJournal={draft.selectedJournal}
            onNavigate={navigate}
          />
        )}
        {view === 'privacy' && <PrivacyPolicy onBack={() => navigate('home')} onTerms={() => navigate('terms')} />}
        {view === 'terms' && <TermsOfUse onBack={() => navigate('home')} onPrivacy={() => navigate('privacy')} />}
        {chromeViews.includes(view) && <SiteFooter onNavigate={navigate} />}
      </>
    </AuthProvider>
  )
}