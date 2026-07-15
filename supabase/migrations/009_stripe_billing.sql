-- Migration 009: Stripe billing fields; retire the app-managed reverse trial
--
-- Access model v2 (FREEMIUM-GATING-PLAN.md): the trial is now a Stripe-managed
-- 7-day card-upfront trial, not an app-granted 14-day window. Entitlements read
-- the Stripe subscription status (trialing | active => paid) instead of
-- trial_ends_at. New users are plain free; the trial starts at checkout.
--
-- profiles has no user UPDATE policy (migration 007), so these fields are
-- written only by the billing webhook via the service-role key.

alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer id for this user, set on first checkout. One customer per profile.';
comment on column public.profiles.stripe_subscription_id is
  'Most-recent Stripe Subscription id, synced by the billing webhook.';
comment on column public.profiles.subscription_status is
  'Stripe subscription status (trialing | active | past_due | canceled | ...). '
  'effective paid = trialing or active. Synced by the billing webhook.';

-- Stop granting the app-managed 14-day trial to new users; the trial is now
-- Stripe-managed and opt-in at checkout. Reverts handle_new_user() to a plain
-- free-profile insert (as in migration 007).
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

comment on column public.profiles.trial_ends_at is
  'DEPRECATED 2026-07-14: the app-managed reverse trial was replaced by a '
  'Stripe-managed trial. No longer read by entitlements. Kept for history.';
