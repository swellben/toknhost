-- =============================================================================
-- Migration: 005_ai_usage
-- Per-call audit log for AI-calling features (color-fill, freeform ingestion).
-- Backs the per-user monthly free-tier caps decided in PIVOT-PLAN.md — logging
-- every call (not just a bare counter) lets real cost be verified against the
-- pre-build estimates, and gives an audit trail for debugging.
-- Date: 2026-06-24
-- =============================================================================

CREATE TABLE ai_usage (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_system_id    UUID          REFERENCES design_systems(id) ON DELETE CASCADE,
  -- Nullable: a design system could be deleted after the call was logged;
  -- the usage record (and the cap it counts against) should outlive it.

  feature             TEXT          NOT NULL,
  -- 'color_fill' today; 'freeform_ingest' once that feature is built.
  -- Left as plain TEXT (no CHECK) so adding a new feature later doesn't
  -- need its own migration just to extend an enum.

  model               TEXT          NOT NULL, -- e.g. "claude-sonnet-4-6"
  input_tokens        INT           NOT NULL,
  output_tokens       INT           NOT NULL,
  estimated_cost_usd  NUMERIC(10,6) NOT NULL,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_feature_month
  ON ai_usage(user_id, feature, created_at);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- A user can read and insert their own usage rows. No update/delete policy —
-- this is an append-only audit log; rows should never be edited after the
-- fact (would defeat the point of an audit trail).
CREATE POLICY "owner_read_ai_usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner_insert_ai_usage"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
