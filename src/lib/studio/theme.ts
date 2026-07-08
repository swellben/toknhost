/**
 * Theme Studio derivation — the V0 core loop.
 *
 * Input: a small set of user-picked SEED colors + radius + font.
 * Output: deterministic 50–950 primitive ramps (via material.ts, no AI),
 * plus the shadcn semantic-role variable maps for light and dark mode that
 * ALIAS into those primitives, plus an exportable theme.css string.
 *
 * See PIVOT-PLAN.md "V0 re-scope" — two-tier token model (Tailwind primitives
 * + shadcn semantic roles), deterministic colors only.
 */

import { materialColorScale } from "@/lib/gap-fill/material";
import { aestheticForeground } from "@/lib/gap-fill/oklch";
import { googleFontsUrl } from "@/lib/google-fonts";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];
export type Ramp = Record<Step, string>;

export type SeedKey = "primary" | "secondary" | "neutral" | "success" | "warning" | "danger";

export type EditMode = "generated" | "manual";

export type ThemeConfig = {
  seeds: Record<SeedKey, string>;
  /** Working 50–950 ramps — the source of truth for color. In "generated"
   * mode these are recomputed from seeds; in "manual" mode the user edits
   * individual steps directly. Semantic roles + export both read from here. */
  ramps: Record<SeedKey, Ramp>;
  /** Whether color scales come from seeds (generated) or are hand-edited. */
  colorMode: EditMode;
  /** Base border radius in rem; shadcn derives sm/md/lg/xl from it. */
  radius: number;
  /** Whether radius comes from a preset (generated) or a hand-set value. */
  radiusMode: EditMode;
  /** Base spacing unit in rem — every padding, margin, gap and size utility
   * multiplies off this one value, so it acts as a global density control. */
  spacing: number;
  /** Whether spacing comes from a preset (generated) or a hand-set value. */
  spacingMode: EditMode;
  /** CSS font-family stack applied to the preview. */
  fontSans: string;
  /** Where the font comes from: the Google catalog, or a user-supplied font. */
  fontSource: FontSource;
  /** Selected Google font family name when fontSource === "google"; else "". */
  fontName: string;
  /** User-supplied font details when fontSource === "custom"; else null. */
  customFont: CustomFont | null;
  /** Raw per-mode overrides for semantic tokens. Un-overridden tokens still
   * derive (alias) from the primitive ramps so primitive edits keep cascading;
   * only explicitly-edited tokens store a raw value here. */
  semanticOverrides: { light: Record<string, string>; dark: Record<string, string> };
};

export type FontSource = "google" | "custom";

export type CustomFont = {
  /** Pasted URL, or uploaded via a local object URL. */
  method: "url" | "upload";
  /** font-family name to reference in CSS. */
  family: string;
  /** Stylesheet URL / font-file URL / object URL depending on method+kind. */
  src: string;
  /** "stylesheet" → load via @import/<link>; "fontfile" → @font-face. */
  kind: "stylesheet" | "fontfile";
  /** Original filename for uploads (used in the export self-host note). */
  fileName?: string;
};

