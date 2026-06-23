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

**Not done yet:**
1. **Manual paste-test into the real tools** — actually paste the MCP's `bootstrap` output into a Bootstrap SCSS `_variables.scss` and compile it; paste the `figma-variables` document into a Figma variables-import plugin; paste `tailwind-v4`/`shadcn`/`tailwind-v3` output into a real Tailwind config / shadcn theme file. The API-level "0 unmapped" check proves the *shape* is structurally complete — it does NOT prove Figma/Bootstrap/Tailwind will actually accept and render it without complaint (e.g. invalid CSS, SCSS compile errors, Figma plugin parsing quirks). This is the test that actually answers step 1's original question ("does this ingest correctly") and still hasn't been run.
2. Decide whether gap-fill should eventually be extended to produce all 26 categories (plus the 21 shadcn-required color roles) for *every new* design system a customer creates (separate, larger follow-up — not started, this only fixed the *fixture*, not the generator).

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
