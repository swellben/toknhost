-- =============================================================================
-- Migration: 001_initial_schema
-- Design System Platform — Initial Schema
-- Date: 2026-06-15
-- See: schema-design.md for full rationale and field documentation
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- DESIGN SYSTEMS
-- =============================================================================

CREATE TABLE design_systems (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  description    TEXT,
  slug           TEXT        NOT NULL UNIQUE, -- used in MCP server URL
  is_public      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODES (light, dark, high-contrast, custom brand variants, etc.)
-- =============================================================================

CREATE TABLE modes (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_system_id   UUID        NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL, -- "light", "dark", "high-contrast", "brand-a"
  is_default         BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order         INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(design_system_id, name)
);

-- =============================================================================
-- TOKENS (identity, metadata — one row per unique path per design system)
-- =============================================================================

CREATE TABLE tokens (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_system_id UUID        NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,

  -- Identity
  path             TEXT        NOT NULL,
  -- Dot-notation canonical path: "color.primary", "font-size.base",
  -- "component.button.background", "color.brand.500"

  -- Classification
  category         TEXT        NOT NULL,
  -- Valid values: color, font-size, font-family, font-weight, line-height,
  -- letter-spacing, paragraph-spacing, text-decoration, text-transform,
  -- spacing, border-radius, shadow, drop-shadow, text-shadow,
  -- border-width, border-style, border, opacity, z-index,
  -- duration, easing, transition, animation, breakpoint, sizing, component

  type             TEXT        NOT NULL,
  -- Value type (DTCG-style): color, dimension, fontFamily, fontWeight,
  -- number, duration, cubicBezier, shadow, border, transition,
  -- typography, gradient, string, boolean

  -- Documentation
  description      TEXT,        -- what this token is / how to use it
  rationale        TEXT,        -- why this token exists (our schema extension)

  -- Lifecycle
  status           TEXT        NOT NULL DEFAULT 'stable'
                               CHECK (status IN ('stable', 'experimental', 'deprecated')),

  -- Provenance (how this token was produced)
  provenance       TEXT        NOT NULL
                               CHECK (provenance IN ('imported', 'derived', 'defaulted')),
  provenance_meta  JSONB,
  -- {"format": "tailwind-v4", "original_key": "--color-primary", "imported_at": "2026-06-15T..."}

  -- Platform code syntax
  code_syntax      JSONB,
  -- {"web": "--color-primary", "android": "colorPrimary", "ios": "colorPrimary", "swift": "Color.primary"}

  -- Display
  tags             TEXT[],
  sort_order       INT         NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(design_system_id, path)
);

-- =============================================================================
-- TOKEN VALUES (actual values, one per token × mode)
-- =============================================================================

CREATE TABLE token_values (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     UUID        NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mode_id      UUID        NOT NULL REFERENCES modes(id) ON DELETE CASCADE,

  -- Value (JSONB shape determined by tokens.type — see schema-design.md)
  value        JSONB,
  -- null when is_alias = true (resolved at application layer)

  -- Alias support
  is_alias     BOOLEAN     NOT NULL DEFAULT FALSE,
  alias_path   TEXT,
  -- Dot-notation path to referenced token if is_alias = true
  -- e.g. "color.brand.500"

  -- Import fidelity
  raw_value    TEXT,
  -- Original string as-imported before normalization
  -- e.g. "222.2 84% 4.9%" (Shadcn HSL bare triplet)
  -- Kept for debugging and round-trip export

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(token_id, mode_id)
);

-- =============================================================================
-- ACCESSIBILITY CHECKS (cached WCAG contrast results)
-- =============================================================================

CREATE TABLE accessibility_checks (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  design_system_id       UUID          NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  foreground_token_id    UUID          NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  background_token_id    UUID          NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mode_id                UUID          NOT NULL REFERENCES modes(id) ON DELETE CASCADE,

  -- WCAG results
  contrast_ratio         NUMERIC(5,2)  NOT NULL,
  passes_aa_normal       BOOLEAN       NOT NULL, -- 4.5:1 ratio required
  passes_aa_large        BOOLEAN       NOT NULL, -- 3:1 ratio required (18pt+ or 14pt+ bold)
  passes_aaa_normal      BOOLEAN       NOT NULL, -- 7:1 ratio required
  passes_aaa_large       BOOLEAN       NOT NULL, -- 4.5:1 ratio required

  checked_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE(foreground_token_id, background_token_id, mode_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- design_systems
CREATE INDEX idx_design_systems_user ON design_systems(user_id);
CREATE INDEX idx_design_systems_slug ON design_systems(slug);

-- modes
CREATE INDEX idx_modes_design_system ON modes(design_system_id);

-- tokens
CREATE INDEX idx_tokens_design_system ON tokens(design_system_id);
CREATE INDEX idx_tokens_path          ON tokens(design_system_id, path);
CREATE INDEX idx_tokens_category      ON tokens(design_system_id, category);
CREATE INDEX idx_tokens_status        ON tokens(design_system_id, status);
CREATE INDEX idx_tokens_provenance    ON tokens(design_system_id, provenance);

-- token_values
CREATE INDEX idx_token_values_token ON token_values(token_id);
CREATE INDEX idx_token_values_mode  ON token_values(mode_id);

-- accessibility_checks
CREATE INDEX idx_a11y_design_system ON accessibility_checks(design_system_id);
CREATE INDEX idx_a11y_mode          ON accessibility_checks(design_system_id, mode_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_design_systems_updated_at
  BEFORE UPDATE ON design_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_token_values_updated_at
  BEFORE UPDATE ON token_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE design_systems    ENABLE ROW LEVEL SECURITY;
ALTER TABLE modes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_values       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_checks ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user owns a design system
CREATE OR REPLACE FUNCTION owns_design_system(ds_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_systems
    WHERE id = ds_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if a design system is public
CREATE OR REPLACE FUNCTION design_system_is_public(ds_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_public FROM design_systems WHERE id = ds_id),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- design_systems policies
CREATE POLICY "owner_all_design_systems"
  ON design_systems FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public_read_design_systems"
  ON design_systems FOR SELECT
  USING (is_public = TRUE);

-- modes policies
CREATE POLICY "owner_all_modes"
  ON modes FOR ALL
  USING (owns_design_system(design_system_id))
  WITH CHECK (owns_design_system(design_system_id));

CREATE POLICY "public_read_modes"
  ON modes FOR SELECT
  USING (design_system_is_public(design_system_id));

-- tokens policies
CREATE POLICY "owner_all_tokens"
  ON tokens FOR ALL
  USING (owns_design_system(design_system_id))
  WITH CHECK (owns_design_system(design_system_id));

CREATE POLICY "public_read_tokens"
  ON tokens FOR SELECT
  USING (design_system_is_public(design_system_id));

-- token_values policies (ownership inherited through tokens table)
CREATE POLICY "owner_all_token_values"
  ON token_values FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tokens t
      WHERE t.id = token_id
        AND owns_design_system(t.design_system_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tokens t
      WHERE t.id = token_id
        AND owns_design_system(t.design_system_id)
    )
  );

CREATE POLICY "public_read_token_values"
  ON token_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tokens t
      WHERE t.id = token_id
        AND design_system_is_public(t.design_system_id)
    )
  );

-- accessibility_checks policies
CREATE POLICY "owner_all_a11y_checks"
  ON accessibility_checks FOR ALL
  USING (owns_design_system(design_system_id))
  WITH CHECK (owns_design_system(design_system_id));

CREATE POLICY "public_read_a11y_checks"
  ON accessibility_checks FOR SELECT
  USING (design_system_is_public(design_system_id));

-- =============================================================================
-- DEFAULT MODE TRIGGER
-- Automatically creates a "light" default mode when a design system is created
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_mode()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO modes (design_system_id, name, is_default, sort_order)
  VALUES (NEW.id, 'light', TRUE, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_default_mode
  AFTER INSERT ON design_systems
  FOR EACH ROW EXECUTE FUNCTION create_default_mode();
