-- ============================================================
-- PubRooter submission attempts (Phase 3/7 of the pipeline
-- overhaul). Applies on the same shared Colabwize Supabase
-- project as 0001 — keep every table prefixed `pubrooter_`.
--
-- Attempts live in their own table so an attempt record is
-- stable and append-only: status changes and events are
-- written as new rows/events, never by rewriting old ones.
-- Apply in the Supabase SQL editor.
-- ============================================================

-- ---------- submission_attempts (1:N per project) ----------
create table if not exists public.pubrooter_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pubrooter_projects (id) on delete cascade,
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'draft',
  target_journal_id text,
  target_journal_title text,
  official_portal_url text,
  external_manuscript_id text,
  submission_date timestamptz,
  corresponding_author_notes text,
  required_docs jsonb not null default '[]'::jsonb,
  readiness_audit_id uuid,
  decision jsonb,
  revision jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pubrooter_attempts_project_idx
  on public.pubrooter_submission_attempts (project_id, attempt_number desc);
create index if not exists pubrooter_attempts_user_idx
  on public.pubrooter_submission_attempts (user_id, updated_at desc);

-- ---------- submission_events (append-only event history) ----------
-- Keeping events in their own table means a status change never
-- rewrites or replaces earlier history — the audit trail is the
-- union of rows, ordered by `at`.
create table if not exists public.pubrooter_submission_events (
  id text primary key,
  attempt_id uuid not null references public.pubrooter_submission_attempts (id) on delete cascade,
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  at timestamptz not null default now(),
  type text not null,
  status text,
  note text
);

create index if not exists pubrooter_events_attempt_idx
  on public.pubrooter_submission_events (attempt_id, at asc);

-- ---------- updated_at maintenance for attempts ----------
drop trigger if exists pubrooter_attempts_updated_at on public.pubrooter_submission_attempts;
create trigger pubrooter_attempts_updated_at before update on public.pubrooter_submission_attempts
  for each row execute function public.pubrooter_set_updated_at();

-- ---------- Row Level Security (same self-scope pattern as 0001) ----------
alter table public.pubrooter_submission_attempts enable row level security;
alter table public.pubrooter_submission_events enable row level security;

drop policy if exists pubrooter_attempts_self on public.pubrooter_submission_attempts;
create policy pubrooter_attempts_self on public.pubrooter_submission_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pubrooter_events_self on public.pubrooter_submission_events;
create policy pubrooter_events_self on public.pubrooter_submission_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Grants (same pattern as 0001 — PostgREST returns 403
-- without explicit DML grants on tables created in the SQL editor) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete
  on public.pubrooter_submission_attempts,
     public.pubrooter_submission_events
  to anon, authenticated, service_role;
grant execute on function public.pubrooter_delete_events_for_attempts(uuid[]) to authenticated;

-- ---------- maintenance RPC: delete events for a set of attempt ids ----------
create or replace function public.pubrooter_delete_events_for_attempts(attempt_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.pubrooter_submission_events
  where attempt_id = any (attempt_ids);
end $$;
