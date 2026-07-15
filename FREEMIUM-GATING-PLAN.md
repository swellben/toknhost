# ToknHost Freemium & Access-Gating Plan

*Written 2026-07-08.* ⚠️ **SUPERSEDED 2026-07-14 — see "Access model v2" below.**
The original value-first / anonymous-studio model is replaced by a login-gated,
card-upfront model. The gating *entitlements* (free = 1 theme + in-editor use;
paid = MCP + export + multi-theme) are unchanged; what changed is **studio entry
now requires an account** and the **trial is a Stripe-managed 7-day card-upfront
trial** (opt-in), not an app-managed 14-day no-card reverse trial.

---

## Access model v2 (decided 2026-07-14)

- **`/studio` requires a free account** (GitHub/Google one-click) — no anonymous
  use. Rationale: dev audience finds OAuth near-frictionless; founder gets user
  identity; removes the janky play-then-login seam.
- **`/` is a landing page** (public) that sells + demos with a sign-in CTA — now a
  **launch blocker**, since there's no try-before-signup to sell the product.
- **Free account:** 1 theme, full editor, in-app use. No MCP, no export, no extra
  themes (unchanged entitlements — Phase 1 gating already enforces this).
- **Paid:** MCP + unlimited themes + export. **Trial = Stripe-managed 7-day free,
  card required upfront**, auto-charges at day 7. Opt-in via checkout, NOT granted
  automatically on signup. This replaces the app-managed `trial_ends_at` 14-day
  reverse trial (migration 008 to be reverted; entitlements read Stripe
  subscription status: `trialing`/`active` ⇒ paid).
- **Consequence:** anonymous localStorage draft + claim-on-signup (Phase 2) is
  moot; a logged-in free user's single theme just autosaves.

The 2026-07-08 model below is kept for historical context / research notes.

---

## (Superseded) The 2026-07-08 decision in one line

**The studio is open to anonymous users; the account + paywall gate the moment a
user tries to _take value out_ (save to account, export files, connect MCP) — via
a reverse trial, not plain freemium.**

This refines — and in one place reverses — the earlier "/studio behind auth" note
in PIVOT-PLAN.md / the persistence memory. `/studio` stays **public**; auth moves
to the extraction actions.

---

## Why (research basis)

Current (2025–2026) benchmarks, filtered for a dev-adjacent visual tool launched
via YouTube:

