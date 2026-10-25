import { useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import '../../workspace/workspace.css'
import { AuthScreen } from './AuthScreen'
import { Overview } from './Overview'
import { ManuscriptsView } from './ManuscriptsView'
import { NewManuscript } from './NewManuscript'
import { ManuscriptDetail } from './ManuscriptDetail'
import { ReadinessView } from './ReadinessView'
import { SavedJournalsView } from './SavedJournalsView'
import { ReportsView } from './ReportsView'
import { SettingsView } from './SettingsView'
import { PipelineView } from './PipelineView'
import { FindJournalsView } from './FindJournalsView'
import { SubmissionPrepView } from './SubmissionPrepView'

export type WorkspaceView =
  | { name: 'overview' }
  | { name: 'manuscripts' }
  | { name: 'new' }
  | { name: 'project'; id: string }
  | { name: 'readiness' }
  | { name: 'saved' }
  | { name: 'settings' }
  | { name: 'pipeline' }
  | { name: 'find-journals' }
  | { name: 'submission-prep'; id: string }

const NAV: { key: string; label: string; icon: JSX.Element }[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    key: 'manuscripts',
    label: 'My Manuscripts',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M15 2v5h5" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    )
  },
  {
    key: 'readiness',
    label: 'Readiness Checks',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 11l2.5 2.5L16 8" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    )
  },
  {
    key: 'saved',
    label: 'Saved Journals',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 3h12v18l-6-4.5L6 21z" />
      </svg>
    )
  },
  {
    key: 'pipeline',
    label: 'Publication Pipeline',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M9 4v17M15 8h4M15 12h4" />
      </svg>
    )
  },
  {
    key: 'find-journals',
    label: 'Find Journals',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    )
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </svg>
    )
  }
] as const

function Shell({ onNavigate }: { onNavigate: (v: 'finder' | 'home') => void }) {
  const { status, profile, data, lock } = useWorkspace()
  const [view, setView] = useState<WorkspaceView>({ name: 'overview' })

  if (status === 'unlocked' && !data) return null
  if (status !== 'unlocked' || !data || !profile) return <AuthScreen />

  function go(v: WorkspaceView) {
    setView(v)
    window.scrollTo({ top: 0 })
  }

  const activeKey =
    view.name === 'project' || view.name === 'new'
      ? 'manuscripts'
      : view.name === 'pipeline'
        ? 'pipeline'
        : view.name === 'find-journals'
          ? 'find-journals'
          : (view.name as string)

  return (
    <div className="ws">
      <aside className="ws-side">
        <a
          className="ws-logo"
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            go({ name: 'overview' })
          }}
        >
          <span className="ws-logo-mark">PR</span>
          PubRooter
        </a>
        <nav className="ws-nav" aria-label="Workspace">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeKey === item.key ? 'active' : ''}
              onClick={() => go({ name: item.key } as WorkspaceView)}
              aria-current={activeKey === item.key ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ws-side-foot">
          <span className="ws-user-name">{profile.name}</span>
          <span className="ws-user-mail">{profile.email}</span>
          <button type="button" onClick={lock}>
            Lock workspace
          </button>
          <button type="button" onClick={() => onNavigate('finder')} style={{ borderColor: '#b3b3b3', color: '#333' }}>
            Find Journals ↗
          </button>
        </div>
      </aside>

      <main
        className={
          view.name === 'find-journals'
            ? 'ws-main ws-main-wide ws-main-flush'
            : view.name === 'overview'
              ? 'ws-main ws-main-wide'
              : 'ws-main'
        }
        id="main"
      >
        {view.name === 'overview' && <Overview go={go} openFinder={() => onNavigate('finder')} />}
        {view.name === 'manuscripts' && <ManuscriptsView go={go} />}
        {view.name === 'new' && <NewManuscript go={go} />}
        {view.name === 'project' && <ManuscriptDetail id={view.id} go={go} />}
        {view.name === 'readiness' && <ReadinessView go={go} />}
        {view.name === 'saved' && <SavedJournalsView />}
        {view.name === 'pipeline' && <PipelineView go={go} />}
        {view.name === 'find-journals' && <FindJournalsView />}
        {view.name === 'submission-prep' && <SubmissionPrepView project={{ id: view.id }} go={go} />}
        {view.name === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

export function WorkspaceApp({ onNavigate }: { onNavigate: (v: 'finder' | 'home') => void }) {
  // WorkspaceProvider is mounted at the app root (main.tsx) so auth state and
  // the Colabwize token handoff are handled before the workspace even opens.
  return <Shell onNavigate={onNavigate} />
}
