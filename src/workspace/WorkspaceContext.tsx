import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createWorkspace, loadWorkspace, saveWorkspace, verifyPassphrase, workspaceExists, deleteWorkspace } from './crypto'
import { logActivity } from './activity'
import { emptyWorkspace, type ActivityEvent, type WorkspaceData, type WorkspaceProfile } from './types'
import { uid } from '../lib/storage'
import { supabase, isCloud, COLABWIZE_URL } from '../lib/supabase'
import { deleteFile as deleteStoredFile } from './storage'
import {
  loadWorkspaceCloud,
  saveProfileCloud,
  upsertProjectCloud,
  deleteProjectCloud,
  saveSavedJournalsCloud,
  appendActivityCloud,
  importColabwizeDrafts
} from './cloud'

interface WorkspaceContextValue {
  mode: 'local' | 'cloud'
  status: 'checking' | 'locked' | 'unlocked'
  exists: boolean
  profile: WorkspaceProfile | null
  data: WorkspaceData | null
  busy: boolean
  error: string | null
  create: (profile: WorkspaceProfile, passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  wipe: () => void
  update: (fn: (ws: WorkspaceData) => WorkspaceData) => Promise<void>
  log: (kind: ActivityEvent['kind'], detail: string, projectId?: string) => void
  // Cloud (Colabwize shared account) methods
  signIn: (email: string, password: string) => Promise<void>
  signUp: (profile: WorkspaceProfile, password: string) => Promise<void>
  signInWithProvider: (provider: 'google' | 'azure') => Promise<void>
  signOut: () => Promise<void>
  importFromColabwize: () => Promise<number>
}

const Ctx = createContext<WorkspaceContextValue | null>(null)

// Analysis runs live only in memory: if a project is still marked busy when the
// workspace loads, the run was interrupted (closed tab / reload) — surface it as
// retryable instead of showing a progress banner forever. updatedAt is left
// untouched so this recovery stays derived on every load.
function recoverInterrupted(ws: WorkspaceData): WorkspaceData {
  const busy = (s: string) => s === 'extracting' || s === 'matching' || s === 'generating'
  if (!ws.projects.some((p) => busy(p.status))) return ws
  return {
    ...ws,
    projects: ws.projects.map((p) =>
      busy(p.status)
        ? { ...p, status: 'failed' as const, error: p.error ?? 'This run was interrupted when the workspace closed — retry it to finish.' }
        : p
    )
  }
}

const LEGACY_SAVED_KEY = 'pubrooter.savedJournals.v1'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>(isCloud ? 'checking' : 'checking')
  // Ref mirror so the auth listener (mounted once) never reads a stale status.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passphraseRef = useRef<string | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  // Cloud sync bookkeeping
  const syncedActivityIds = useRef<Set<string>>(new Set())
  const syncedProjectUpdates = useRef<Map<string, string>>(new Map()) // id -> updatedAt
  const syncedSavedKey = useRef<string>('')
  const syncedProfileKey = useRef<string>('')

