-- =============================================================================
-- Migration: 002_target_framework
-- Adds design_systems.target_framework — which consuming framework this
-- design system's tokens are shaped for when served (by the future MCP
-- server) or presented via src/lib/exporters.
-- =============================================================================

ALTER TABLE design_systems
  ADD COLUMN target_framework TEXT NOT NULL DEFAULT 'css-variables';

COMMENT ON COLUMN design_systems.target_framework IS
  'Which consuming framework this design system''s tokens are shaped for when served (by the future MCP server) or presented via src/lib/exporters. Free text, not constrained by CHECK, so new frameworks do not require a migration. Known values: css-variables, tailwind-v4, shadcn, dtcg, bootstrap, mantine.';