const DEFAULT_SEEDS: Record<SeedKey, string> = {
  primary: "#4f46e5", // indigo
  secondary: "#0ea5e9", // sky
  neutral: "#71717a", // zinc-ish
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

export const DEFAULT_THEME: ThemeConfig = {
  seeds: DEFAULT_SEEDS,
  ramps: buildRamps(DEFAULT_SEEDS),
  colorMode: "generated",
  radius: 0.625,
  radiusMode: "generated",
  spacing: 0.25, // Tailwind's default base unit
  spacingMode: "generated",
  fontSans:
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  fontSource: "google",
  fontName: "",
  customFont: null,
  semanticOverrides: { light: {}, dark: {} },
};

/** Bounds for the manual spacing-base slider (rem). */
export const SPACING_RANGE = { min: 0.15, max: 0.6, step: 0.01 };

/** Named Tailwind spacing steps shown (read-only) so users see the derived
 * scale that the one base unit produces. */
export const SPACING_SCALE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

export const SPACING_OPTIONS: { label: string; value: number; hint: string }[] =
  [
    { label: "Compact", value: 0.2, hint: "Dense — more on screen" },
    { label: "Default", value: 0.25, hint: "Tailwind default" },
    { label: "Comfortable", value: 0.3, hint: "Roomier" },
    { label: "Spacious", value: 0.35, hint: "Airy — lots of breathing room" },
    { label: "Extra spacious", value: 0.4, hint: "Very open layout" },
    { label: "Generous", value: 0.45, hint: "Big, relaxed spacing" },
    { label: "Expansive", value: 0.5, hint: "Maximum breathing room" },
  ];

export const FONT_OPTIONS: { label: string; value: string }[] = [
  {
    label: "DM Sans (default)",
    value: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
  },
  { label: "System sans", value: "ui-sans-serif, system-ui, sans-serif" },
  {
    label: "Geometric",
    value: '"Avenir Next", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
  },
  { label: "Serif", value: 'Georgia, Cambria, "Times New Roman", serif' },
  {
    label: "Mono",
    value: 'var(--font-dm-mono), ui-monospace, "SFMono-Regular", monospace',
  },
];

export const RADIUS_OPTIONS: { label: string; value: number; hint: string }[] = [
  { label: "Sharp", value: 0, hint: "Square corners" },
  { label: "Subtle", value: 0.375, hint: "Slightly rounded" },
  { label: "Rounded", value: 0.625, hint: "Balanced default" },
  { label: "Soft", value: 0.875, hint: "Noticeably round" },
  { label: "Pill", value: 1.25, hint: "Maximum rounding" },
];

/** Bounds for the manual radius-base slider (rem). */
export const RADIUS_RANGE = { min: 0, max: 2, step: 0.05 };

/** shadcn derives these named radii from the base `--radius` (matches the
 * `@theme inline` block in the exported theme.css). */
export const RADIUS_DERIVED: { name: string; offsetPx: number }[] = [
  { name: "sm", offsetPx: -4 },
  { name: "md", offsetPx: -2 },
  { name: "lg", offsetPx: 0 },
  { name: "xl", offsetPx: 4 },
];

export const SEED_META: { key: SeedKey; label: string; hint: string }[] = [
  { key: "primary", label: "Brand primary", hint: "Main action / brand color" },
  { key: "secondary", label: "Brand secondary", hint: "Secondary brand hue" },
  { key: "neutral", label: "Neutral", hint: "Surfaces, text, borders" },
  { key: "success", label: "Success", hint: "Positive status" },
  { key: "warning", label: "Warning", hint: "Caution status" },
  { key: "danger", label: "Danger", hint: "Destructive / error" },
];

export const SEED_KEYS: SeedKey[] = SEED_META.map((m) => m.key);

/**
 * CSS names for the primitive color scales in the export/MCP output —
 * deliberately DISTINCT from the shadcn semantic role names (primary/secondary/
 * accent/…) so `--color-brand-500` (primitive) and `--color-primary` (semantic
 * role) never collide. Semantic tokens `var()`-reference these.
 */
export const PRIMITIVE_SCALE_NAME: Record<SeedKey, string> = {
  primary: "brand",
  secondary: "brand-secondary",
  neutral: "neutral",
  success: "success",
  warning: "warning",
  danger: "danger",
};

export type Ramps = Record<SeedKey, Ramp>;

export function buildRamps(seeds: Record<SeedKey, string>): Ramps {
  return {
    primary: materialColorScale(seeds.primary) as Ramp,
    secondary: materialColorScale(seeds.secondary) as Ramp,
    neutral: materialColorScale(seeds.neutral) as Ramp,
    success: materialColorScale(seeds.success) as Ramp,
    warning: materialColorScale(seeds.warning) as Ramp,
    danger: materialColorScale(seeds.danger) as Ramp,
  };
}

/**
 * Where a semantic token gets its value: an ALIAS to a primitive ramp step
 * (the design-system-correct default — preserved through export & the MCP so a
 * consumer gets `--primary: var(--color-primary-600)`, not a hardcoded hex), or
 * a RAW value (a computed foreground, a literal like #fff, or a user override).
 */
export type SemanticSource =
  | { kind: "alias"; family: SeedKey; step: Step }
  | { kind: "raw"; value: string };

const alias = (family: SeedKey, step: Step): SemanticSource => ({
  kind: "alias",
  family,
  step,
});
const raw = (value: string): SemanticSource => ({ kind: "raw", value });

/**
 * The canonical semantic → primitive mapping for one mode. This is the single
 * source of truth for how shadcn roles alias the ramps; resolveSemantic()
 * (hex, for the preview), the aliased CSS export, and the DB row translator all
 * derive from it. Foregrounds/literals are `raw` (not primitive-scale aliases).
 */
export function semanticSourceMap(
  r: Ramps,
  mode: "light" | "dark"
): Record<string, SemanticSource> {
  const fg = (hex: string) => raw(aestheticForeground(hex));

  if (mode === "light") {
    return {
      background: alias("neutral", 50),
      foreground: alias("neutral", 950),
      card: raw("#ffffff"),
      "card-foreground": alias("neutral", 950),
      popover: raw("#ffffff"),
      "popover-foreground": alias("neutral", 950),
      primary: alias("primary", 600),
      "primary-foreground": fg(r.primary[600]),
      secondary: alias("secondary", 100),
      "secondary-foreground": alias("secondary", 800),
      muted: alias("neutral", 100),
      "muted-foreground": alias("neutral", 500),
      accent: alias("neutral", 100),
      "accent-foreground": alias("neutral", 900),
      destructive: alias("danger", 600),
      "destructive-foreground": fg(r.danger[600]),
      border: alias("neutral", 200),
      input: alias("neutral", 200),
      ring: alias("primary", 500),
      "chart-1": alias("primary", 500),
      "chart-2": alias("secondary", 500),
      "chart-3": alias("success", 500),
      "chart-4": alias("warning", 500),
      "chart-5": alias("danger", 500),
      sidebar: alias("neutral", 50),
      "sidebar-foreground": alias("neutral", 900),
      "sidebar-primary": alias("primary", 600),
      "sidebar-primary-foreground": fg(r.primary[600]),
      "sidebar-accent": alias("neutral", 100),
      "sidebar-accent-foreground": alias("neutral", 900),
      "sidebar-border": alias("neutral", 200),
      "sidebar-ring": alias("primary", 500),
    };
  }

  return {
    background: alias("neutral", 950),
    foreground: alias("neutral", 50),
    card: alias("neutral", 900),
    "card-foreground": alias("neutral", 50),
    popover: alias("neutral", 900),
    "popover-foreground": alias("neutral", 50),
    primary: alias("primary", 500),
    "primary-foreground": fg(r.primary[500]),
    secondary: alias("secondary", 900),
    "secondary-foreground": alias("secondary", 100),
    muted: alias("neutral", 800),
    "muted-foreground": alias("neutral", 400),
    accent: alias("neutral", 800),
    "accent-foreground": alias("neutral", 100),
    destructive: alias("danger", 500),
    "destructive-foreground": fg(r.danger[500]),
    border: alias("neutral", 800),
    input: alias("neutral", 800),
    ring: alias("primary", 400),
    "chart-1": alias("primary", 400),
    "chart-2": alias("secondary", 400),
    "chart-3": alias("success", 400),
    "chart-4": alias("warning", 400),
    "chart-5": alias("danger", 400),
    sidebar: alias("neutral", 900),
    "sidebar-foreground": alias("neutral", 100),
    "sidebar-primary": alias("primary", 500),
    "sidebar-primary-foreground": fg(r.primary[500]),
    "sidebar-accent": alias("neutral", 800),
    "sidebar-accent-foreground": alias("neutral", 100),
    "sidebar-border": alias("neutral", 800),
    "sidebar-ring": alias("primary", 400),
  };
}

/**
 * Resolve semantic tokens to concrete hex for one mode (used by the live
 * preview). Derived from semanticSourceMap so it stays in lockstep with the
 * alias model — output is identical to the old inline table.
 */
export function resolveSemantic(
  r: Ramps,
  mode: "light" | "dark"
): Record<string, string> {
  const src = semanticSourceMap(r, mode);
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(src)) {
    out[k] = s.kind === "alias" ? r[s.family][s.step] : s.value;
  }
  return out;
}

