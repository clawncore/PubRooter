import React, { useEffect, useRef, useState } from 'react'
import type { View } from './types-nav'
import { SiteHeader, SiteFooter, type View as ChromeView } from './components/SiteChrome'
import { Home } from './pages/Home'
import { Finder } from './pages/Finder'
import { Sources } from './pages/Sources'
import { WorkspaceApp, SHELL_KEY } from './pages/workspace/WorkspaceApp'
import { JournalPortal } from './pages/JournalPortal'
import { ComparePortal } from './pages/ComparePortal'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { TermsOfUse } from './pages/TermsOfUse'
import { useWorkspace } from './workspace/WorkspaceContext'
import './landing.css'
import './App.css'

const NAV_KEY = 'pubrooter.nav.v1'

interface SavedNav {
  view: string
  projectId?: string
  journalId?: string
}

function readSavedNav(): SavedNav | null {
  try {
    const raw = sessionStorage.getItem(NAV_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.view === 'string') return parsed as SavedNav
  } catch {
    /* ignore broken state */
  }
  return null
}

function initialNav(): SavedNav {
  try {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (q.get('colabwize_auth') || q.get('oauth') || q.get('email_confirmed') || h.get('access_token')) {
      return { view: 'tool' }
    }
  } catch {
    /* no window. Ignore */
  }
  return readSavedNav() ?? { view: 'home' }
}

export default function App() {
  const { data } = useWorkspace()
  const [initial] = useState(initialNav)
  const [view, setView] = useState<View>(initial.view as View)
  const [draft, setDraft] = useState<any>(null)
  const restoreTried = useRef(false)

  function navigate(v: string, d?: any) {
    if (d !== undefined) setDraft(d)
    else if (v !== 'tool') setDraft(null)
    setView(v as View)
    window.scrollTo({ top: 0 })
  }

  // Persist the current view so a refresh returns to where the user was.
  // This runs as an effect (not inside navigate) so it also covers the
  // initial view restored from the handoff URL or a previous session.
  useEffect(() => {
    try {
      const prev = readSavedNav()
      const sameView = prev?.view === view
      const nav: SavedNav = { view }
      const projectId = draft?.project?.id ?? (sameView ? prev?.projectId : undefined)
      const journalId = draft?.selectedJournal?.id ?? (sameView ? prev?.journalId : undefined)
      if (projectId) nav.projectId = projectId
      if (journalId) nav.journalId = journalId
      sessionStorage.setItem(NAV_KEY, JSON.stringify(nav))
    } catch {
      /* storage unavailable. Ignore */
    }
  }, [view, draft])

  // The journal-portal / compare drafts are in-memory only;
  // rebuild them from workspace data after a refresh (or when the session loads).
  useEffect(() => {
    const portalView = view === 'journal-portal' || view === 'compare'
    if (restoreTried.current || !portalView || draft) return
    if (!data) return
    if (!initial.projectId) {
      // Nothing to restore from. Go back to the workspace.
      navigate('tool')
      return
    }
    restoreTried.current = true
    const project = data.projects.find((p) => p.id === initial.projectId)
    if (!project) {
      navigate('tool')
      return
    }
    if (view === 'compare') {
      setDraft({ project })
      return
    }
    const match = project.analysis?.matches.find((m) => m.journal.id === initial.journalId)
    if (match) {
      setDraft({ project, selectedJournal: match.journal })
    } else {
      // Saved project/journal no longer exists. Fall back to the workspace.
      navigate('tool')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, draft, data])

  const chromeViews: View[] = ['home', 'finder', 'sources']
  const portalReady = view === 'journal-portal' && draft?.project && draft?.selectedJournal
  const compareReady = view === 'compare' && draft?.project

  return (
    <>
      {chromeViews.includes(view) && <SiteHeader view={view as ChromeView} onNavigate={navigate} />}
      {view === 'home' && <Home onNavigate={navigate} />}
      {view === 'finder' && (
        <Finder
          onNavigate={navigate}
          onStartUpload={() => {
            // Public finder → upload wizard. Stash the target view so sign-in
            // lands straight on the manuscript upload, not the overview.
            try {
              sessionStorage.setItem(SHELL_KEY, JSON.stringify({ name: 'new' }))
            } catch {
              /* storage unavailable — workspace will restore its last view */
            }
            navigate('tool')
          }}
        />
      )}
      {view === 'sources' && <Sources />}
      {view === 'tool' && <WorkspaceApp onNavigate={navigate} />}
      {view === 'journal-portal' && portalReady && (
        <JournalPortal
          project={draft.project}
          selectedJournal={draft.selectedJournal}
          onNavigate={navigate}
        />
      )}
      {/* While the portal draft is being restored (or the session is locked),
          keep the workspace mounted so auth and navigation keep working. */}
      {view === 'journal-portal' && !portalReady && <WorkspaceApp onNavigate={navigate} />}
      {view === 'compare' && compareReady && (
        <ComparePortal project={draft.project} onNavigate={navigate} />
      )}
      {view === 'compare' && !compareReady && <WorkspaceApp onNavigate={navigate} />}
      {view === 'privacy' && <PrivacyPolicy onBack={() => navigate('home')} onTerms={() => navigate('terms')} />}
      {view === 'terms' && <TermsOfUse onBack={() => navigate('home')} onPrivacy={() => navigate('privacy')} />}
      {chromeViews.includes(view) && <SiteFooter onNavigate={navigate} />}
    </>
  )
}
