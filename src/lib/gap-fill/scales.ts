import { materialColorScale } from "./material";

export const SCALE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

/**
 * Generates a perceptually-tuned 50–950 scale for a seed color.
 * Delegates to Material Color Utilities (HCT color space) which automatically
 * handles chroma compression at extremes — no garish tints at light steps,
 * proper dark steps without pure black.
 */
export function generateColorScale(seedHex: string): Record<number, string> {
  return materialColorScale(seedHex);
}

/** 1.25 modular type scale from a base font size (px), per CLAUDE.md. */
export function generateTypeScale(basePx = 16) {
  const ratio = 1.25;
  return {
    xs: Math.round(basePx / ratio / ratio),
    sm: Math.round(basePx / ratio),
    base: basePx,
    lg: Math.round(basePx * ratio),
    xl: Math.round(basePx * ratio ** 2),
    "2xl": Math.round(basePx * ratio ** 3),
    "3xl": Math.round(basePx * ratio ** 4),
  };
}

/** 4px-grid spacing scale, per CLAUDE.md. */
export const DEFAULT_SPACING_PX: Record<string, number> = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "6": 24,
  "8": 32,
  "12": 48,
  "16": 64,
  "24": 96,
  "32": 128,
  "48": 192,
  "64": 256,
};

export const DEFAULT_RADIUS_PX: Record<string, number> = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
};

export const DEFAULT_BREAKPOINTS_PX: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

// Below: defaults for the 20 categories gap-fill did not previously cover
// (confirmed via direct DB inspection — every existing design system only
// ever had color/border-radius/breakpoint/font-family/font-size/spacing).
// These are fixed, hue-independent defaults — same convention as spacing/
// radius/breakpoints above: defaulted once if the category is entirely
// absent, not re-derived per seed color. Mode-agnostic, same as those.

export const DEFAULT_FONT_WEIGHT: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const DEFAULT_LINE_HEIGHT: Record<string, number> = {
  tight: 1.2,
  base: 1.5,
  relaxed: 1.75,
};

export const DEFAULT_LETTER_SPACING_PX: Record<string, number> = {
  tight: -0.4,
  base: 0,
  wide: 0.8,
};

export const DEFAULT_PARAGRAPH_SPACING_REM: Record<string, number> = {
  base: 1,
};

export const DEFAULT_TEXT_DECORATION: Record<string, string> = {
  none: "none",
  underline: "underline",
};

export const DEFAULT_TEXT_TRANSFORM: Record<string, string> = {
  none: "none",
  uppercase: "uppercase",
};

export const DEFAULT_BORDER_WIDTH_PX: Record<string, number> = {
  thin: 1,
  base: 2,
  thick: 4,
};

export const DEFAULT_BORDER_STYLE: Record<string, string> = {
  solid: "solid",
  dashed: "dashed",
};

export const DEFAULT_OPACITY: Record<string, number> = {
  disabled: 0.5,
  hover: 0.8,
  full: 1,
};

export const DEFAULT_Z_INDEX: Record<string, number> = {
  dropdown: 1000,
  modal: 1100,
  toast: 1200,
  tooltip: 1300,
};

export const DEFAULT_DURATION_MS: Record<string, number> = {
  fast: 150,
  base: 250,
  slow: 400,
};

export const DEFAULT_EASING: Record<string, { p1x: number; p1y: number; p2x: number; p2y: number }> = {
  linear: { p1x: 0, p1y: 0, p2x: 1, p2y: 1 },
  "ease-in-out": { p1x: 0.4, p1y: 0, p2x: 0.2, p2y: 1 },
  "ease-out": { p1x: 0, p1y: 0, p2x: 0.2, p2y: 1 },
};

export const DEFAULT_ANIMATION: Record<string, string> = {
  spin: "spin",
  pulse: "pulse",
};

export const DEFAULT_SIZING_PX: Record<string, number> = {
  "icon-sm": 16,
  "icon-md": 24,
  "icon-lg": 32,
  "avatar-md": 40,
};

export const DEFAULT_COMPONENT_PX: Record<string, number> = {
  "button-height-md": 40,
  "input-height-md": 40,
};

/** Shadow layer defaults — black at low alpha, scaled per step. Matches
 * the ShadowLayer shape in src/types/tokens.ts. */
export const DEFAULT_SHADOW: Record<
  string,
  { offsetX: number; offsetY: number; blur: number; spread: number; color: string; inset: boolean }[]
> = {
  sm: [{ offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "#0000001a", inset: false }],
  md: [{ offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: "#00000026", inset: false }],
  lg: [{ offsetX: 0, offsetY: 10, blur: 15, spread: -3, color: "#0000002e", inset: false }],
};

export const DEFAULT_DROP_SHADOW: Record<
  string,
  { offsetX: number; offsetY: number; blur: number; spread: number; color: string; inset: boolean }[]
> = {
  sm: [{ offsetX: 0, offsetY: 1, blur: 1, spread: 0, color: "#0000001a", inset: false }],
  md: [{ offsetX: 0, offsetY: 3, blur: 3, spread: 0, color: "#00000022", inset: false }],
};

export const DEFAULT_TEXT_SHADOW: Record<
  string,
  { offsetX: number; offsetY: number; blur: number; spread: number; color: string; inset: boolean }[]
> = {
  sm: [{ offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "#00000040", inset: false }],
};