/**
 * Per-token source for a config + mode, with user overrides applied. An
 * override becomes a `raw` value — the explicit escape hatch from aliasing.
 * This is what the aliased export and the DB→rows translator consume.
 */
export function semanticSources(
  cfg: ThemeConfig,
  mode: "light" | "dark"
): Record<string, SemanticSource> {
  const out: Record<string, SemanticSource> = {
    ...semanticSourceMap(cfg.ramps, mode),
  };
  for (const [k, v] of Object.entries(cfg.semanticOverrides[mode])) {
    out[k] = { kind: "raw", value: v };
  }
  return out;
}

export type DerivedTheme = {
  ramps: Ramps;
  light: Record<string, string>;
  dark: Record<string, string>;
};

export function deriveTheme(cfg: ThemeConfig): DerivedTheme {
  // Color source of truth is the working ramps (seed-generated OR hand-edited).
  // Semantic tokens derive (alias) from the ramps, then any explicit per-mode
  // overrides are layered on top so un-edited tokens keep cascading.
  const ramps = cfg.ramps;
  return {
    ramps,
    light: { ...resolveSemantic(ramps, "light"), ...cfg.semanticOverrides.light },
    dark: { ...resolveSemantic(ramps, "dark"), ...cfg.semanticOverrides.dark },
  };
}

