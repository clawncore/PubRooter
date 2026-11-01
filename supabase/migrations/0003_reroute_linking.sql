-- ============================================================
-- PubRooter reroute linking (submission rerouting feature).
-- Applies on the same shared Colabwize Supabase project as
-- 0001/0002 — every table is prefixed `pubrooter_`.
--
-- When a manuscript is rerouted after a rejection/withdrawal,
-- the new attempt records which attempt and which journal it
-- came from. The link is a soft reference (no FK): attempts
-- are append-only and must never fail to save because a prior
-- attempt row was removed.
-- Apply in the Supabase SQL editor (setup.sql already contains
-- these statements for fresh databases).
-- ============================================================

alter table public.pubrooter_submission_attempts
  add column if not exists rerouted_from_attempt_id uuid;

alter table public.pubrooter_submission_attempts
  add column if not exists rerouted_from_journal_title text;
