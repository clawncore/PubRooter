-- ============================================================
-- PubRooter workspace schema — runs on the SHARED Colabwize
-- Supabase project (xkfyhlqncoyxotyivomp).
--
-- IMPORTANT: Colabwize's Prisma schema already owns public.users
-- and public.projects. Every PubRooter table is therefore prefixed
-- `pubrooter_` — do NOT create unprefixed tables here.
--
-- Apply in the Supabase SQL editor.
-- ============================================================

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.pubrooter_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default '',
  affiliation text not null default '',
  default_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- projects (manuscript projects) ----------
create table if not exists public.pubrooter_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  name text not null,
  file_name text,
  file_size bigint,
  storage_path text,
  status text not null default 'draft',
  error text,
  extracted jsonb,
  edited jsonb,
  preferences jsonb not null default '{}'::jsonb,
  analysis jsonb,
  selected_journal_id text,
  compared_journal_ids text[] not null default '{}',
  actions_completed text[] not null default '{}',
  source text not null default 'pubrooter' check (source in ('pubrooter', 'colabwize')),
  colabwize_draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pubrooter_projects_user_idx
  on public.pubrooter_projects (user_id, created_at desc);

-- ---------- readiness_audits (1:N per project) ----------
create table if not exists public.pubrooter_readiness_audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pubrooter_projects (id) on delete cascade,
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  journal_id text,
  journal_title text,
  run_at timestamptz not null default now(),
  engine_version text,
  checks jsonb not null default '[]'::jsonb
);
create index if not exists pubrooter_audits_project_idx
  on public.pubrooter_readiness_audits (project_id, run_at desc);

-- ---------- saved_journals ----------
create table if not exists public.pubrooter_saved_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  journal_id text not null,
  title text not null,
  publisher text,
  issn text,
  link text,
  score real,
  note text,
  saved_at timestamptz not null default now(),
  unique (user_id, journal_id)
);

-- ---------- activity_events ----------
create table if not exists public.pubrooter_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.pubrooter_profiles (id) on delete cascade,
  project_id uuid,
  kind text not null,
  detail text not null,
  at timestamptz not null default now()
);
create index if not exists pubrooter_activity_user_idx
  on public.pubrooter_activity_events (user_id, at desc);

-- ---------- updated_at trigger ----------
create or replace function public.pubrooter_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pubrooter_profiles_updated_at on public.pubrooter_profiles;
create trigger pubrooter_profiles_updated_at before update on public.pubrooter_profiles
  for each row execute function public.pubrooter_set_updated_at();

drop trigger if exists pubrooter_projects_updated_at on public.pubrooter_projects;
create trigger pubrooter_projects_updated_at before update on public.pubrooter_projects
  for each row execute function public.pubrooter_set_updated_at();

-- ---------- auto-create profile for every auth user ----------
-- Colabwize users already in auth.users get a PubRooter profile on
-- first sight — no manual step, Scribd/SlideShare style.
create or replace function public.pubrooter_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pubrooter_profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists pubrooter_on_auth_user_created on auth.users;
create trigger pubrooter_on_auth_user_created
  after insert on auth.users
  for each row execute function public.pubrooter_handle_new_user();

-- Backfill profiles for existing Colabwize users
insert into public.pubrooter_profiles (id, email, name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
where not exists (select 1 from public.pubrooter_profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------- Row Level Security ----------
alter table public.pubrooter_profiles enable row level security;
alter table public.pubrooter_projects enable row level security;
alter table public.pubrooter_readiness_audits enable row level security;
alter table public.pubrooter_saved_journals enable row level security;
alter table public.pubrooter_activity_events enable row level security;

drop policy if exists pubrooter_profiles_self on public.pubrooter_profiles;
create policy pubrooter_profiles_self on public.pubrooter_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists pubrooter_projects_self on public.pubrooter_projects;
create policy pubrooter_projects_self on public.pubrooter_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pubrooter_audits_self on public.pubrooter_readiness_audits;
create policy pubrooter_audits_self on public.pubrooter_readiness_audits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pubrooter_saved_self on public.pubrooter_saved_journals;
create policy pubrooter_saved_self on public.pubrooter_saved_journals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pubrooter_activity_self on public.pubrooter_activity_events;
create policy pubrooter_activity_self on public.pubrooter_activity_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- storage: private manuscripts bucket ----------
insert into storage.buckets (id, name, public)
values ('pubrooter-manuscripts', 'pubrooter-manuscripts', false)
on conflict (id) do nothing;

drop policy if exists pubrooter_manuscripts_self on storage.objects;
create policy pubrooter_manuscripts_self on storage.objects
  for all using (
    bucket_id = 'pubrooter-manuscripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'pubrooter-manuscripts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Colabwize draft import
-- Reads from Colabwize's existing public.projects table
-- (Prisma-managed: id, user_id, title, description, status,
--  content, outline, word_count, ...). Non-archived projects are
-- imported into PubRooter as ready-to-review manuscripts.
-- ============================================================
create or replace function public.pubrooter_import_colabwize_drafts()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  imported integer := 0;
  draft record;
begin
  if to_regclass('public.projects') is null then
    return 0;
  end if;

  for draft in
    select
      p.id::text as draft_id,
      p.user_id,
      p.title,
      p.description,
      p.word_count,
      p.updated_at
    from public.projects p
    where p.user_id = auth.uid()::text
      and coalesce(p.status, 'active') <> 'archived'
      and not exists (
        select 1 from public.pubrooter_projects pp
        where pp.user_id = auth.uid()
          and pp.colabwize_draft_id = p.id::text
      )
  loop
    insert into public.pubrooter_projects (
      user_id, name, status, extracted, preferences,
      source, colabwize_draft_id, created_at, updated_at
    ) values (
      auth.uid(),
      coalesce(nullif(draft.title, ''), 'Imported Colabwize draft'),
      'uploaded',
      jsonb_build_object(
        'title', coalesce(draft.title, ''),
        'abstract', coalesce(draft.description, ''),
        'keywords', '[]'::jsonb,
        'field', '', 'articleType', '', 'objectives', '', 'methods', '',
        'sections', '[]'::jsonb, 'entities', '[]'::jsonb,
        'referenceCount', 0,
        'wordCount', coalesce(draft.word_count, 0),
        'pageCount', 0,
        'extractionWarnings', jsonb_build_array(
          'Imported from Colabwize draft "' || coalesce(draft.title, draft.draft_id) || '" — review before analysis.'
        )
      ),
      '{}'::jsonb,
      'colabwize',
      draft.draft_id,
      coalesce(draft.updated_at, now()),
      now()
    );
    imported := imported + 1;
  end loop;

  return imported;
end $$;

grant execute on function public.pubrooter_import_colabwize_drafts() to authenticated;

-- ---------- Grants (Supabase default privileges do NOT apply to tables
-- created outside the dashboard SQL editor's usual path in every project;
-- without these, PostgREST returns 403 for anon/authenticated) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete
  on public.pubrooter_profiles,
     public.pubrooter_projects,
     public.pubrooter_readiness_audits,
     public.pubrooter_saved_journals,
     public.pubrooter_activity_events
  to anon, authenticated, service_role;
grant execute on function public.pubrooter_set_updated_at() to anon, authenticated, service_role;
grant execute on function public.pubrooter_import_colabwize_drafts() to anon, authenticated, service_role;