/** Names of the semantic tokens the studio manages (the shadcn roles). */
export const SEMANTIC_TOKEN_NAMES = Object.keys(
  resolveSemantic(DEFAULT_THEME.ramps, "light")
);

export type ParsedTokens = {
  light: Record<string, string>;
  dark: Record<string, string>;
  radius?: number;
  spacing?: number;
  count: number;
};

/** Grab the body between the first `{` and its next `}` after a selector. Our
 * exported blocks are flat (no nesting), so a simple brace scan is enough. */
function cssBlock(text: string, selector: RegExp): string | null {
  const m = selector.exec(text);
  if (!m) return null;
  const open = text.indexOf("{", m.index);
  if (open === -1) return null;
  const close = text.indexOf("}", open);
  return text.slice(open + 1, close === -1 ? undefined : close);
}

function remNumber(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Parse pasted CSS into studio tokens. Reads `:root {}` (light) and `.dark {}`
 * (dark) custom-property declarations; recognizes the semantic token names plus
 * `--radius`/`--spacing`. Un-scoped text is treated as light. Unknown props are
 * ignored. Colors are kept verbatim (hex/oklch/etc.). This round-trips what
 * buildThemeCss() exports; primitive ramps aren't reconstructed (the export
 * doesn't carry per-step values), so imported semantics arrive as overrides.
 */
export function parseThemeTokens(text: string): ParsedTokens {
  const names = new Set(SEMANTIC_TOKEN_NAMES);
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const out: ParsedTokens = { light, dark, count: 0 };

  const readInto = (block: string, target: Record<string, string>) => {
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
      const key = m[1].trim();
      const val = m[2].trim();
      if (key === "radius") {
        const n = remNumber(val);
        if (n !== undefined) { out.radius = n; out.count++; }
      } else if (key === "spacing") {
        const n = remNumber(val);
        if (n !== undefined) { out.spacing = n; out.count++; }
      } else if (names.has(key) && !val.startsWith("var(")) {
        // Skip aliased references (e.g. `var(--color-brand-600)`) — without the
        // primitives they'd be broken overrides; only raw values are imported.
        target[key] = val;
        out.count++;
      }
    }
  };

  const root = cssBlock(text, /:root\s*\{/);
  const darkBlock = cssBlock(text, /\.dark\s*\{/);
  if (root !== null) readInto(root, light);
  if (darkBlock !== null) readInto(darkBlock, dark);
  if (root === null && darkBlock === null) readInto(text, light);

  return out;
}

/**
 * Inline style object to override CSS variables on a preview wrapper.
 * globals.css maps `--color-primary: var(--primary)` etc. via `@theme inline`,
 * so overriding `--primary` (and `--radius`) re-themes real shadcn components.
 */
export function previewVars(
  vars: Record<string, string>,
  radius: number,
  spacing: number
): Record<string, string> {
  const out: Record<string, string> = {
    "--radius": `${radius}rem`,
    "--spacing": `${spacing}rem`,
  };
  for (const [k, v] of Object.entries(vars)) out[`--${k}`] = v;
  return out;
}

/** CSS value for a semantic source: a var() reference to a primitive scale
 * (alias) or the raw value (override / computed foreground / literal). */
function semanticCssValue(s: SemanticSource): string {
  return s.kind === "alias"
    ? `var(--color-${PRIMITIVE_SCALE_NAME[s.family]}-${s.step})`
    : s.value;
}

/** `@theme` declarations for the primitive color scales (raw values). */
function primitivesBlock(ramps: Ramps): string {
  const lines: string[] = [];
  for (const family of SEED_KEYS) {
    const scale = PRIMITIVE_SCALE_NAME[family];
    for (const step of STEPS) {
      lines.push(`  --color-${scale}-${step}: ${ramps[family][step]};`);
    }
  }
  return lines.join("\n");
}

/** `:root`/`.dark` semantic declarations — aliases emit as `var()` refs to the
 * primitives; only explicit overrides (and computed foregrounds) are raw. */
function semanticBlock(
  cfg: ThemeConfig,
  mode: "light" | "dark",
  radius?: number
): string {
  const src = semanticSources(cfg, mode);
  const lines = Object.entries(src).map(
    ([name, s]) => `  --${name}: ${semanticCssValue(s)};`
  );
  if (radius !== undefined) lines.push(`  --radius: ${radius}rem;`);
  return lines.join("\n");
}

/** CSS `@import`/`@font-face` needed to make the chosen font resolve for a
 * consumer. Placed between the Tailwind import and `:root`. */
function buildFontPrelude(cfg: ThemeConfig): string {
  if (cfg.fontSource === "google" && cfg.fontName) {
    return `/* Google font "${cfg.fontName}" — or self-host to avoid a request to Google at runtime. */\n@import url("${googleFontsUrl(cfg.fontName)}");\n`;
  }
  const cf = cfg.customFont;
  if (cfg.fontSource === "custom" && cf) {
    if (cf.method === "upload") {
      // An uploaded font's object URL is local/temporary and can't be shipped,
      // and redistributing the file for the user would be a licensing problem
      // (see PIVOT-PLAN). So we DON'T host it — we emit a ready-to-paste
      // @font-face at a conventional path and tell them to drop the file there.
      const fileName = cf.fileName ?? `${slugify(cf.family)}.woff2`;
      const fmt = fontFormat(fileName);
      return `/* Save your uploaded font file to  public/fonts/${fileName}  (served at /fonts/${fileName}). */\n@font-face {\n  font-family: "${cf.family}";\n  src: url("/fonts/${fileName}")${fmt ? ` format("${fmt}")` : ""};\n  font-display: swap;\n}\n`;
    }
    if (cf.kind === "stylesheet") {
      return `/* Custom font stylesheet */\n@import url("${cf.src}");\n`;
    }
    const fmt = fontFormat(cf.src);
    return `@font-face {\n  font-family: "${cf.family}";\n  src: url("${cf.src}")${fmt ? ` format("${fmt}")` : ""};\n  font-display: swap;\n}\n`;
  }
  return "";
}

/** CSS `format()` keyword for a font path/URL, by extension. */
function fontFormat(pathOrUrl: string): string {
  const ext = pathOrUrl.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "woff2":
      return "woff2";
    case "woff":
      return "woff";
    case "ttf":
      return "truetype";
    case "otf":
      return "opentype";
    default:
      return "";
  }
}

/** Filesystem-safe slug for a font family name (fallback filename). */
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "font";
}

