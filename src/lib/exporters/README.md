# `src/lib/exporters/` is intentionally empty

The token-shaping logic that used to live here (CSS variables, Tailwind v4,
Shadcn, DTCG presenters) has been consolidated into a single
implementation: **`supabase/functions/design-system-mcp/lib/present.ts`**.

There was briefly a second copy in this directory, used by a test-only
Next.js API route. That route and this copy were deleted on purpose — two
copies of the same logic drift, and drift here means an AI agent silently
gets wrong values. The Supabase Edge Function is the only consumer that
matters (it's what actually serves tokens to external agents), so it's
the only place this logic should exist.

If a real per-format *file* exporter is ever built (e.g. "download a
`tokens.json`" instead of serving live via MCP), it should `fetch()` the
deployed Edge Function rather than reintroducing a duplicate
implementation here.
