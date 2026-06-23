import type { TokenCategory, TokenType, TokenValueShape } from "@/types/tokens";
import { hexToOklch, oklchToHex, aestheticForeground, toOklchString, contrastRatio } from "./oklch";
import {
  generateColorScale,
  generateTypeScale,
  DEFAULT_SPACING_PX,
  DEFAULT_RADIUS_PX,
  DEFAULT_BREAKPOINTS_PX,
} from "./scales";
import { materialSurfaces } from "./material";

export { invertLightness, hexToOklch, oklchToHex, contrastRatio, aestheticForeground, normalizeSeedColor } from "./oklch";

export interface ExistingToken {
  id: string;
  path: string;
  category: string;
  type: string;
  /** light-mode value, as stored in token_values.value */
  value: unknown;
}

export interface DerivedToken {
  path: string;
  category: TokenCategory;
  type: TokenType;
  value: TokenValueShape;
  provenance: "derived" | "defaulted";
}

function colorValue(hex: string): TokenValueShape {
  const { l, c, h } = hexToOklch(hex);
  return { hex, oklch: toOklchString(l, c, h), space: "oklch" };
}

function dimensionValue(px: number): TokenValueShape {
  return { value: px, unit: "px" };
}

function hexOf(value: unknown): string | null {
  if (value && typeof value === "object" && "hex" in value) {
    return String((value as { hex: unknown }).hex);
  }
  return null;
}

const SCALE_SUFFIX_RE =
  /\.(50|100|200|300|400|500|600|700|800|900|950|foreground)$/;

/**
 * Computes everything missing from an imported token set, per the
 * derivation table in CLAUDE.md "Gap-Fill: What Gets Derived From What".
 * Pure function — no DB access. Returns only *new* tokens to create;
 * the caller (the gap-fill server action) is responsible for persisting
 * them and for generating dark-mode counterparts via `invertLightness`.
 */
