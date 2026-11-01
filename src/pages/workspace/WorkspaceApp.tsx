import { useEffect, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import '../../workspace/workspace.css'
import { AuthScreen } from './AuthScreen'
import { Overview } from './Overview'
import { ManuscriptsView } from './ManuscriptsView'
import { NewManuscript } from './NewManuscript'
import { ManuscriptDetail } from './ManuscriptDetail'
import { ReadinessDetail } from './ReadinessDetail'
import { ReportsView } from './ReportsView'
import { SettingsView } from './SettingsView'
import { PipelineView } from './PipelineView'
import { FindJournalsView } from './FindJournalsView'

export type WorkspaceView =
  | { name: 'overview' }
  | { name: 'manuscripts' }
  | { name: 'new' }
  | { name: 'project'; id: string }
  | { name: 'readiness'; id?: string }
  | { name: 'settings' }
  | { name: 'pipeline' }
  | { name: 'find-journals' }

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
    key: 'pipeline',
    label: 'Publications',
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

// Shared so the journal portal can hand the user back to a specific
// workspace view (e.g. Publications after exporting a package).
export const SHELL_KEY = 'pubrooter.shell.v1'

const KNOWN_VIEWS = new Set([
  'overview',
  'manuscripts',
  'new',
  'project',
  'readiness',
  'settings',
  'pipeline',
  'find-journals'
])

function initialShellView(): WorkspaceView {
  try {
    const raw = sessionStorage.getItem(SHELL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.name === 'string' && KNOWN_VIEWS.has(parsed.name)) return parsed as WorkspaceView
    }
  } catch {
    /* ignore broken state */
  }
  return { name: 'overview' }
}

// Shown while the session is being restored. Never flash the sign-in form at a
// user whose session is still loading (it reads as "logged out" and confuses
// both people and tests).
function BootScreen() {
  return (
    <div className="ws-boot" role="status" aria-live="polite">
      <div className="ws-boot-mark">PR</div>
      <div className="ws-boot-spin" aria-hidden="true" />
      <p>Restoring your workspace…</p>
    </div>
  )
}

function Shell({ onNavigate }: { onNavigate: (v: string, draft?: any) => void }) {
  const { status, profile, data, lock } = useWorkspace()
  const [view, setView] = useState<WorkspaceView>(initialShellView)

  // Readiness has two levels: a manuscript list (no id) and a per-manuscript
  // portal (id). If a stored id no longer resolves, fall back to the list.
  useEffect(() => {
    if (view.name !== 'readiness' || !data || !view.id) return
    if (data.projects.some((p) => p.id === view.id && p.analysis)) return
    go({ name: 'readiness' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data])

  if (status === 'checking' || (status === 'unlocked' && (!data || !profile))) return <BootScreen />
  if (status !== 'unlocked' || !data || !profile) return <AuthScreen />

  function go(v: WorkspaceView) {
    setView(v)
    try {
      sessionStorage.setItem(SHELL_KEY, JSON.stringify(v))
    } catch {
      /* storage unavailable. Ignore */
    }
    window.scrollTo({ top: 0 })
  }

  // Open the full journal portal for a project's target journal (falls back to
  // the best analysis match, then to the readiness page when nothing is known).
  function openPortal(projectId: string, journalId?: string) {
    const project = data?.projects.find((p) => p.id === projectId)
    if (!project) return
    const matches = project.analysis?.matches ?? []
    const match =
      (journalId ? matches.find((m) => m.journal.id === journalId) : undefined) ??
      matches[0] ??
      (project.audits[0] ? matches.find((m) => m.journal.id === project.audits[0].journalId) : undefined)
    if (match) {
      onNavigate('journal-portal', { project, selectedJournal: match.journal })
    } else {
      go({ name: 'readiness', id: projectId })
    }
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
            : view.name === 'overview' || view.name === 'project' || view.name === 'readiness' || view.name === 'pipeline'
              ? 'ws-main ws-main-wide'
              : 'ws-main'
        }
        id="main"
      >
        {view.name === 'overview' && (
          <Overview go={go} openFinder={() => go({ name: 'find-journals' })} openPortal={openPortal} />
        )}
        {view.name === 'manuscripts' && <ManuscriptsView go={go} />}
        {view.name === 'new' && <NewManuscript go={go} />}
        {view.name === 'project' && (
          <ManuscriptDetail
            id={view.id}
            go={go}
            openCompare={(project) => onNavigate('compare', { project })}
            openPortal={openPortal}
          />
        )}
        {view.name === 'readiness' && <ReadinessDetail id={view.id} go={go} openPortal={openPortal} />}
        {view.name === 'pipeline' && <PipelineView go={go} openPortal={openPortal} />}
        {view.name === 'find-journals' && <FindJournalsView go={go} />}
        {view.name === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

export function WorkspaceApp({ onNavigate }: { onNavigate: (v: string, draft?: any) => void }) {
  // WorkspaceProvider is mounted at the app root (main.tsx) so auth state and
  // the Colabwize token handoff are handled before the workspace even opens.
  return <Shell onNavigate={onNavigate} />
}
