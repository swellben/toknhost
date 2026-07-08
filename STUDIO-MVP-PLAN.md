# ToknHost Studio MVP — direction & build order

*Written 2026-07-08. Supersedes the pre-pivot MVP-SCOPE.md (deleted). Reads
together with PIVOT-PLAN.md and FREEMIUM-GATING-PLAN.md.*

---

## Direction (decided 2026-07-08)

**The Theme Studio (`/studio`) is the whole product.** The old `/dashboard` app
UI is **shelved** — users don't go there — but its **code stays, not deleted**, as
a parts bin to pillage: the MCP handoff (`mcp-access-card`,
`supabase/functions/design-system-mcp`), gap-fill / AI color-fill
(`src/lib/gap-fill`, `src/lib/ai`, `runGapFill`), a11y checks, and especially the
**token-row writers** (`src/app/dashboard/[id]/*-actions.ts`) — currently the only
code that writes the normalized `tokens` / `token_values` / `modes` tables the MCP
reads. Scope is now **Tailwind-only** (see PIVOT-PLAN.md V0 re-scope), so expect to
re-scope pillaged pieces (gap-fill especially) rather than lift them verbatim.

## The critical blocker

The studio's Save (`src/app/studio/actions.ts`) only writes `design_systems` +
`studio_config` (the editor recipe). It does **not** write the normalized token
tables — so a studio-created design system currently serves **nothing** via the
MCP. The **studio→rows translator** (PIVOT-PLAN "Architecture decision 2026-07-07",
still unbuilt) is the #1 MVP blocker. The MCP presenter
(`design-system-mcp/lib/present.ts`) already renders alias-preserving,
per-framework output and works — the missing half is writing the alias-aware rows
(primitives raw, semantics as aliases) on save.

## Build order

| # | Work | Why it's here |
|---|------|---------------|
| **1** | **Studio→rows translator** | 🔴 The blocker. On Save, emit alias-aware `tokens`/`token_values`/`modes` (Tailwind; primitives raw, semantics as aliases). Pillage the dashboard row-writers; reuse `present.ts`'s alias model. |
| **2** | **MCP handoff in studio** | Surface the URL + bearer token + framework. Pillage `mcp-access-card`. The actual deliverable. |
| **3** | **Enforce gating** | Wire `getEntitlements()` (`src/lib/plan.ts`) into export / MCP / save-count per FREEMIUM-GATING-PLAN.md. |
| **4** | **Anonymous draft + claim-on-signup** | localStorage autosave, "not saved to your account" banner, migrate draft into the account at signup. |
| **5** | **Billing / payment** | trial→paid has no payment path yet (`upgrade-promo` is a dead button); the reverse trial can't convert without it. |
| **6** | **Export formats + richer import** | Studio export is CSS-copy only today; add formats + gating. Pillage smart-import (multi-format) and re-scoped gap-fill. |

Items **1–3** deliver a working, monetizable core loop (design → live MCP URL,
gated). **4–6** are the conversion/polish layer.

## Status of this session's work (already on `main`)

- Auth: OAuth login buttons; login / `/auth/callback` / `/` all land on `/studio`;
  logout in the studio header when signed in.
- Freemium foundation: migration 008 (`profiles.trial_ends_at` + 14-day trial in
  `handle_new_user()`, applied to remote), regenerated types, and the
  `getEntitlements()` gating helper (not yet enforced anywhere — that's item 3).
- Studio persistence: `studio_config` save/load/list/delete (recipe only — see the
  blocker above).
