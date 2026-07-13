# ToknHost — Launch Plan

*Written 2026-07-13. The finish line from "MCP handoff done" to "launched,
monetizable." Reads with STUDIO-MVP-PLAN.md (build order) and
FREEMIUM-GATING-PLAN.md (access model).*

## Decisions (2026-07-13)

- **Billing = Stripe**, with **Stripe Tax** enabled so VAT/sales-tax is
  collected/computed automatically (Stripe is not merchant-of-record, so we owe
  the returns, but Stripe Tax handles the math + registration prompts).
- **Launch surface = studio-as-funnel + a minimal landing page.** `/` currently
  just redirects to `/studio`; add a lightweight landing (hero, demo video,
  pricing, CTA) and send `/studio` traffic there from the marketing side, while
  keeping the studio itself the public top-of-funnel.
- **Trial is app-managed, not Stripe-managed.** Signup grants 14 days via
  `profiles.trial_ends_at` (migration 008). Stripe only enters when the trial
  ends and the user subscribes — checkout creates a normal (non-trial)
  subscription; the webhook flips `plan` to `paid`.

## Where we are

- ✅ #1 studio→rows translator — saves write the normalized `tokens`/
  `token_values`/`modes` the MCP reads.
- ✅ #2 MCP handoff in studio — `studio/mcp-actions.ts` + `studio/mcp-panel.tsx`;
  gated on `getEntitlements().canUseMcp`. (Commit 92010ff.)
- `getEntitlements()` (`src/lib/plan.ts`) is the single access model but is
  **only enforced for MCP** so far. `canSave`, `canExport`, `maxDesignSystems`
  are computed but not enforced anywhere.
- No billing code exists. `upgrade-promo.tsx` and the panel's "Upgrade (coming
  soon)" button are dead.
- No landing/pricing page. `/` → `/studio`.

## Build sequence

### Phase 1 — Finish gating enforcement (small) ✅ DONE (commit a6663eb)
Completes build #3. Until this lands, free and paid are identical except MCP.
- Enforce `canExport` in the studio Export panel: free users can see individual
  values in-editor but cannot download files or bulk-copy. Gate the export
  action + show an upgrade nudge.
- Enforce `maxDesignSystems` (free = 1) in `createStudioDesignSystem`: block the
  2nd create with an upgrade prompt.
- Server-side is the source of truth (never trust the client); mirror in the UI
  for affordance.

### Phase 2 — Don't-lose-work funnel (medium) ✅ DONE (commit e7891f3)
Build #4. The public-studio funnel only converts if crossing signup never loses
work.
- ✅ localStorage autosave of the anonymous draft (editor config), with restore
  on load (gated behind a `hydrated` flag so autosave can't clobber the stored
  draft before restore reads it).
- ✅ "Draft — not saved to your account" header status + CTA ("Sign in to save"
  anon / "Save to account" signed-in).
- ✅ **Claim-on-signup:** first authenticated load with a draft and no systems
  migrates it into the account and clears the draft.
- **Deferred `beforeunload`:** intentionally NOT added — localStorage
  autosave+restore already makes refresh/close/return lossless, so a
  `beforeunload` prompt would be a false alarm (work is safe). Revisit in 2B if
  a prompt is still wanted for the clear-browser-data / different-device case.
- **Known UX nits for 2B:** the draft header status text wraps awkwardly at the
  current width; claim-on-signup / "Save to account" still need a signed-in
  live check (phase 5).

### Phase 3 — Monetization / Stripe (medium-large)
Build #5. The hard launch blocker.
- **Schema (migration 009):** add `profiles.stripe_customer_id`,
  `stripe_subscription_id`, `subscription_status`. Keep `plan` as the gate.
- **Checkout:** server action creates a Stripe Checkout Session (subscription
  mode, Stripe Tax on) for the signed-in user; ensure/attach a Stripe customer.
- **Webhook** (`src/app/api/stripe/webhook/route.ts`, raw-body route handler):
  verify signature; on `checkout.session.completed` /
  `customer.subscription.updated` → `plan='paid'`; on
  `customer.subscription.deleted` / past_due → `plan='free'`. Idempotent.
- **Wire the dead Upgrade buttons** (mcp-panel LockedState, upgrade-promo, export
  nudge) to checkout.
- **Customer portal** link for manage/cancel.
- **Pricing page** + price/env config (`STRIPE_*` keys, price id).
- Read Stripe's current docs before coding — do not trust memorized API shapes.

### Phase 4 — Landing surface & polish (medium)
- Minimal landing at `/` (hero, embedded demo video, pricing, CTA to studio).
  Move the `/` → `/studio` redirect behind the landing.
- Export formats (slice of #6): downloadable files for the frameworks the MCP
  already serves (tailwind-v4, shadcn, css-variables), gated by `canExport`.
- Ops: terms/privacy, OG/meta, analytics, error/empty states.

### Phase 5 — Deploy & smoke-test the full funnel
- Deploy to Vercel prod; set Stripe webhook endpoint + env in prod.
- End-to-end: anonymous design → signup (trial) → live MCP URL → agent consumes
  tokens → simulate trial-end → upgrade via Stripe → paid → still works →
  cancel → downgraded to free.
- Closes the two deferred verifications: authenticated Save → deployed MCP
  round-trip, and the entitled ConnectionCard render (screenshot signed-in).

## Post-launch backlog
Richer/AI import (pillage smart-import), re-scoped gap-fill, more export formats,
a11y checks, Figma variables target (V2).
