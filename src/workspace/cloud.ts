import { supabase, isCloud } from '../lib/supabase'
import {
  emptyWorkspace,
  type ActivityEvent,
  type ManuscriptProject,
  type ResearchPreferences,
  type SavedJournalRecord,
  type WorkspaceData,
  type WorkspaceProfile
} from './types'
import type { SubmissionAttempt } from './submissions'
import { DEFAULT_PREFERENCES } from './types'

export { isCloud }

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  affiliation: string | null
  default_preferences: Record<string, unknown> | null
}

type ProjectRow = {
  id: string
  name: string
  file_name: string | null
  file_size: number | null
  status: string
  error: string | null
  extracted: ManuscriptProject['extracted']
  edited: ManuscriptProject['edited']
  preferences: Partial<ResearchPreferences> | null
  analysis: ManuscriptProject['analysis']
  selected_journal_id: string | null
  compared_journal_ids: string[] | null
  actions_completed: string[] | null
  source: string
  colabwize_draft_id: string | null
  created_at: string
  updated_at: string
}

type AuditRow = {
  id: string
  project_id: string
  journal_id: string | null
  journal_title: string | null
  run_at: string
  engine_version: string | null
  checks: ManuscriptProject['audits'][number]['checks'] | null
}

type AttemptRow = {
  id: string
  project_id: string
  attempt_number: number
  status: string
  target_journal_id: string | null
  target_journal_title: string | null
  official_portal_url: string | null
  external_manuscript_id: string | null
  submission_date: string | null
  corresponding_author_notes: string | null
  required_docs: SubmissionAttempt['requiredDocs'] | null
  readiness_audit_id: string | null
  decision: SubmissionAttempt['decision'] | null
  revision: SubmissionAttempt['revision'] | null
  rerouted_from_attempt_id?: string | null
  rerouted_from_journal_title?: string | null
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  attempt_id: string
  at: string
  type: string
  status: string | null
  note: string | null
}

type SavedRow = {
  id: string
  journal_id: string
  title: string
  publisher: string | null
  issn: string | null
  link: string | null
  score: number | null
  note: string | null
  saved_at: string
}

type ActivityRow = {
  id: string
  project_id: string | null
  kind: string
  detail: string
  at: string
}

function requireClient() {
  if (!supabase) throw new Error('Cloud backend not configured.')
  return supabase
}

export async function requireUserId(): Promise<string> {
  const sb = requireClient()
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) throw new Error('Not signed in.')
  return data.user.id
}

function mapProfile(row: ProfileRow): { profile: WorkspaceProfile; defaults: ResearchPreferences } {
  return {
    profile: {
      name: row.name ?? '',
      email: row.email ?? '',
      affiliation: row.affiliation ?? ''
    },
    defaults: { ...DEFAULT_PREFERENCES, ...(row.default_preferences as Partial<ResearchPreferences> | null) }
  }
}

function mapProject(
  row: ProjectRow,
  audits: ManuscriptProject['audits'],
  submissions: ManuscriptProject['submissions'] = []
): ManuscriptProject {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    fileName: row.file_name,
    fileSize: row.file_size,
    hasStoredFile: Boolean(row.file_name),
    status: row.status as ManuscriptProject['status'],
    error: row.error,
    extracted: row.extracted,
    edited: row.edited,
    preferences: { ...DEFAULT_PREFERENCES, ...(row.preferences as Partial<ResearchPreferences> | null) },
    analysis: row.analysis,
    audits,
    selectedJournalId: row.selected_journal_id,
    comparedJournalIds: row.compared_journal_ids ?? [],
    actionsCompleted: row.actions_completed ?? [],
    submissions
  }
}

