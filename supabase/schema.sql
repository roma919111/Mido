-- Studio AI / OpenArt clone schema for Supabase (PostgreSQL)
-- Run in the Supabase SQL editor before using the app with live credentials.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users (profile extension of auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro', 'master')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_credits + transaction ledger
-- ---------------------------------------------------------------------------
create table if not exists public.user_credits (
  user_id uuid primary key references public.users (id) on delete cascade,
  balance integer not null default 50 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx
  on public.credit_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- user_generations
-- ---------------------------------------------------------------------------
create table if not exists public.user_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  mode text not null
    check (mode in ('text-to-image', 'text-to-video', 'image-to-video', 'inpaint')),
  media_type text not null check (media_type in ('image', 'video')),
  prompt text not null,
  negative_prompt text,
  style_preset text,
  aspect_ratio text,
  duration integer,
  resolution text,
  settings jsonb not null default '{}'::jsonb,
  media_url text,
  thumbnail_url text,
  history_id text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  credits_used integer not null default 0,
  is_public boolean not null default false,
  likes_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_generations_user_id_idx
  on public.user_generations (user_id, created_at desc);

create index if not exists user_generations_public_idx
  on public.user_generations (is_public, created_at desc)
  where is_public = true;

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table if not exists public.generation_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  generation_id uuid not null references public.user_generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

-- ---------------------------------------------------------------------------
-- Auto profile + starter credits on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, subscription_tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'free'
  )
  on conflict (id) do nothing;

  insert into public.user_credits (user_id, balance)
  values (new.id, 50)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, amount, balance_after, reason)
  values (new.id, 50, 50, 'signup_bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Credit deduction helper
-- ---------------------------------------------------------------------------
create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.user_credits
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient credits';
  end if;

  insert into public.credit_transactions (user_id, amount, balance_after, reason, metadata)
  values (p_user_id, -p_amount, new_balance, p_reason, p_metadata);

  return new_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.user_generations enable row level security;
alter table public.generation_favorites enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "credits_select_own" on public.user_credits
  for select using (auth.uid() = user_id);

create policy "transactions_select_own" on public.credit_transactions
  for select using (auth.uid() = user_id);

create policy "generations_select_own_or_public" on public.user_generations
  for select using (auth.uid() = user_id or is_public = true);

create policy "generations_insert_own" on public.user_generations
  for insert with check (auth.uid() = user_id);

create policy "generations_update_own" on public.user_generations
  for update using (auth.uid() = user_id);

create policy "generations_delete_own" on public.user_generations
  for delete using (auth.uid() = user_id);

create policy "favorites_all_own" on public.generation_favorites
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
