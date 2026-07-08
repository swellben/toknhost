-- Migration 008: reverse-trial window on profiles
--
-- Every new user gets a 14-day reverse trial: full premium (export + MCP +
-- multiple design systems) until trial_ends_at, after which they fall back to
-- the capped free tier (1 system, no export). Access checks compute
-- effective_plan = paid if plan = 'paid' OR now() < trial_ends_at.
-- See src/lib/plan.ts and FREEMIUM-GATING-PLAN.md.

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

comment on column public.profiles.trial_ends_at is
  'End of the 14-day reverse trial granted at signup. While now() < trial_ends_at the user has full premium access regardless of plan. Set by handle_new_user(); null = no active trial.';

-- New users: stamp a 14-day trial at profile creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, trial_ends_at)
  values (new.id, now() + interval '14 days')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing profiles (created before this column) with a fresh trial.
update public.profiles
set trial_ends_at = now() + interval '14 days'
where trial_ends_at is null;