export async function loadWorkspaceCloud(): Promise<WorkspaceData> {
  const sb = requireClient()
  const uid = await requireUserId()

  const [profileRes, projectsRes, auditsRes, savedRes, activityRes, attemptsRes, eventsRes] = await Promise.all([
    sb.from('pubrooter_profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('pubrooter_projects').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('pubrooter_readiness_audits').select('*').eq('user_id', uid).order('run_at', { ascending: true }),
    sb.from('pubrooter_saved_journals').select('*').eq('user_id', uid).order('saved_at', { ascending: false }),
    sb.from('pubrooter_activity_events').select('*').eq('user_id', uid).order('at', { ascending: false }).limit(200),
    // Attempts + events load in one pass. If the 0002 migration has not been
    // applied yet (tables missing), the query 404s. Treat that as "no
    // attempts" instead of failing the whole workspace.
    sb.from('pubrooter_submission_attempts').select('*').eq('user_id', uid).order('created_at', { ascending: true }).then((r) => (r.error && r.error.code === '42P01' ? { data: [] as AttemptRow[], error: null } : r)),
    sb.from('pubrooter_submission_events').select('*').eq('user_id', uid).order('at', { ascending: true }).then((r) => (r.error && r.error.code === '42P01' ? { data: [] as EventRow[], error: null } : r))
  ])

  if (profileRes.error) throw new Error(profileRes.error.message)
  if (projectsRes.error) throw new Error(projectsRes.error.message)
  if (auditsRes.error) throw new Error(auditsRes.error.message)
  if (savedRes.error) throw new Error(savedRes.error.message)
  if (activityRes.error) throw new Error(activityRes.error.message)
  if (attemptsRes.error) throw new Error(attemptsRes.error.message)
  if (eventsRes.error) throw new Error(eventsRes.error.message)

  const profileRow = profileRes.data
  if (!profileRow) {
    // Trigger should have created it; create defensively.
    const { data: auth } = await sb.auth.getUser()
    const email = auth.user?.email ?? ''
    const { error } = await sb.from('pubrooter_profiles').insert({ id: uid, email, name: '' })
    if (error) throw new Error(error.message)
  }

  const { profile, defaults } = mapProfile(
    profileRow ?? { id: uid, email: '', name: '', affiliation: '', default_preferences: null }
  )

  const auditsByProject = new Map<string, ManuscriptProject['audits']>()
  for (const a of (auditsRes.data ?? []) as AuditRow[]) {
    const list = auditsByProject.get(a.project_id) ?? []
    list.push({
      id: a.id,
      journalId: a.journal_id ?? '',
      journalTitle: a.journal_title ?? '',
      runAt: a.run_at,
      engineVersion: a.engine_version ?? '',
      checks: a.checks ?? []
    })
    auditsByProject.set(a.project_id, list)
  }

  const attemptsByProject = new Map<string, ManuscriptProject['submissions']>()
  const eventsByAttempt = new Map<string, SubmissionAttempt['events']>()
  for (const ev of (eventsRes.data ?? []) as EventRow[]) {
    const list = eventsByAttempt.get(ev.attempt_id) ?? []
    list.push({ id: ev.id, at: ev.at, type: ev.type as SubmissionAttempt['events'][number]['type'], status: (ev.status ?? undefined) as SubmissionAttempt['events'][number]['status'], note: ev.note ?? undefined })
    eventsByAttempt.set(ev.attempt_id, list)
  }
  for (const a of (attemptsRes.data ?? []) as AttemptRow[]) {
    const list = attemptsByProject.get(a.project_id) ?? []
    list.push({
      id: a.id,
      projectId: a.project_id,
      attemptNumber: a.attempt_number ?? 1,
      status: (a.status ?? 'draft') as SubmissionAttempt['status'],
      targetJournalId: a.target_journal_id ?? null,
      targetJournalTitle: a.target_journal_title ?? '',
      officialPortalUrl: a.official_portal_url ?? undefined,
      externalManuscriptId: a.external_manuscript_id ?? undefined,
      submissionDate: a.submission_date ?? null,
      correspondingAuthorNotes: a.corresponding_author_notes ?? undefined,
      requiredDocs: (a.required_docs ?? []) as SubmissionAttempt['requiredDocs'],
      readinessAuditId: a.readiness_audit_id ?? null,
      decision: a.decision ?? undefined,
      revision: a.revision ?? undefined,
      reroutedFromAttemptId: a.rerouted_from_attempt_id ?? null,
      reroutedFromJournalTitle: a.rerouted_from_journal_title ?? null,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      events: eventsByAttempt.get(a.id) ?? []
    })
    attemptsByProject.set(a.project_id, list)
  }

  const projects = ((projectsRes.data ?? []) as ProjectRow[]).map((r) =>
    mapProject(r, auditsByProject.get(r.id) ?? [], attemptsByProject.get(r.id) ?? [])
  )

  const savedJournals = ((savedRes.data ?? []) as SavedRow[]).map<SavedJournalRecord>((s) => ({
    id: s.id,
    savedAt: s.saved_at,
    journalId: s.journal_id,
    title: s.title,
    publisher: s.publisher ?? undefined,
    issn: s.issn ?? undefined,
    link: s.link ?? undefined,
    score: s.score ?? undefined,
    note: s.note ?? undefined
  }))

  const activity = ((activityRes.data ?? []) as ActivityRow[]).map<ActivityEvent>((e) => ({
    id: e.id,
    at: e.at,
    kind: e.kind as ActivityEvent['kind'],
    detail: e.detail,
    projectId: e.project_id ?? undefined
  }))

  return {
    ...emptyWorkspace(profile),
    projects,
    savedJournals,
    activity,
    defaultPreferences: defaults
  }
}

export async function saveProfileCloud(profile: WorkspaceData['profile'], defaults: ResearchPreferences): Promise<void> {
  const sb = requireClient()
  const uid = await requireUserId()
  const { error } = await sb
    .from('pubrooter_profiles')
    .upsert({ id: uid, email: profile.email, name: profile.name, affiliation: profile.affiliation, default_preferences: defaults })
  if (error) throw new Error(error.message)
}

export async function upsertProjectCloud(project: ManuscriptProject): Promise<void> {
  const sb = requireClient()
  const uid = await requireUserId()
  const { error } = await sb.from('pubrooter_projects').upsert({
    id: project.id,
    user_id: uid,
    name: project.name,
    file_name: project.fileName,
    file_size: project.fileSize,
    status: project.status,
    error: project.error,
    extracted: project.extracted,
    edited: project.edited,
    preferences: project.preferences,
    analysis: project.analysis,
    selected_journal_id: project.selectedJournalId,
    compared_journal_ids: project.comparedJournalIds,
    actions_completed: project.actionsCompleted,
    source: 'pubrooter',
    created_at: project.createdAt,
    updated_at: project.updatedAt
  })
  if (error) throw new Error(error.message)

  // Replace audits for this project (simple, correct; audits are small)
  await sb.from('pubrooter_readiness_audits').delete().eq('project_id', project.id)
  if (project.audits.length > 0) {
    const rows = project.audits.map((a) => ({
      id: a.id,
      project_id: project.id,
      user_id: uid,
      journal_id: a.journalId,
      journal_title: a.journalTitle,
      run_at: a.runAt,
      engine_version: a.engineVersion,
      checks: a.checks
    }))
    const { error: auditErr } = await sb.from('pubrooter_readiness_audits').insert(rows)
    if (auditErr) throw new Error(auditErr.message)
  }

  syncAttemptsCloud(project, uid)
}

/**
 * Attempt persistence is incremental. Only attempt ids whose persisted
 * updated_at differs from the in-memory record are written. The event
 * history is append-only: upsert by event id, never delete/reinsert, so
 * an interrupted save cannot erase earlier history.
 *
 * Called from upsertProjectCloud without await: attempt sync failures
 * must never fail the project save itself (the workspace update already
 * succeeded in memory). The error surface is setError via the caller's
 * persist chain instead.
 */
async function syncAttemptsCloud(project: ManuscriptProject, uid: string): Promise<void> {
  const sb = requireClient()
  if (project.submissions.length === 0) {
    // Only tear down server rows if the project truly has none left.
    const { data } = await sb.from('pubrooter_submission_attempts').select('id').eq('project_id', project.id)
    if (data && data.length > 0) {
      const ids = (data as { id: string }[]).map((d) => d.id)
      const rpcRes = await sb.rpc('pubrooter_delete_events_for_attempts', { attempt_ids: ids })
      void rpcRes
      await sb.from('pubrooter_submission_attempts').delete().eq('project_id', project.id)
    }
    return
  }

  const { data: existing, error: existingErr } = await sb
    .from('pubrooter_submission_attempts')
    .select('id, updated_at')
    .eq('project_id', project.id)
  if (existingErr) {
    if (existingErr.code === '42P01') return // 0002 migration not applied yet. Local mode still holds the data
    throw new Error(existingErr.message)
  }

  const known = new Map<string, string>((existing ?? []).map((r) => [r.id, r.updated_at]))

  // Event rows to upsert - only events the server has never seen (event ids
  // are client-stable, so an upsert is idempotent and never duplicates).
  const eventRows: { id: string; attempt_id: string; user_id: string; at: string; type: string; status: string | null; note: string | null }[] = []
  const attemptRows: Record<string, unknown>[] = []

  for (const a of project.submissions) {
    const serverUpdatedAt = known.get(a.id)
    const changed = !serverUpdatedAt || serverUpdatedAt !== a.updatedAt
    if (changed) {
      attemptRows.push({
        id: a.id,
        project_id: project.id,
        user_id: uid,
        attempt_number: a.attemptNumber,
        status: a.status,
        target_journal_id: a.targetJournalId,
        target_journal_title: a.targetJournalTitle,
        official_portal_url: a.officialPortalUrl ?? null,
        external_manuscript_id: a.externalManuscriptId ?? null,
        submission_date: a.submissionDate ?? null,
        corresponding_author_notes: a.correspondingAuthorNotes ?? null,
        required_docs: a.requiredDocs,
        readiness_audit_id: a.readinessAuditId ?? null,
        decision: a.decision ?? null,
        revision: a.revision ?? null,
        rerouted_from_attempt_id: a.reroutedFromAttemptId ?? null,
        rerouted_from_journal_title: a.reroutedFromJournalTitle ?? null,
        created_at: a.createdAt,
        updated_at: a.updatedAt
      })
    }
    for (const ev of a.events) eventRows.push({ id: ev.id, attempt_id: a.id, user_id: uid, at: ev.at, type: ev.type, status: ev.status ?? null, note: ev.note ?? null })
  }

  // Attempt deletes: server rows no longer present in the project record
  // (a rejected attempt is never deleted by the app, but wipe/export flows
  // could produce this state) - remove their events too.
  const localIds = new Set(project.submissions.map((a) => a.id))
  const staleIds = [...known.keys()].filter((id) => !localIds.has(id))
  if (staleIds.length > 0) {
    const rpcRes = await sb.rpc('pubrooter_delete_events_for_attempts', { attempt_ids: staleIds })
    void rpcRes
    await sb.from('pubrooter_submission_attempts').delete().eq('project_id', project.id)
  }

  if (attemptRows.length > 0) {
    let { error } = await sb.from('pubrooter_submission_attempts').upsert(attemptRows, { onConflict: 'id' })
    if (error && error.code === '42703') {
      // Migration 0003 not applied yet — persist without the reroute link
      // columns so attempt tracking still syncs.
      for (const row of attemptRows) {
        delete row.rerouted_from_attempt_id
        delete row.rerouted_from_journal_title
      }
      ;({ error } = await sb.from('pubrooter_submission_attempts').upsert(attemptRows, { onConflict: 'id' }))
    }
    if (error) {
      if (error.code === '42P01') return
      throw new Error(error.message)
    }
  }
  if (eventRows.length > 0) {
    const { error } = await sb.from('pubrooter_submission_events').upsert(eventRows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      if (error.code === '42P01') return
      throw new Error(error.message)
    }
  }
}

export async function deleteProjectCloud(id: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('pubrooter_projects').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveSavedJournalsCloud(list: SavedJournalRecord[]): Promise<void> {
  const sb = requireClient()
  const uid = await requireUserId()
  await sb.from('pubrooter_saved_journals').delete().eq('user_id', uid)
  if (list.length === 0) return
  const rows = list.map((s) => ({
    id: s.id,
    user_id: uid,
    journal_id: s.journalId,
    title: s.title,
    publisher: s.publisher ?? null,
    issn: s.issn ?? null,
    link: s.link ?? null,
    score: s.score ?? null,
    note: s.note ?? null,
    saved_at: s.savedAt
  }))
  const { error } = await sb.from('pubrooter_saved_journals').insert(rows)
  if (error) throw new Error(error.message)
}

export async function appendActivityCloud(events: ActivityEvent[]): Promise<void> {
  if (events.length === 0) return
  const sb = requireClient()
  const uid = await requireUserId()
  const rows = events.map((e) => ({
    id: e.id,
    user_id: uid,
    project_id: e.projectId ?? null,
    kind: e.kind,
    detail: e.detail,
    at: e.at
  }))
  const { error } = await sb.from('pubrooter_activity_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

/** Pull Colabwize drafts into PubRooter projects (SQL RPC). */
export async function importColabwizeDrafts(): Promise<number> {
  const sb = requireClient()
  const { data, error } = await sb.rpc('pubrooter_import_colabwize_drafts')
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}
