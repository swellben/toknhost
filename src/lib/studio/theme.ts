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
 * Map primitive ramps → shadcn semantic role variables for one mode.
 * Semantic roles ALIAS into ramp steps (never raw values) so editing a seed
 * ripples through every role and into the live preview.
 */
export function resolveSemantic(
  r: Ramps,
  mode: "light" | "dark"
): Record<string, string> {
  const { primary, secondary, neutral, danger, success, warning } = r;

  if (mode === "light") {
    return {
      background: neutral[50],
      foreground: neutral[950],
      card: "#ffffff",
      "card-foreground": neutral[950],
      popover: "#ffffff",
      "popover-foreground": neutral[950],
      primary: primary[600],
      "primary-foreground": aestheticForeground(primary[600]),
      secondary: secondary[100],
      "secondary-foreground": secondary[800],
      muted: neutral[100],
      "muted-foreground": neutral[500],
      accent: neutral[100],
      "accent-foreground": neutral[900],
      destructive: danger[600],
      "destructive-foreground": aestheticForeground(danger[600]),
      border: neutral[200],
      input: neutral[200],
      ring: primary[500],
      "chart-1": primary[500],
      "chart-2": secondary[500],
      "chart-3": success[500],
      "chart-4": warning[500],
      "chart-5": danger[500],
      sidebar: neutral[50],
      "sidebar-foreground": neutral[900],
      "sidebar-primary": primary[600],
      "sidebar-primary-foreground": aestheticForeground(primary[600]),
      "sidebar-accent": neutral[100],
      "sidebar-accent-foreground": neutral[900],
      "sidebar-border": neutral[200],
      "sidebar-ring": primary[500],
    };
  }

  return {
    background: neutral[950],
    foreground: neutral[50],
    card: neutral[900],
    "card-foreground": neutral[50],
    popover: neutral[900],
    "popover-foreground": neutral[50],
    primary: primary[500],
    "primary-foreground": aestheticForeground(primary[500]),
    secondary: secondary[900],
    "secondary-foreground": secondary[100],
    muted: neutral[800],
    "muted-foreground": neutral[400],
    accent: neutral[800],
    "accent-foreground": neutral[100],
    destructive: danger[500],
    "destructive-foreground": aestheticForeground(danger[500]),
    border: neutral[800],
    input: neutral[800],
    ring: primary[400],
    "chart-1": primary[400],
    "chart-2": secondary[400],
    "chart-3": success[400],
    "chart-4": warning[400],
    "chart-5": danger[400],
    sidebar: neutral[900],
    "sidebar-foreground": neutral[100],
    "sidebar-primary": primary[500],
    "sidebar-primary-foreground": aestheticForeground(primary[500]),
    "sidebar-accent": neutral[800],
    "sidebar-accent-foreground": neutral[100],
    "sidebar-border": neutral[800],
    "sidebar-ring": primary[400],
  };
}

export type DerivedTheme = {
  ramps: Ramps;
  light: Record<string, string>;
  dark: Record<string, string>;
};

export function deriveTheme(cfg: ThemeConfig): DerivedTheme {
  // Color source of truth is the working ramps (seed-generated OR hand-edited).
  const ramps = cfg.ramps;
  return {
    ramps,
    light: resolveSemantic(ramps, "light"),
    dark: resolveSemantic(ramps, "dark"),
  };
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

/** Serialize a mode's variables as CSS custom-property declarations. */
function declBlock(vars: Record<string, string>, radius?: number): string {
  const lines = Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`);
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

/** Produce a copy-pasteable shadcn-style theme.css (`:root` + `.dark` + `@theme inline`). */
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
:root {
${declBlock(t.light, cfg.radius)}
}

.dark {
${declBlock(t.dark)}
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
