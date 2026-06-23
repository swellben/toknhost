-- =============================================================================
-- Migration: 004_regenerate_mcp_token_function
-- Lets an owner rotate their design system's mcp_token without needing a
-- raw SQL UPDATE (Supabase JS can't compute gen_random_bytes() client-side).
-- =============================================================================

CREATE OR REPLACE FUNCTION regenerate_mcp_token(p_design_system_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_token TEXT;
BEGIN
  new_token := 'tkh_' || encode(gen_random_bytes(24), 'hex');

  -- SECURITY INVOKER means this UPDATE runs as the calling user, so the
  -- existing owner_all_design_systems RLS policy still applies — only the
  -- owner can actually change a row, same as any other update.
  UPDATE design_systems
  SET mcp_token = new_token
  WHERE id = p_design_system_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design system not found or not owned by the current user.';
  END IF;

  RETURN new_token;
END;
$$;
