import type { TokenCategory, TokenType, TokenValueShape } from "@/types/tokens";
import { hexToOklch, oklchToHex, aestheticForeground, toOklchString, contrastRatio } from "./oklch";
import {
  generateColorScale,
  generateTypeScale,
  DEFAULT_SPACING_PX,
  DEFAULT_RADIUS_PX,
  DEFAULT_BREAKPOINTS_PX,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_LETTER_SPACING_PX,
  DEFAULT_PARAGRAPH_SPACING_REM,
  DEFAULT_TEXT_DECORATION,
  DEFAULT_TEXT_TRANSFORM,
  DEFAULT_BORDER_WIDTH_PX,
  DEFAULT_BORDER_STYLE,
  DEFAULT_OPACITY,
  DEFAULT_Z_INDEX,
  DEFAULT_DURATION_MS,
  DEFAULT_EASING,
  DEFAULT_ANIMATION,
  DEFAULT_SIZING_PX,
  DEFAULT_COMPONENT_PX,
  DEFAULT_SHADOW,
  DEFAULT_DROP_SHADOW,
  DEFAULT_TEXT_SHADOW,
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

// Flat single-value semantic role colors that must NEVER get a generated
// 50–950 scale, even though they pass the SCALE_SUFFIX_RE check (their path
// doesn't end in a scale-step suffix) and have a resolvable hex value. These
// are shadcn-required roles (section 4c below) — shadcn has no concept of
// e.g. "ring-500" or "chart-1-200", so generating one is pure noise, and
// previously caused a real bug: running gap-fill twice produced ~150 spurious
// extra color tokens (card.50..950, ring.50..950, etc.) because this set
// didn't exist yet. Color roles that DO get a real scale (primary, secondary,
// background, foreground, muted, border, success, warning, danger) are not
// listed here on purpose.
const NON_SCALE_COLOR_ROOTS = new Set([
  "color.card",
  "color.popover",
  "color.accent",
  "color.input",
  "color.ring",
  "color.chart.1",
  "color.chart.2",
  "color.chart.3",
  "color.chart.4",
  "color.chart.5",
  "color.sidebar",
  "color.sidebar.primary",
  "color.sidebar.accent",
  "color.sidebar.border",
  "color.sidebar.ring",
]);

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
  // generated scale step or foreground, to avoid scaling a scale, and skip
  // known flat shadcn-role colors that should never get one — see
  // NON_SCALE_COLOR_ROOTS above).
  const baseColors = existing.filter(
    (t) =>
      t.category === "color" &&
      t.type === "color" &&
      !SCALE_SUFFIX_RE.test(t.path) &&
      !NON_SCALE_COLOR_ROOTS.has(t.path) &&
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
  const semanticHexes: Record<string, string> = {};
  for (const [name, { h, l, c }] of Object.entries(SEMANTIC_DEFAULTS)) {
    const path = `color.${name}`;
    const semanticHex = oklchToHex(l, c, h);
    semanticHexes[name] = hexOf(existing.find((t) => t.path === path)?.value) ?? semanticHex;
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
  const mutedHex =
    hexOf(existing.find((t) => t.path === "color.muted")?.value) ?? surfaces.light.muted;
  const mutedForegroundHex = aestheticForeground(mutedHex);
  if (!existingPaths.has("color.muted.foreground")) {
    derived.push({
      path: "color.muted.foreground",
      category: "color",
      type: "color",
      value: colorValue(mutedForegroundHex),
      provenance: "derived",
    });
  }

  // 4c. shadcn-required semantic color roles (card, popover, accent, input,
  // ring, chart.1-5, sidebar.*) — these have no equivalent in any other
  // target framework, but shadcn's own theme structurally requires them, so
  // without this every shadcn-targeted design system silently falls back to
  // shadcn's library defaults for ~21 colors instead of the brand's own.
  // Derived from already-resolved roles (background/muted/border/primary/
  // secondary/semantic), same approach used to backfill the master-reference
  // fixture by hand earlier — never invents a new hue.
  const primaryForegroundHex =
    hexOf(existing.find((t) => t.path === "color.primary.foreground")?.value) ??
    aestheticForeground(primarySeedHex);
  const secondarySeedHex = hexOf(
    baseColors.find((t) => t.path === "color.secondary")?.value
  );

  const SHADCN_ROLE_DEFAULTS: [path: string, hex: string][] = [
    ["color.card", surfaces.light.background],
    ["color.card.foreground", surfaces.light.foreground],
    ["color.popover", surfaces.light.background],
    ["color.popover.foreground", surfaces.light.foreground],
    ["color.accent", mutedHex],
    ["color.accent.foreground", mutedForegroundHex],
    ["color.input", surfaces.light.border],
    ["color.ring", primarySeedHex],
    ["color.chart.1", primarySeedHex],
    ["color.chart.2", secondarySeedHex ?? primarySeedHex],
    ["color.chart.3", semanticHexes.success],
    ["color.chart.4", semanticHexes.warning],
    ["color.chart.5", semanticHexes.danger],
    ["color.sidebar", mutedHex],
    ["color.sidebar.foreground", surfaces.light.foreground],
    ["color.sidebar.primary", primarySeedHex],
    ["color.sidebar.primary.foreground", primaryForegroundHex],
    ["color.sidebar.accent", mutedHex],
    ["color.sidebar.accent.foreground", mutedForegroundHex],
    ["color.sidebar.border", surfaces.light.border],
    ["color.sidebar.ring", primarySeedHex],
  ];
  for (const [path, hex] of SHADCN_ROLE_DEFAULTS) {
    if (!existingPaths.has(path)) {
      derived.push({ path, category: "color", type: "color", value: colorValue(hex), provenance: "defaulted" });
    }
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

  // 9. Font family — only if nothing was imported at all. Mirrors the
  // "Inter, industry-standard SaaS sans-serif" default used by Quick Start
  // (src/app/dashboard/[id]/actions.ts), for the paste-import path that
  // doesn't go through Quick Start's own font field.
  if (!hasAnyOf("font-family")) {
    derived.push({
      path: "font-family.base",
      category: "font-family",
      type: "fontFamily",
      value: { primary: "Inter", stack: ["Inter", "sans-serif"] } as unknown as TokenValueShape,
      provenance: "defaulted",
    });
  }

  // 10. Font weight, line height, letter spacing, paragraph spacing —
  // fixed scales, same convention as spacing/radius/breakpoints above.
  if (!hasAnyOf("font-weight")) {
    for (const [name, value] of Object.entries(DEFAULT_FONT_WEIGHT)) {
      derived.push({ path: `font-weight.${name}`, category: "font-weight", type: "fontWeight", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("line-height")) {
    for (const [name, value] of Object.entries(DEFAULT_LINE_HEIGHT)) {
      derived.push({ path: `line-height.${name}`, category: "line-height", type: "number", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("letter-spacing")) {
    for (const [name, px] of Object.entries(DEFAULT_LETTER_SPACING_PX)) {
      derived.push({ path: `letter-spacing.${name}`, category: "letter-spacing", type: "dimension", value: dimensionValue(px), provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("paragraph-spacing")) {
    for (const [name, rem] of Object.entries(DEFAULT_PARAGRAPH_SPACING_REM)) {
      derived.push({ path: `paragraph-spacing.${name}`, category: "paragraph-spacing", type: "dimension", value: { value: rem, unit: "rem" }, provenance: "defaulted" });
    }
  }

  // 11. Text decoration / transform — fixed string defaults.
  if (!hasAnyOf("text-decoration")) {
    for (const [name, value] of Object.entries(DEFAULT_TEXT_DECORATION)) {
      derived.push({ path: `text-decoration.${name}`, category: "text-decoration", type: "string", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("text-transform")) {
    for (const [name, value] of Object.entries(DEFAULT_TEXT_TRANSFORM)) {
      derived.push({ path: `text-transform.${name}`, category: "text-transform", type: "string", value: { value }, provenance: "defaulted" });
    }
  }

  // 12. Shadows — fixed black-at-low-alpha defaults, same shape used by
  // master-reference. Not hue-tinted; kept simple and broadly applicable.
  if (!hasAnyOf("shadow")) {
    for (const [name, layers] of Object.entries(DEFAULT_SHADOW)) {
      derived.push({ path: `shadow.${name}`, category: "shadow", type: "shadow", value: { layers }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("drop-shadow")) {
    for (const [name, layers] of Object.entries(DEFAULT_DROP_SHADOW)) {
      derived.push({ path: `drop-shadow.${name}`, category: "drop-shadow", type: "shadow", value: { layers }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("text-shadow")) {
    for (const [name, layers] of Object.entries(DEFAULT_TEXT_SHADOW)) {
      derived.push({ path: `text-shadow.${name}`, category: "text-shadow", type: "shadow", value: { layers }, provenance: "defaulted" });
    }
  }

  // 13. Border width / style / composite default — composite derives its
  // color from color.border so it stays visually consistent with whatever
  // border color the design system actually has (imported or just derived).
  if (!hasAnyOf("border-width")) {
    for (const [name, px] of Object.entries(DEFAULT_BORDER_WIDTH_PX)) {
      derived.push({ path: `border-width.${name}`, category: "border-width", type: "dimension", value: dimensionValue(px), provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("border-style")) {
    for (const [name, value] of Object.entries(DEFAULT_BORDER_STYLE)) {
      derived.push({ path: `border-style.${name}`, category: "border-style", type: "string", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("border")) {
    const borderHex = hexOf(existing.find((t) => t.path === "color.border")?.value) ?? surfaces.light.border;
    derived.push({
      path: "border.default",
      category: "border",
      type: "border",
      value: { color: borderHex, width: { value: DEFAULT_BORDER_WIDTH_PX.thin, unit: "px" }, style: DEFAULT_BORDER_STYLE.solid },
      provenance: "defaulted",
    });
  }

  // 14. Opacity, z-index, duration, easing, transition, animation — fixed
  // utility scales with no color/seed dependency.
  if (!hasAnyOf("opacity")) {
    for (const [name, value] of Object.entries(DEFAULT_OPACITY)) {
      derived.push({ path: `opacity.${name}`, category: "opacity", type: "number", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("z-index")) {
    for (const [name, value] of Object.entries(DEFAULT_Z_INDEX)) {
      derived.push({ path: `z-index.${name}`, category: "z-index", type: "number", value: { value }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("duration")) {
    for (const [name, ms] of Object.entries(DEFAULT_DURATION_MS)) {
      derived.push({ path: `duration.${name}`, category: "duration", type: "duration", value: { value: ms, unit: "ms" }, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("easing")) {
    for (const [name, bezier] of Object.entries(DEFAULT_EASING)) {
      derived.push({ path: `easing.${name}`, category: "easing", type: "cubicBezier", value: bezier, provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("transition")) {
    derived.push({
      path: "transition.base",
      category: "transition",
      type: "transition",
      value: {
        duration: { value: DEFAULT_DURATION_MS.base, unit: "ms" },
        delay: { value: 0, unit: "ms" },
        timingFunction: DEFAULT_EASING["ease-in-out"],
      },
      provenance: "defaulted",
    });
  }
  if (!hasAnyOf("animation")) {
    for (const [name, value] of Object.entries(DEFAULT_ANIMATION)) {
      derived.push({ path: `animation.${name}`, category: "animation", type: "string", value: { value }, provenance: "defaulted" });
    }
  }

  // 15. Sizing / component — fixed dimension defaults for common UI element
  // sizes (icons, avatars, buttons, inputs).
  if (!hasAnyOf("sizing")) {
    for (const [name, px] of Object.entries(DEFAULT_SIZING_PX)) {
      derived.push({ path: `sizing.${name}`, category: "sizing", type: "dimension", value: dimensionValue(px), provenance: "defaulted" });
    }
  }
  if (!hasAnyOf("component")) {
    for (const [name, px] of Object.entries(DEFAULT_COMPONENT_PX)) {
      derived.push({ path: `component.${name}`, category: "component", type: "dimension", value: dimensionValue(px), provenance: "defaulted" });
    }
  }

  return derived;
}
