-- Migration 007: profiles + plan (freemium hook)
--
-- One row per auth user. `plan` is the single field everything paid hangs off
-- (default 'free'; paid tiers TBD). Auto-created for every new user by a trigger
-- on auth.users, and backfilled for any existing users. Plan is set by the
-- system/billing (service role) — there is intentionally no user UPDATE policy,
-- so users can't self-upgrade.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id)
select id from auth.users on conflict (id) do nothing;

comment on table public.profiles is
  'One row per auth user. plan drives freemium gating (free | paid tiers TBD). Plan is set by the system/billing, not the user.';
