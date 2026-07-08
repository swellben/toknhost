/**
 * Studio → normalized token rows.
 *
 * The studio edits a `ThemeConfig` and persists it as `studio_config` (the
 * editor recipe). But the hosted MCP server reads the *normalized* token tables
 * (`tokens` / `token_values` / `modes`) — so on every save we also translate the
 * config into alias-aware rows the MCP can serve. This module is the pure
 * translation half (no DB); the writer lives in `src/app/studio/actions.ts`.
 *
 * The output matches the contract in
 * `supabase/functions/design-system-mcp/lib/present.ts`:
 *   - primitive colors: path `color.<scale>.<step>`, raw `{ hex }`
 *   - semantic colors:  path `color.<role-dotted>`, alias → the primitive's
 *     path, or raw `{ hex }` for overrides/computed foregrounds/literals
 *   - radius/font:       one mode-agnostic row (`border-radius.base`,
 *     `font-family.base`)
 * Primitives get a value in BOTH modes because the MCP resolves color tokens
 * per-mode and aliases resolve within a single mode's token set.
 */

import {
  type ThemeConfig,
  type SeedKey,
  type Step,
  STEPS,
  SEED_KEYS,
  PRIMITIVE_SCALE_NAME,
  semanticSources,
} from "@/lib/studio/theme";

export type ModeName = "light" | "dark";

/** Token identity row (unique per path within a design system). */
export type TranslatedToken = {
  path: string;
  category: string;
  type: string;
};

/** One per-mode value for a token, keyed back to its token by `path`. */
export type TranslatedValue = {
  path: string;
  mode: ModeName;
  isAlias: boolean;
  aliasPath: string | null;
  /** jsonb value; null for aliases. */
  value: Record<string, unknown> | null;
};

export type TranslatedRows = {
  tokens: TranslatedToken[];
  values: TranslatedValue[];
};

const MODES: ModeName[] = ["light", "dark"];

/** Primitive scale token path, e.g. `color.brand.500`. */
export function primitivePath(family: SeedKey, step: Step): string {
  return `color.${PRIMITIVE_SCALE_NAME[family]}.${step}`;
}

/**
 * Semantic role → token path. The MCP derives CSS var names by splitting the
 * path on `.` (see `namespaceForV4`/`SHADCN_PATH_TO_VAR`), so the studio's
 * hyphenated role names become dotted paths: `primary-foreground` →
 * `color.primary.foreground`, `chart-1` → `color.chart.1`.
 */
export function semanticPath(role: string): string {
  return `color.${role.replace(/-/g, ".")}`;
}

/** Split the config's CSS font stack into a clean, unquoted family array. */
function fontStack(cfg: ThemeConfig): string[] {
  return cfg.fontSans
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Translate a ThemeConfig into the token + value rows the MCP reads. Pure — the
 * caller writes these to Supabase. The token set is fixed (66 primitives + the
 * shadcn semantic roles + radius + font), so re-saving upserts the same paths.
 */
export function translateThemeToRows(cfg: ThemeConfig): TranslatedRows {
  const tokens: TranslatedToken[] = [];
  const values: TranslatedValue[] = [];
  const seenTokenPaths = new Set<string>();

  const addToken = (t: TranslatedToken) => {
    if (seenTokenPaths.has(t.path)) return;
    seenTokenPaths.add(t.path);
    tokens.push(t);
  };

  // Primitives — raw color ramps. Same value in both modes so per-mode alias
  // resolution finds them in either mode.
  for (const family of SEED_KEYS) {
    for (const step of STEPS) {
      const path = primitivePath(family, step);
      addToken({ path, category: "color", type: "color" });
      const hex = cfg.ramps[family][step];
      for (const mode of MODES) {
        values.push({ path, mode, isAlias: false, aliasPath: null, value: { hex } });
      }
    }
  }

  // Semantics — per mode, aliasing the primitives (or a raw override/foreground).
  for (const mode of MODES) {
    const src = semanticSources(cfg, mode);
    for (const [role, source] of Object.entries(src)) {
      const path = semanticPath(role);
      addToken({ path, category: "color", type: "color" });
      if (source.kind === "alias") {
        values.push({
          path,
          mode,
          isAlias: true,
          aliasPath: primitivePath(source.family, source.step),
          value: null,
        });
      } else {
        values.push({
          path,
          mode,
          isAlias: false,
          aliasPath: null,
          value: { hex: source.value },
        });
      }
    }
  }

  // Radius + font — mode-agnostic (the MCP reads one canonical value for any
  // non-color category), so a single light-mode row suffices.
  addToken({ path: "border-radius.base", category: "border-radius", type: "dimension" });
  values.push({
    path: "border-radius.base",
    mode: "light",
    isAlias: false,
    aliasPath: null,
    value: { value: cfg.radius, unit: "rem" },
  });

  addToken({ path: "font-family.base", category: "font-family", type: "fontFamily" });
  values.push({
    path: "font-family.base",
    mode: "light",
    isAlias: false,
    aliasPath: null,
    value: { stack: fontStack(cfg) },
  });

  return { tokens, values };
}
