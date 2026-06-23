-- =============================================================================
-- Migration: 003_mcp_token
-- Adds design_systems.mcp_token — the bearer token the MCP server (a
-- Supabase Edge Function, see supabase/functions/design-system-mcp/)
-- uses to authorize access to a *private* design system. Public design
-- systems require no token.
-- =============================================================================

ALTER TABLE design_systems
  ADD COLUMN mcp_token TEXT UNIQUE NOT NULL
    DEFAULT ('tkh_' || encode(gen_random_bytes(24), 'hex'));

COMMENT ON COLUMN design_systems.mcp_token IS
  'Bearer token for the MCP server (Supabase Edge Function) to authorize access to a private design system''s tokens. Irrelevant for public design systems, which require no token. Only readable by the owner via RLS, or by the Edge Function via the service role key.';