/**
 * Produce a copy-pasteable, alias-preserving Tailwind v4 + shadcn theme.css:
 * primitive scales in `@theme`, semantic tokens in `:root`/`.dark` that
 * `var()`-reference them (only overrides are hardcoded), and the `@theme inline`
 * role→utility mapping. Design-system-correct — no flattened semantics.
 */
export function buildThemeCss(t: DerivedTheme, cfg: ThemeConfig): string {
  const roleNames = Object.keys(t.light);
  const themeInline = roleNames
    .map((n) => `  --color-${n}: var(--${n});`)
    .join("\n");

  // Font prelude. `@import` must precede other rules, so it goes right after
  // the Tailwind import; @font-face can follow. See buildFontPrelude.
  const fontPrelude = buildFontPrelude(cfg);

  return `/* Generated by ToknHost — Design your theme once. Use it everywhere. */
@import "tailwindcss";
${fontPrelude}
/* Primitives — raw color scales that the semantic tokens reference. */
@theme {
${primitivesBlock(cfg.ramps)}
}

/* Semantic tokens — alias the primitives above; only your explicit overrides
   are hardcoded. Light mode. */
:root {
${semanticBlock(cfg, "light", cfg.radius)}
}

/* Dark mode. */
.dark {
${semanticBlock(cfg, "dark")}
}

@theme inline {
  --font-sans: ${cfg.fontSans};
  --spacing: ${cfg.spacing}rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
${themeInline}
}
`;
}
