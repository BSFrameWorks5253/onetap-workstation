-- Run once in the Supabase SQL editor for the shared One Tap tracker workspace.
-- The payload is intentionally limited to Safar/date folder names and task fields;
-- never include absolute paths, filenames, media, or workstation telemetry.
create table if not exists public.safar_tracker_snapshots (
  id text primary key check (id = 'primary'),
  snapshot jsonb not null default '{"tasks":[],"folders":[],"updatedAt":""}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.safar_tracker_snapshots enable row level security;

-- This table contains only the shared task board metadata for the existing
-- single-workspace AnyShare channel. Replace these policies with authenticated
-- workspace membership before using the tracker for multiple organizations.
drop policy if exists "Shared tracker can read snapshot" on public.safar_tracker_snapshots;
create policy "Shared tracker can read snapshot"
  on public.safar_tracker_snapshots for select to anon, authenticated using (id = 'primary');

drop policy if exists "Shared tracker can write snapshot" on public.safar_tracker_snapshots;
create policy "Shared tracker can write snapshot"
  on public.safar_tracker_snapshots for insert to anon, authenticated with check (id = 'primary');

drop policy if exists "Shared tracker can update snapshot" on public.safar_tracker_snapshots;
create policy "Shared tracker can update snapshot"
  on public.safar_tracker_snapshots for update to anon, authenticated using (id = 'primary') with check (id = 'primary');

grant select, insert, update on public.safar_tracker_snapshots to anon, authenticated;
