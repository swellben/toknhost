# MVP pivot plan — status & next steps

**Date started:** 2026-06-22
**Why:** Spent a long session iterating on algorithmic color generation (OKLCH/HSL math in `src/lib/gap-fill/material.ts`) and a rich live-preview UI. User still wasn't happy with generated palette quality after several rounds of fixes. Root cause: "does this look good" is a subjective design judgment math alone can't resolve, and we never validated whether the underlying product (tokens served via MCP) actually works with real tools. Decision: pause generation-quality polish, de-scope the UI, and validate the core product loop first.

**What stays as-is:** Database schema (`supabase/migrations/`), parsers (`src/lib/parsers/*`), MCP server (`supabase/functions/design-system-mcp/`), accessibility checker (`src/lib/a11y/`). These are considered solid — see "Already built" below.

**What's being shelved for now:** The algorithmic gap-fill color math (`src/lib/gap-fill/`) and the rich `DesignSystemPreview` UI. Not deleted — just not the focus. Revisit only after the ingestion/AI-fill loop is validated.

## The plan (5 steps)

1. **Master semantic token list → MCP → test real-tool ingestion.** Write a canonical file of all tokens with descriptive semantic names (not just primitives). Confirm the MCP serves it in a shape Figma, Tailwind, Bootstrap, and shadcn can actually ingest.
2. **Test AI ingestion of pasted variables.** Give an AI a cut-and-paste blob of a user's existing variables; see what it can map automatically and what it calls out as missing/ambiguous.
3. **AI populates missing tokens** — replaces (or augments) the deterministic gap-fill math from this session.
4. **Build UI for customizing UI elements** (after 1-3 are validated, not before).
5. **Build UI to toggle UX tokens** (date formatting, tone of voice, etc.) — start with 2-3 toggles, not the full "10 principles" list, to prove the concept cheaply. Confirm these are actually delivered correctly through the MCP.

**Decided constraint for step 3:** Don't let AI fully replace the deterministic checks. AI proposes values; the existing contrast checker (`src/lib/a11y/`) and contrast-anchored dark-CTA logic (`src/lib/gap-fill/material.ts` → `ctaDarkPair`) validate/flag anything that fails AA. Hybrid, not pure-AI — keeps this session's accessibility work as a safety net instead of discarding it.

**Monetization for now:** No paywall while testing. AI generator usage may eventually be metered (free uses included, pay for more) — not needed until the product loop is validated.

## Already built (don't rebuild)

