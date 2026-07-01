# ToknHost MVP Scope Recommendation

*Written 2026-06-29. Grounded in a full read of the codebase and PIVOT-PLAN.md.*

---

## What "done" looks like

A user signs up, picks a color and font (or pastes an existing token file), and within two minutes has a live MCP server URL they can drop into Claude Code or Cursor. From that point forward, every component the AI generates uses the correct brand colors, radii, and typography — no guessing, no hardcoded hex values. That is the product. Everything else is polish or futures.

---

## Keep — MVP core

These are the features that must work for the product to have any value. Without any one of them, the core loop breaks.

**1. Auth** (`src/app/login/`, `src/app/auth/callback/route.ts`, Supabase magic link)
The entry gate. Works today. Touch nothing.

**2. Design system create/delete** (`src/app/dashboard/page.tsx`, `src/components/create-design-system-form.tsx`, `src/components/delete-design-system-button.tsx`)
Users need to own a named design system. Both actions are working. Touch nothing.

**3. Quick Start form** (`src/components/quick-start-form.tsx`, `src/app/dashboard/[id]/actions.ts` → `quickStartImport`)
This is the "enter a few things → get a full design system" path Ben described as the core onboarding moment. It works today. It is the single most important ingestion path for new users who don't have a token file.

**4. Smart Import** (`src/components/smart-import-form.tsx`, `src/app/dashboard/[id]/actions.ts` → `smartImport`)
Paste-any-format ingestion for users who do have an existing token file. Works today. This, combined with Quick Start, means every user can get tokens in regardless of where they're starting from.

**5. Gap-fill** (`src/components/gap-fill-button.tsx`, `src/lib/gap-fill/`, `src/lib/ai/color-fill.ts`)
This is what makes Quick Start valuable — it turns "I picked blue" into a full design system with scales, dark mode, accessible foregrounds, and typography defaults. The AI color-fill path is already tuned and metered (25 calls/month). Works today.

**6. MCP server endpoint** (`supabase/functions/design-system-mcp/index.ts`)
The entire product is this endpoint. It has been proven end-to-end against real tools for css-variables, Tailwind v4, and shadcn. Deploy is live. Touch nothing except bugs.

**7. MCP Access Card** (`src/components/mcp-access-card.tsx`)
The URL handoff moment — this is literally the deliverable the user is here for. Copy MCP URL, copy bearer token, choose framework. Works today. The direct URL fallback (for tools without MCP support) is also here and working.

**8. Settings (public/private toggle + target framework)** (`src/components/edit-design-system-form.tsx`)
Users need control over whether their endpoint is public or requires a token, and what framework it serves by default. Both are in the Details section. Works today.

---

## Keep — already built, low-risk to include

These features are fully working and add real demonstrable value. They cost nothing to ship because they are already there.

**Freeform text ingestion ("Describe it" tab)** (`src/lib/ai/freeform-ingest.ts`, `src/components/smart-import-form.tsx`)
The smart import form already falls back to AI extraction for unstructured prose. This is a nice-to-have differentiator — "paste brand guidelines text, get tokens" — and it's already wired up and metered. No additional work needed.

**Visual preview — shadcn slice** (`src/components/shadcn-framework-preview.tsx`, `src/components/design-system-preview-panel.tsx`)
The shadcn live preview panel is working — real shadcn components re-themed via CSS variable overrides, no build step. It gives users immediate visual feedback that their tokens look right. The css-variables and Tailwind v4 slices of the same panel are not fully done yet (see Defer section), but the shadcn preview alone is worth shipping.

**Inline token editing** (`src/components/editable-token-row.tsx`, `src/app/dashboard/[id]/token-actions.ts`)
Users can click into any editable token row and change the value. The optimistic update even reflects in the live preview. Works for colors and dimensions. This is table stakes for a "manage your tokens" product.

**Accessibility check** (`src/components/a11y-check-button.tsx`, `src/lib/a11y/`, `src/app/dashboard/[id]/a11y-actions.ts`)
Runs WCAG contrast checks per mode, shows a table of passing/failing pairs. Runs automatically after gap-fill. This is a meaningful quality signal that differentiates ToknHost from just "a file hosting service." It's already built; there's no reason to hide it.

**Provenance badges** (`src/components/provenance-badge.tsx`)
Tiny `imported` / `derived` / `defaulted` labels on token rows. Already wired up. Zero cost to ship, adds transparency about how each token was sourced.

**Dashboard sidebar navigation with per-design-system sections** (`src/components/dashboard-sidebar.tsx`, `src/lib/design-system-sections.ts`)
The multi-section layout (Details, Colors, Primitives, Tokens, Typography, Accessibility) is working. It organizes the product logically. The two "coming soon" sections (UX Patterns, Copy) already show a placeholder card rather than crashing, so they are safe to leave in the nav.

**Token search** (`src/components/token-search.tsx`, `src/app/dashboard/[id]/search-actions.ts`)
Already built. Useful for large design systems. Low risk.

---

## Defer to V2

These features add real value but require meaningful new work or unresolved architectural decisions. Shipping without them is fine because the core loop works without them.