- **Plain freemium converts poorly:** 2–5% free→paid typical; dev tools 2–7%.
- **Reverse trials convert far better:** 15–30%+ (loss aversion — users start with
  premium, then don't want to lose it). Cursor hit ~36% with a generous-but-capped
  free tier.
- **Value-before-signup beats upfront walls:** ~2.5× higher conversion; every
  friction point removed adds 3–8%. Dev-tool target Time-to-First-Value < 15 min —
  the studio's "seed → full theme" aha is basically instant, so walling the
  entrance wastes our single best asset (and our YouTube demo).
- **PQL signal:** MCP connection + repeat exports are the product-qualified signals
  to instrument (PQL-based conversion ~25% vs ~9% without).

Sources: ProductLed PLG benchmarks; First Page Sage 2026; Prems AI 2026; RevHeat
reverse-trial reconciliation; Inflection reverse-trial guide; Userpilot signup
flow; Notable Capital "to wall or not to wall"; Troy Lendman PLG metrics; Optifai
PQL playbook. (See MARKETING-ASSESSMENT.md for the channel strategy this supports.)

---

## Access model — three states

| State | How you get here | What you can do |
|---|---|---|
| **Anonymous** | Just open `/studio` — no account | Full studio: generate scales, edit tokens, live preview, light/dark, undo. Draft persists in **localStorage** only. |
| **Free (account)** | Sign up (Google / Figma / email) — triggered at Save/Export/MCP | Save **1** design system to the account, cloud-persisted & cross-device. **No export of any kind** and no MCP — those are trial/paid only. |
| **Paid** | Upgrade after the reverse trial | MCP hosting endpoint, all export formats + file download, multiple design systems, version history. |

OAuth (Google/Figma) is **just a fast signup option**, never a requirement to use
the studio. Email/password produces the same account.

---

## The reverse trial

- On **signup**, grant full premium (Export + MCP + multiple systems) for a fixed
  window: **14 days** (decided 2026-07-08).
- At trial end, downgrade to the **capped free tier** (1 system, **no export**, no
  MCP). Studio itself stays free forever.
- The "loss" of a live MCP endpoint an AI agent is already pulling from is the
  upgrade driver.

**Effective plan** = `paid` if `profiles.plan = 'paid'` OR `now() < trial_ends_at`.

---

## Feature → gate map

| Feature | Anonymous | Free | Trial / Paid |
|---|---|---|---|
| Studio create / edit / preview | ✅ | ✅ | ✅ |
| localStorage draft persistence | ✅ | ✅ | ✅ |
| Save design system to account | ❌ (signup) | ✅ (1) | ✅ (many) |
| **Any bulk extraction** — copy-all tokens or file download (CSS/Tailwind/JSON) | ❌ | ❌ | ✅ all formats |
| **MCP server endpoint** | ❌ | ❌ | ✅ |
| Version history / collaboration | ❌ | ❌ | ✅ (paid) |

> "No free-tier export" (decided 2026-07-08) means the free tier gets **zero
> output capability** — no file download *and* no bulk copy-to-clipboard of the
> token set. Any usable artifact requires an active trial or a paid plan. This does
> **not** hide individual values inside the editor (seeing a hex while editing is
> part of *using* the studio, not exporting) — we just don't gate what a user can
> eyeball. The gate is on producing a take-away artifact.

---

## Critical UX: don't lose anonymous work

The account wall must never become a "lost-my-work" wall — the #1 freemium leak.
Three layers:

1. **Auto-persist to localStorage** as the user works, so refresh / back-button /
   accidental close-and-return **restores** the draft. No account needed for this.
2. **Standing "Draft — not saved to your account" status** in the studio header,
   beside the existing save indicator, with a "Sign in to save" CTA. Honest,
   always-visible upgrade nudge — not a threat.
3. **`beforeunload` confirm** only as a safety net on true tab-close with unsaved
   changes: "Your draft is saved in this browser but not to an account — sign in to
   keep it anywhere."

### Claim-on-signup (must-have)
When an anonymous user signs up, **migrate the localStorage draft into their new
account** (create a `design_systems` row + `studio_config` + token tables from the
draft) so nothing is lost crossing the account boundary. Without this, the wall
leaks users at the exact conversion moment.

---

## Implementation notes (where this lands in the code)

- **Keep `/studio` in `PUBLIC_PATHS`** (`src/lib/supabase/middleware.ts`) — already
  true. Anonymous studio use works today.
- **Landing already wired (this session):** `login` action, `/auth/callback`
  default, and `/` all redirect to `/studio`; the studio header renders `UserMenu`
  (logout) when `userEmail` is present (`src/app/studio/page.tsx`,
  `src/components/studio/theme-studio.tsx`).
- **Trial fields (new):** add to `public.profiles` — `trial_ends_at timestamptz`.
  Set in the `handle_new_user()` trigger to `now() + interval '14 days'`. (Extends
  migration 007.)
- **Plan gating helper:** a server util that returns `effective_plan` from
  `plan` + `trial_ends_at`; gate Export/MCP server actions and the MCP edge
  function on it.
- **Anonymous draft:** a localStorage key holding the studio draft (the
  `studio_config` UI-state + the working token model). Claim-on-signup reads this
  and writes the normalized alias-aware tables (per PIVOT-PLAN.md — primitives raw,
  semantics as aliases; never flatten).
- **MCP gate:** the `design-system-mcp` edge function must reject/withhold for
  non-paid effective plans (bearer-token tier check).
- **PQL instrumentation:** log MCP connect + export events for conversion tracking.

---

## Resolved (2026-07-08)

- **Trial length:** 14 days.
- **Free-tier export:** none — zero output capability on the free tier (see the
  feature-map note above). The whole free tier is "create + save 1, but you can't
  take anything out."

## Open questions (decide before/while building)

1. **Price point & paid tiers:** still TBD (`profiles.plan` currently just
   `free` | paid-TBD).
2. **Anonymous → 1 free system:** does Save immediately consume the single free
   slot, or is the first save always free and additional systems gated?
3. **MCP in trial:** full endpoint during trial, or a capped/preview endpoint?
