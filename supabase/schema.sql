create table if not exists public.tracker_data (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.tracker_data enable row level security;

revoke all on table public.tracker_data from public;
grant select, insert, update, delete on table public.tracker_data to authenticated;

drop policy if exists "Users can read their own tracker" on public.tracker_data;
create policy "Users can read their own tracker"
  on public.tracker_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own tracker" on public.tracker_data;
create policy "Users can create their own tracker"
  on public.tracker_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tracker" on public.tracker_data;
create policy "Users can update their own tracker"
  on public.tracker_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tracker" on public.tracker_data;
create policy "Users can delete their own tracker"
  on public.tracker_data for delete
  to authenticated
  using (auth.uid() = user_id);
