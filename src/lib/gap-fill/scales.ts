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