  /* ---------------- Colabwize token handoff ---------------- */
  useEffect(() => {
    if (!isCloud || !supabase) return
    const sb = supabase
    const apply = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const search = new URLSearchParams(window.location.search)
      const pick = (k: string) => hash.get(k) ?? search.get(k)
      const access = pick('access_token')
      const refresh = pick('refresh_token')
      const hasColabwizeParam = search.get('colabwize_auth') === '1'
      console.debug('[PubRooter] Colabwize handoff check:', {
        hasHash: !!window.location.hash,
        hashKeys: Array.from(hash.keys()),
        searchKeys: Array.from(search.keys()),
        hasAccessToken: !!access,
        hasRefreshToken: !!refresh,
        hasColabwizeParam,
        url: window.location.href
      })
      if (access && refresh) {
        console.debug('[PubRooter] Calling setSession with tokens')
        const { error: sessErr } = await sb.auth.setSession({ access_token: access, refresh_token: refresh })
        if (sessErr) {
          console.error('[PubRooter] setSession error:', sessErr.message)
          setError(sessErr.message)
        } else {
          console.debug('[PubRooter] setSession succeeded')
        }
        window.history.replaceState({}, '', window.location.pathname)
      } else if (hasColabwizeParam) {
        console.warn('[PubRooter] colabwize_auth=1 present but NO tokens in URL - Colabwize did not hand back session. Check Colabwize externalAuthHandback() is deployed and redirect URL is allowlisted.')
      }
    }
    void apply()
  }, [])

  /* ---------------- Cloud auth state ---------------- */
  useEffect(() => {
    if (!isCloud || !supabase) {
      setStatus(workspaceExists() ? 'locked' : 'locked')
      return
    }

    let cancelled = false

    async function loadForUser() {
      try {
        const ws = recoverInterrupted(await loadWorkspaceCloud())
        if (cancelled) return
        setData(ws)
        syncedActivityIds.current = new Set(ws.activity.map((a) => a.id))
        syncedProjectUpdates.current = new Map(ws.projects.map((p) => [p.id, p.updatedAt]))
        syncedSavedKey.current = savedKey(ws)
        syncedProfileKey.current = profileKey(ws)
        setStatus('unlocked')
        // Auto-import Colabwize drafts (best-effort)
        try {
          const n = await importColabwizeDrafts()
          if (n > 0) {
            const fresh = await loadWorkspaceCloud()
            if (cancelled) return
            setData(
              recoverInterrupted({
                ...fresh,
                activity: [
                  {
                    id: uid(),
                    at: new Date().toISOString(),
                    kind: 'project',
                    detail: `Imported ${n} draft(s) from Colabwize.`
                  },
                  ...fresh.activity
                ]
              })
            )
          }
        } catch {
          /* bridge table may not exist yet */
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load workspace')
          setStatus('locked')
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) void loadForUser()
      else setStatus('locked')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (!session) {
        passphraseRef.current = null
        setData(null)
        setStatus('locked')
      } else if (statusRef.current !== 'unlocked') {
        void loadForUser()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- Local (passphrase) persistence ---------------- */
  const persistLocal = useCallback(async (ws: WorkspaceData) => {
    const pass = passphraseRef.current
    if (!pass) return
    try {
      await saveWorkspace(ws, pass)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save workspace')
    }
  }, [])

  /* ---------------- Cloud persistence (diff-based) ---------------- */
  function savedKey(ws: WorkspaceData): string {
    return ws.savedJournals.map((s) => `${s.id}:${s.note ?? ''}`).join('|')
  }
  function profileKey(ws: WorkspaceData): string {
    return JSON.stringify([ws.profile, ws.defaultPreferences])
  }

  // Diffs against the last-synced markers (never against a previous snapshot):
  // a later debounced save cancels earlier timers, so snapshot-diffing would
  // silently drop changes that landed between two cancelled persists.
  const persistCloud = useCallback(async (next: WorkspaceData) => {
    try {
      const tasks: Promise<void>[] = []

      if (profileKey(next) !== syncedProfileKey.current) {
        tasks.push(saveProfileCloud(next.profile, next.defaultPreferences))
      }

      for (const p of next.projects) {
        if (syncedProjectUpdates.current.get(p.id) !== p.updatedAt) tasks.push(upsertProjectCloud(p))
      }
      for (const id of syncedProjectUpdates.current.keys()) {
        if (!next.projects.some((p) => p.id === id)) tasks.push(deleteProjectCloud(id))
      }

      if (savedKey(next) !== syncedSavedKey.current) {
        tasks.push(saveSavedJournalsCloud(next.savedJournals))
      }

      const newEvents = next.activity.filter((e) => !syncedActivityIds.current.has(e.id))
      if (newEvents.length > 0) tasks.push(appendActivityCloud(newEvents))

      await Promise.all(tasks)

      syncedActivityIds.current = new Set(next.activity.map((a) => a.id))
      syncedProjectUpdates.current = new Map(next.projects.map((p) => [p.id, p.updatedAt]))
      syncedSavedKey.current = savedKey(next)
      syncedProfileKey.current = profileKey(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save workspace')
    }
  }, [])

  /* ---------------- Shared update() ---------------- */
  // Serializes cloud persists so two debounced saves never run concurrently
  // (concurrent runs could resend the same activity event / saved rows).
  const persistChainRef = useRef<Promise<void>>(Promise.resolve())
  const update = useCallback(
    async (fn: (ws: WorkspaceData) => WorkspaceData) => {
      setData((prev) => {
        if (!prev) return prev
        const next = fn(prev)
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          const run = () => (isCloud ? persistCloud(next) : persistLocal(next))
          persistChainRef.current = persistChainRef.current.then(run)
        }, 250)
        return next
      })
    },
    [persistCloud, persistLocal]
  )

  const log = useCallback(
    (kind: ActivityEvent['kind'], detail: string, projectId?: string) => {
      void update((ws) => logActivity(ws, kind, detail, projectId))
    },
    [update]
  )

  /* ---------------- Local mode methods ---------------- */
  const create = useCallback(async (profile: WorkspaceProfile, passphrase: string) => {
    setBusy(true)
    setError(null)
    try {
      if (passphrase.length < 8) throw new Error('Choose a passphrase of at least 8 characters.')
      if (!profile.email.trim()) throw new Error('Email is required.')
      await createWorkspace(passphrase, profile)
      passphraseRef.current = passphrase
      let ws = emptyWorkspace(profile)
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_SAVED_KEY) ?? '[]') as { id: string; title: string; publisher?: string; issn?: string }[]
        if (Array.isArray(legacy) && legacy.length > 0) {
          ws = {
            ...ws,
            savedJournals: legacy.map((l) => ({
              id: uid(),
              savedAt: new Date().toISOString(),
              journalId: l.id,
              title: l.title,
              publisher: l.publisher,
              issn: l.issn
            }))
          }
          ws = logActivity(ws, 'save', `Imported ${legacy.length} saved journal(s) from the public finder.`)
        }
      } catch {
        /* legacy import is best-effort */
      }
      ws = logActivity(ws, 'settings', 'Workspace created.')
      await saveWorkspace(ws, passphrase)
      setData(ws)
      setStatus('unlocked')
    } finally {
      setBusy(false)
    }
  }, [])

  const unlock = useCallback(async (passphrase: string) => {
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyPassphrase(passphrase)
      if (!ok) throw new Error('Incorrect passphrase.')
      const ws = recoverInterrupted(await loadWorkspace(passphrase))
      passphraseRef.current = passphrase
      setData(ws)
      setStatus('unlocked')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock workspace')
      throw e
    } finally {
      setBusy(false)
    }
  }, [])

  const lock = useCallback(() => {
    if (isCloud) {
      void supabase?.auth.signOut()
      return
    }
    passphraseRef.current = null
    setData(null)
    setStatus('locked')
  }, [])

  const wipe = useCallback(() => {
    if (data) {
      // Stored PDFs (private bucket in cloud mode, IndexedDB locally) go with the workspace.
      for (const p of data.projects) {
        if (p.hasStoredFile) void deleteStoredFile(p.id).catch(() => {})
      }
    }
    if (isCloud && data) {
      // Delete all rows, keep account
      void (async () => {
        for (const p of data.projects) await deleteProjectCloud(p.id).catch(() => {})
        await saveSavedJournalsCloud([]).catch(() => {})
        setData(null)
        setStatus('locked')
      })()
      return
    }
    deleteWorkspace()
    passphraseRef.current = null
    setData(null)
    setStatus('locked')
  }, [data])

  /* ---------------- Cloud auth methods ---------------- */
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud backend not configured.')
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw new Error(err.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const signUp = useCallback(async (profile: WorkspaceProfile, password: string) => {
    if (!supabase) throw new Error('Cloud backend not configured.')
    setBusy(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/?email_confirmed=1`
      const { error: err } = await supabase.auth.signUp({
        email: profile.email,
        password,
        options: {
          data: { name: profile.name, affiliation: profile.affiliation },
          emailRedirectTo: redirectTo
        }
      })
      if (err) throw new Error(err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const signInWithProvider = useCallback(async (provider: 'google' | 'azure') => {
    if (!supabase) throw new Error('Cloud backend not configured.')
    setError(null)
    // Same Supabase project as Colabwize — providers must be enabled there.
    // Browser navigates away to the provider; busy stays set until redirect.
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/?oauth=1`,
        ...(provider === 'azure' ? { scopes: 'openid profile email' } : {})
      }
    })
    if (err) {
      setBusy(false)
      throw new Error(err.message)
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const importFromColabwize = useCallback(async () => {
    const n = await importColabwizeDrafts()
    if (n > 0) {
      const fresh = await loadWorkspaceCloud()
      setData(fresh)
    }
    return n
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      mode: isCloud ? 'cloud' : 'local',
      status,
      exists: isCloud ? true : workspaceExists(),
      profile: data?.profile ?? null,
      data,
      busy,
      error,
      create,
      unlock,
      lock,
      wipe,
      update,
      log,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      importFromColabwize
    }),
    [status, data, busy, error, create, unlock, lock, wipe, update, log, signIn, signUp, signInWithProvider, signOut, importFromColabwize]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkspace outside provider')
  return v
}

export { COLABWIZE_URL }