**Visual preview — Tailwind v4 and css-variables slices** (`src/components/tailwind-v4-framework-preview.tsx` exists but Pass 1 is incomplete per PIVOT-PLAN.md)
The mechanism is proven (same CSS variable override approach as shadcn), but the full Tailwind v4 and generic css-variables preview components haven't been wired through the same test rigor as shadcn. PIVOT-PLAN.md explicitly lists this as the next thing to build. Do it in V2 — the shadcn preview ships as the single preview in MVP.

**Visual preview — Bootstrap and Tailwind v3** 
Requires a real Sass compile-on-demand server endpoint. Architectural design unstarted. V2.

**Dirty-state indicator**
Users have no visual cue that an edited token row hasn't been committed yet. PIVOT-PLAN.md calls this out explicitly. Not blocking the MVP — the product still works correctly — but it's a UX gap that will generate support questions. V2.

**"Run gap-fill" conditional visibility**
The gap-fill button currently shows even after gap-fill is complete. Minor UX annoyance, not a blocker. V2.

**Export buttons in the UI** (exporters exist in `src/lib/exporters/README.md` mentions the files, but no exporter UI is wired)
The exporter code exists (`bootstrap.ts`, `dtcg.ts`, `figma-variables.ts`, etc.) but there's no export-to-file button in the dashboard. This is a nice feature but the MVP value is the MCP endpoint, not file downloads. V2.

**Figma Variables export / Figma plugin**
Already deferred in PIVOT-PLAN.md. V2.

**UX Patterns and Copy sections** (`src/lib/design-system-sections.ts` — both marked `comingSoon: true`)
No data model behind these yet. Currently show a "Coming soon" card. V2.

**Billing / upgrade paywall** (`src/components/upgrade-promo.tsx` is disabled with `cursor-not-allowed`)
PIVOT-PLAN.md explicitly says no paywall while validating. Leave the disabled promo component in place as a signal but don't build a real paywall until the core loop is proven. V2.

---

## Cut entirely (for now)

These things exist in the codebase but add no value to the MVP story and some add noise.

**`UpgradePromo` component showing a disabled "Upgrade (coming soon)" button**
The component (`src/components/upgrade-promo.tsx`) renders a permanently disabled button that goes nowhere. Hiding or removing it from the sidebar removes confusion about whether the product is feature-complete vs. paywalled. It can come back when billing is real.

**`ux-patterns` and `copy` nav items in the sidebar** 
They're in `DESIGN_SYSTEM_SECTIONS` and render a "Coming soon" placeholder. During MVP this is dead weight — it implies a product vision that hasn't been built and draws attention away from the working features. Consider removing them from the sidebar nav for launch, even though the route handlers are harmless.

**`src/proxy.ts`**
Present in the repo. Unclear purpose from a quick read. Warrants a look before launch to confirm it's not an accidental leftover — if it's not wired into anything, delete it.

**DTCG, Mantine, Bootstrap, Figma Variables, Tokens Studio, and js-object-literal parsers in the import UI**
The parsers themselves are solid and should stay. But the Smart Import form's placeholder text already lists them all. The issue is that most MVP users will not know what DTCG or Tokens Studio are. Consider leading the import panel with "Quick Start" (already the default tab) and labeling the "Import" tab as "Advanced / paste a token file" to avoid confusing users who just want to pick a color.

---

## The one gap that needs to be closed before launch

**There is no landing page.** `src/app/page.tsx` is a bare redirect to `/dashboard`. Any user who lands on the root domain before signing in gets bounced immediately. A minimal marketing landing page — even a single-screen explainer with a "Sign up" CTA — is needed before public launch. It does not need to be elaborate, but it needs to exist and accurately describe the product (paste tokens → get MCP URL → AI uses it).

---

## Summary table

| Feature | Status | MVP? |
|---|---|---|
| Auth (magic link) | Working | Core |
| Design system CRUD | Working | Core |
| Quick Start form | Working | Core |
| Smart Import (paste any format) | Working | Core |
| Gap-fill (AI color-fill) | Working | Core |
| MCP server endpoint | Working, proven | Core |
| MCP Access Card (URL handoff) | Working | Core |
| Public/private toggle + framework setting | Working | Core |
| Freeform text ingestion | Working | Include |
| Visual preview (shadcn only) | Working | Include |
| Inline token editing | Working | Include |
| Accessibility check | Working | Include |
| Provenance badges | Working | Include |
| Dashboard sidebar + sections | Working | Include |
| Token search | Working | Include |
| Visual preview (Tailwind v4, css-vars) | Incomplete | V2 |
| Visual preview (Bootstrap, Tailwind v3) | Not built | V2 |
| Dirty-state indicator | Not built | V2 |
| Export-to-file UI | Not built | V2 |
| Figma plugin / Figma Variables export | Not built | V2 |
| UX Patterns + Copy sections | Not built | V2 |
| Billing / paywall | Not built | V2 |
| Upgrade promo button (disabled) | Built but broken | Cut/hide |
| UX Patterns + Copy nav items | Built, placeholder | Cut from nav |
| Landing page | Missing | Build before launch |
