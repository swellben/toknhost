-- Migration 006: design_systems.studio_config
--
-- Adds design_systems.studio_config — the Theme Studio editor's UI-state (the
-- "recipe" needed to reopen a design system in the editor exactly as left):
-- seed colors, per-domain generated/manual flags, font source/name/customFont,
-- spacing/radius mode, etc. The actual token VALUES live in the normalized
-- tokens/token_values tables (what the MCP serves); this column is editor-only
-- state that those tables don't capture. Additive + nullable — existing rows
-- keep working with a NULL config until saved from the studio.

ALTER TABLE design_systems
  ADD COLUMN IF NOT EXISTS studio_config JSONB;

COMMENT ON COLUMN design_systems.studio_config IS
  'Theme Studio editor UI-state (seeds, per-domain generated/manual flags, font source, spacing/radius mode) — the recipe to reopen a design system in the editor. Token values live in tokens/token_values; this column is editor-only state.';
