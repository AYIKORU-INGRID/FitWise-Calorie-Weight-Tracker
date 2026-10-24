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

create table if not exists public.subscriptions (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  premium_until timestamptz,
  email text,
  provider text not null default 'flutterwave',
  provider_plan_id text,
  subscription_status text not null default 'active',
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists premium_until timestamptz,
  add column if not exists email text,
  add column if not exists provider text not null default 'flutterwave',
  add column if not exists provider_plan_id text,
  add column if not exists subscription_status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from public, anon, authenticated;
grant all on table public.subscriptions to service_role;

create table if not exists public.flutterwave_checkouts (
  tx_ref text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  amount integer not null check (amount = 2000),
  currency text not null check (currency = 'UGX'),
  plan_id text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  checkout_url text,
  transaction_id text unique,
  created_at timestamptz not null default now()
);

alter table public.flutterwave_checkouts
  add column if not exists checkout_url text;

create unique index if not exists flutterwave_one_pending_checkout_per_user
  on public.flutterwave_checkouts (user_id)
  where status = 'pending';

alter table public.flutterwave_checkouts enable row level security;
revoke all on table public.flutterwave_checkouts from public, anon, authenticated;
grant all on table public.flutterwave_checkouts to service_role;

create table if not exists public.flutterwave_payments (
  transaction_id text primary key,
  tx_ref text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount >= 2000),
  currency text not null check (currency = 'UGX'),
  created_at timestamptz not null default now()
);

alter table public.flutterwave_payments enable row level security;
revoke all on table public.flutterwave_payments from public, anon, authenticated;
grant all on table public.flutterwave_payments to service_role;

create or replace function public.activate_flutterwave_payment(
  p_transaction_id text,
  p_tx_ref text,
  p_user_id uuid,
  p_email text,
  p_plan_id text,
  p_amount numeric,
  p_currency text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_transaction_id is null or p_transaction_id = '' or
     p_tx_ref is null or p_tx_ref = '' or
     p_amount < 2000 or p_currency <> 'UGX' then
    raise exception 'Invalid verified payment details';
  end if;

  insert into public.flutterwave_payments (transaction_id, tx_ref, user_id, amount, currency)
  values (p_transaction_id, p_tx_ref, p_user_id, p_amount, p_currency)
  on conflict (transaction_id) do nothing;

  if not found then
    return false;
  end if;

  insert into public.subscriptions (
    user_id, premium_until, email, provider, provider_plan_id, subscription_status, updated_at
  ) values (
    p_user_id, now() + interval '1 month', lower(p_email), 'flutterwave', p_plan_id, 'active', now()
  )
  on conflict (user_id) do update set
    premium_until = greatest(coalesce(public.subscriptions.premium_until, now()), now()) + interval '1 month',
    email = lower(excluded.email),
    provider = 'flutterwave',
    provider_plan_id = excluded.provider_plan_id,
    subscription_status = 'active',
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.activate_flutterwave_payment(text, text, uuid, text, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.activate_flutterwave_payment(text, text, uuid, text, text, numeric, text)
  to service_role;