- **✅ Exhaustive master reference design system — built this session.** Investigated the actual DB: every existing design system (including "Testing 123") only ever covered 6 of the 26 `TokenCategory` values defined in `src/types/tokens.ts`, because gap-fill itself only knows how to generate those 6. There was no row-level catalog covering the full schema vocabulary. **Built one**: design system `master-reference` (id `f994089e-fff3-4870-839f-233af1757628`, slug `master-reference`, `is_public: true`) in the live Supabase project (`gxpqjpwsswhgdufyyxlt`). It has **185 tokens / 291 values covering all 26 categories** — the original 136 (color scales, border-radius, breakpoint, font-family, font-size, spacing) copied from "Testing 123", plus 49 new tokens for the previously-missing 20 categories: `font-weight`, `line-height`, `letter-spacing`, `paragraph-spacing`, `text-decoration`, `text-transform`, `shadow`, `drop-shadow`, `text-shadow`, `border-width`, `border-style`, `border`, `opacity`, `z-index`, `duration`, `easing`, `transition`, `animation`, `sizing`, `component`. Has both `light` and `dark` modes (color tokens vary by mode; everything else is mode-agnostic, living only under `light`, matching the existing convention in the DB). **This is now the canonical fixture for ingestion testing.** **Still not present:** any UX tokens (date formatting, tone of voice) — confirms step 5 is genuinely greenfield, nothing to build on there yet.
- **Parsers** (`src/lib/parsers/`): dtcg, tokens-studio, tailwind-v3, tailwind-v4, shadcn, bootstrap, mantine, figma-variables, js-object-literal. Import side is in good shape across most target formats.
- **MCP server** (`supabase/functions/design-system-mcp/index.ts` + `lib/present.ts`): working Deno edge function, JSON-RPC 2.0 over HTTP, serves tokens keyed by design-system slug, has public/private access control via `mcp_token`. Tools include token listing and `get_accessibility_report`.
- **✅ Export/present shaping for all 4 target tools — built and deployed this session.** `lib/present.ts` → `presentTokens()` now supports `css-variables`, `tailwind-v4`, `shadcn`, `dtcg`, `tailwind-v3`, **and the two that were missing: `bootstrap` and `figma-variables`**. Also extended `toCssValue` with cases for `shadow`, `border`, `transition` (previously only `color`/`dimension`/`duration`/`fontFamily`/`fontWeight`/`number`/`cubicBezier`/`string`/`boolean` were handled — these three were silently dropping every token in the 20 newly-added categories). `presentFigmaVariables` produces the *exact* `{meta:{variables, variableCollections}}` shape that `src/lib/parsers/figma-variables.ts` reads back in — true round-trip, not just Figma-flavored JSON. `presentBootstrap` outputs SCSS variable names for known roles (`$primary`, `$body-bg`, etc.) with a generic `$path-name` fallback for everything else, plus a `$grid-breakpoints` map via `document`. Deployed as `design-system-mcp` v3 (Supabase project `gxpqjpwsswhgdufyyxlt`). **Live-tested against `master-reference`:** `bootstrap` and `figma-variables` both hit **0/185 unmapped**. Regression-checked the other 5 frameworks — no breakage; their non-zero unmapped counts (`tailwind-v4`: 41, `shadcn`: 173, `tailwind-v3`: 39) are pre-existing/by-design (those presenters were already selective about which categories they name) and were the same gap, not something I introduced. **New known gap surfaced by this test:** `tailwind-v4` and `tailwind-v3` have no explicit namespace/category handling for the 20 newly-added categories (shadow, border, opacity, z-index, sizing, component, etc.) — `namespaceForV4` and `presentTailwindV3`'s category branches were never extended because no design system had those categories to test against until `master-reference` existed. Not fixed yet — flagged as a follow-up, not done.
- **Accessibility checker** (`src/lib/a11y/`): WCAG contrast checks per mode, including the alert/badge-as-text-on-tinted-background pattern (fixed this session — was previously a blind spot). Reports only, does not auto-fix, per explicit user instruction.
- **Token type system** (`src/types/tokens.ts`): canonical `ParsedToken` shape, `TokenCategory`/`TokenType` enums, `SupportedFormat` union already lists all 4 target ingestion formats (figma-variables, tailwind, bootstrap, shadcn) plus more.

## Concrete next action (partially done — pick up here)

Done: master reference dataset, both missing presenters (bootstrap, figma-variables), API-level testing (0 unmapped for both new frameworks, no regressions on the other 5).