export function computeGapFill(existing: ExistingToken[]): DerivedToken[] {
  const existingPaths = new Set(existing.map((t) => t.path));
  const derived: DerivedToken[] = [];

  const hasAnyOf = (category: TokenCategory) =>
    existing.some((t) => t.category === category);

  // 1. Full 50–950 scale + *-foreground for every imported base color that
  // doesn't already have one (skip tokens that already look like a
  // generated scale step or foreground, to avoid scaling a scale).
  const baseColors = existing.filter(
    (t) =>
      t.category === "color" &&
      t.type === "color" &&
      !SCALE_SUFFIX_RE.test(t.path) &&
      hexOf(t.value)
  );

  for (const base of baseColors) {
    const seedHex = hexOf(base.value)!;
    const hasScale = [50, 500, 950].some((step) =>
      existingPaths.has(`${base.path}.${step}`)
    );
    if (!hasScale) {
      const scale = generateColorScale(seedHex);
      for (const [step, hex] of Object.entries(scale)) {
        const path = `${base.path}.${step}`;
        if (existingPaths.has(path)) continue;
        derived.push({
          path,
          category: "color",
          type: "color",
          value: colorValue(hex),
          provenance: "derived",
        });
      }
    }

    const fgPath = `${base.path}.foreground`;
    if (!existingPaths.has(fgPath)) {
      derived.push({
        path: fgPath,
        category: "color",
        type: "color",
        value: colorValue(aestheticForeground(seedHex)),
        provenance: "derived",
      });
    }
  }

  // 2. background / foreground / muted / border — derived from the primary seed
  // using Material's neutral palette (primary hue at low chroma) so surfaces are
  // subtly tinted rather than pure grey or #ffffff / #000000.
  const primarySeedHex =
    hexOf(baseColors.find((t) => t.path === "color.primary")?.value) ??
    hexOf(baseColors[0]?.value) ??
    "#3b82f6";
  const surfaces = materialSurfaces(primarySeedHex);

  if (!existingPaths.has("color.background")) {
    derived.push({
      path: "color.background",
      category: "color",
      type: "color",
      value: colorValue(surfaces.light.background),
      provenance: "defaulted",
    });
  }
  if (!existingPaths.has("color.foreground")) {
    derived.push({
      path: "color.foreground",
      category: "color",
      type: "color",
      value: colorValue(surfaces.light.foreground),
      provenance: "defaulted",
    });
  }
  if (!existingPaths.has("color.muted")) {
    derived.push({
      path: "color.muted",
      category: "color",
      type: "color",
      value: colorValue(surfaces.light.muted),
      provenance: "derived",
    });
  }
  if (!existingPaths.has("color.border")) {
    derived.push({
      path: "color.border",
      category: "color",
      type: "color",
      value: colorValue(surfaces.light.border),
      provenance: "derived",
    });
  }

  // 4. Standard semantic colors + their foregrounds.
  // L/C targets are tuned per hue for perceptual vividness — e.g. amber reads
  // as saturated at higher lightness than green, which in turn needs higher
  // chroma than red to feel equally vivid.
  const SEMANTIC_DEFAULTS: Record<string, { h: number; l: number; c: number }> = {
    success: { h: 142, l: 0.52, c: 0.19 }, // vivid emerald green
    warning: { h:  75, l: 0.75, c: 0.16 }, // amber — yellows need higher L to not look greenish
    danger:  { h:  25, l: 0.55, c: 0.22 }, // vivid red-orange
  };
  for (const [name, { h, l, c }] of Object.entries(SEMANTIC_DEFAULTS)) {
    const path = `color.${name}`;
    const semanticHex = oklchToHex(l, c, h);
    if (!existingPaths.has(path)) {
      derived.push({
        path,
        category: "color",
        type: "color",
        value: colorValue(semanticHex),
        provenance: "defaulted",
      });
    }
    // Foreground: use the existing value if already imported, otherwise use semanticHex.
    const fgPath = `${path}.foreground`;
    if (!existingPaths.has(fgPath)) {
      const bgHex =
        hexOf(existing.find((t) => t.path === path)?.value) ?? semanticHex;
      derived.push({
        path: fgPath,
        category: "color",
        type: "color",
        value: colorValue(aestheticForeground(bgHex)),
        provenance: "derived",
      });
    }
  }

  // 4b. muted foreground — text that sits on a muted background (e.g. badges,
  // helper text areas). Derived from muted's hex so it always passes AA.
  if (!existingPaths.has("color.muted.foreground")) {
    const mutedHex =
      hexOf(existing.find((t) => t.path === "color.muted")?.value) ??
      surfaces.light.muted;
    derived.push({
      path: "color.muted.foreground",
      category: "color",
      type: "color",
      value: colorValue(aestheticForeground(mutedHex)),
      provenance: "derived",
    });
  }

  // 5. Typography scale — only if the design system has no font-size
  // tokens at all yet.
  if (!hasAnyOf("font-size")) {
    const base = generateTypeScale(16);
    for (const [name, px] of Object.entries(base)) {
      derived.push({
        path: `font-size.${name}`,
        category: "font-size",
        type: "dimension",
        value: dimensionValue(px),
        provenance: "defaulted",
      });
    }
  }

  // 6. Spacing scale.
  if (!hasAnyOf("spacing")) {
    for (const [name, px] of Object.entries(DEFAULT_SPACING_PX)) {
      derived.push({
        path: `spacing.${name}`,
        category: "spacing",
        type: "dimension",
        value: dimensionValue(px),
        provenance: "defaulted",
      });
    }
  }

  // 7. Border radius scale.
  if (!hasAnyOf("border-radius")) {
    for (const [name, px] of Object.entries(DEFAULT_RADIUS_PX)) {
      derived.push({
        path: `border-radius.${name}`,
        category: "border-radius",
        type: "dimension",
        value: dimensionValue(px),
        provenance: "defaulted",
      });
    }
  }

  // 8. Breakpoints.
  if (!hasAnyOf("breakpoint")) {
    for (const [name, px] of Object.entries(DEFAULT_BREAKPOINTS_PX)) {
      derived.push({
        path: `breakpoint.${name}`,
        category: "breakpoint",
        type: "dimension",
        value: dimensionValue(px),
        provenance: "defaulted",
      });
    }
  }

  return derived;
}