**✅ Also done:** Added 21 missing shadcn-required color tokens (`card`, `popover`, `accent`, `input`, `ring`, `chart.1-5`, `sidebar.*` — 8 sidebar sub-tokens) to `master-reference`, derived sensibly from existing palette (card/popover ← background, accent ← muted, chart.1-5 ← primary/secondary/success/warning/danger, sidebar.* ← muted/primary/border equivalents). Extended `namespaceForV4` and `presentTailwindV3` with mappings for all 20 previously-uncovered categories. Redeployed as v4 and re-tested all 7 frameworks:
- `tailwind-v4`: 41 → **0 unmapped**
- `tailwind-v3`: 39 → **0 unmapped**
- `shadcn`: variable count 12 → **33** (now populates every slot shadcn's own theme defines — card/popover/accent/input/ring/chart/sidebar were previously silently defaulting). Unmapped count unchanged (173) — this is correct and expected, not a bug: shadcn's theme genuinely has no concept of color scale steps, shadows, typography details, etc., so those will always be out of scope for that format specifically.
- All other frameworks unchanged at 0 unmapped.

**✅ Also done:** Added a plain GET REST route alongside the JSON-RPC MCP protocol — `/design-system-mcp/<slug>?framework=X&mode=Y` returns the same presented tokens as raw JSON (no JSON-RPC envelope), for tools/agents that don't speak MCP but can `fetch()` a URL. Deployed as v5. Refactored both the GET handler and the POST `get_tokens`/`get_theme` tools to share one `getPresentedTheme()` helper — no duplicated logic. Live-tested: correct 401 on private design systems without a token, 404 on bad slugs, full-theme (all modes) when `mode` is omitted. Added a framework/mode picker to `McpAccessCard` (`src/components/mcp-access-card.tsx`) so users can generate and copy this URL from the dashboard — **not visually verified in-browser** (no login credentials available this session), only confirmed via `tsc --noEmit` and code review.

**✅ Real ingestion test — done, and it worked.** Fetched the live `master-reference` GET endpoint fresh (not from memory), extracted the actual `css-variables` output (206 light + 127 dark vars), and built a real static HTML prototype (a small "Account settings" page: cards, form fields, buttons, badges, alert, disabled state) using **only** `var(--...)` references to those tokens — zero hardcoded colors/fonts/spacing. Rendered via a local static server and screenshotted in both modes:
- Light mode: green primary (`#2a6500`-derived), magenta secondary (`#dd4673`-derived), correct success/warning/accent badge colors, visible `opacity-disabled` on the disabled button, decorative cursive `Fuggles` font exactly as the data specifies.
- Dark mode toggle: background correctly flips near-black, all colors relighten appropriately, borders adjust — **and the font changes to `"Abhaya Libre", serif`**, faithfully reflecting a real inconsistency in the underlying data (light/dark modes have different font-family values, which is arguably a data bug) rather than masking it.
- This is the proof the pivot was chasing: an external consumer using only the MCP/GET output, with no extra knowledge, produces a UI that visibly and correctly reflects the design system — confirms the core product loop works end-to-end for at least the `css-variables` framework.
- **Not yet tested this way:** Bootstrap (would need actual SCSS compilation), Figma (would need the actual Figma plugin), shadcn/Tailwind (would need a real Next.js+Tailwind build, not just static CSS vars). The `css-variables` proof is the strongest/easiest case since it needs no build step — the others remain to be proven the same way.

**Not done yet:**
1. Repeat the same kind of real proof for Bootstrap (compile real SCSS), Figma (paste into the actual Figma variables-import plugin), and shadcn/Tailwind (real Next.js build) — the `css-variables` case is proven; the other 3 aren't yet, only API-shape-verified.
2. Decide whether gap-fill should eventually be extended to produce all 26 categories (plus the 21 shadcn-required color roles) for *every new* design system a customer creates (separate, larger follow-up — not started, this only fixed the *fixture*, not the generator).
3. The font-family light/dark inconsistency surfaced by the live test (`Fuggles, cursive` vs `"Abhaya Libre", serif`) is in `master-reference`'s underlying data, copied from "Testing 123" — worth deciding whether font-family should be treated as mode-agnostic (like border-radius already is) rather than allowed to vary by mode. Not fixed, just noticed.

## Project setup

Git initialized and pushed to `https://github.com/swellben/toknhost.git`, `main` branch, initial commit `76cdb81`. `.env*` confirmed excluded via `.gitignore` before the first push. Going forward: commit as work happens (per user instruction), but only push when explicitly asked — pushes are treated as a confirm-first action.

## Reference data — quick lookup

- Supabase project id: `gxpqjpwsswhgdufyyxlt`
- Master reference design system id: `f994089e-fff3-4870-839f-233af1757628`
- Master reference slug: `master-reference` (public, no MCP token needed)
- Light mode id: `f63903b4-5cd3-4bb0-a868-6f8cbfb6adb6`
- Dark mode id: `b41d4212-7e65-42ce-adbd-7d3075638f79`

## Open questions (not yet decided)

- What counts as the "master" semantic list — is it fixed, or per-category extensible? (Leaning extensible, but not decided.)
- Where does the AI-fill prompt live — a Supabase edge function (consistent with MCP) or a Next.js server action? Not decided.
- Exact wording/scope of the "10 UX principles" — only date formatting and tone of voice were named as likely first candidates; the rest of the list doesn't exist yet.
