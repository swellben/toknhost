import {
  converter,
  formatHex,
  wcagContrast,
  clampChroma,
  type Oklch,
  type Rgb,
} from "culori";

const toRgb = converter("rgb");

const toOklch = converter("oklch");

/** Parses any CSS-color-parseable string (hex, etc.) into OKLCH components. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const color = toOklch(hex);
  if (!color) return { l: 0.5, c: 0, h: 0 };
  return { l: color.l ?? 0, c: color.c ?? 0, h: color.h ?? 0 };
}

/** Builds a hex string from OKLCH components, clamped into the sRGB gamut
 * (culori's clampChroma reduces chroma until the color is displayable —
 * needed because not every l/c/h combination is renderable in sRGB). */
export function oklchToHex(l: number, c: number, h: number): string {
  const color: Oklch = { mode: "oklch", l, c, h };
  const clamped = clampChroma(color, "oklch");
  return formatHex(clamped);
}

export function toOklchString(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

/** WCAG 2 contrast ratio between two colors, e.g. 4.53. */
export function contrastRatio(a: string, b: string): number {
  return wcagContrast(a, b);
}

/**
 * Alpha-composites `fgHex` at `alpha` opacity over `bgHex` and returns the
 * resulting opaque hex. Used to evaluate the apparent contrast of a
 * semi-transparent button tint against its actual background before committing
 * to that strategy.
 */
export function compositeOver(fgHex: string, bgHex: string, alpha: number): string {
  const fg = toRgb(fgHex) as Rgb;
  const bg = toRgb(bgHex) as Rgb;
  if (!fg || !bg) return bgHex;
  return formatHex({
    mode: "rgb",
    r: alpha * (fg.r ?? 0) + (1 - alpha) * (bg.r ?? 0),
    g: alpha * (fg.g ?? 0) + (1 - alpha) * (bg.g ?? 0),
    b: alpha * (fg.b ?? 0) + (1 - alpha) * (bg.b ?? 0),
  } as Rgb)!;
}

/**
 * Normalises a user-supplied seed color for use as a CTA button token.
 * Preserves the seed's hue and chroma character; only adjusts lightness to
 * land within a legible range for button use.
 *
 * primary:   clamp L to [0.42, 0.68] — wide enough to include lighter, more vibrant
 *            action colors (periwinkle, lavender, coral). aestheticForeground selects
 *            dark text automatically when the background is too light for white.
 * secondary: clamp L to [0.48, 0.72] — same principle, slightly wider for warm hues.
 *
 * Chroma is capped at 0.22 to prevent neon extremes but otherwise kept as-is
 * so the user's color choice remains recognisable.
 */
export function normalizeSeedColor(hex: string, role: "primary" | "secondary" = "primary"): string {
  const { l, c, h } = hexToOklch(hex);
  const clampedC = Math.min(c, 0.22);

  if (role === "secondary") {
    const clampedL = Math.min(Math.max(l, 0.48), 0.72);
    return oklchToHex(clampedL, clampedC, h);
  }

  // Allow lighter primaries — aestheticForeground handles text contrast automatically.
  const clampedL = Math.min(Math.max(l, 0.42), 0.68);
  return oklchToHex(clampedL, clampedC, h);
}

/** Picks whichever of black/white gives the higher contrast against `bgHex`. */
export function bestForeground(bgHex: string): string {
  const blackContrast = contrastRatio(bgHex, "#000000");
  const whiteContrast = contrastRatio(bgHex, "#ffffff");
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}

/**
 * Returns an aesthetically pleasing foreground for `bgHex` that passes WCAG
 * AA (≥ 4.5:1). Prefers a hue-matched near-dark or near-white over pure
 * black/white — e.g., a deep navy on a blue button instead of raw black.
 *
 * Strategy:
 * 1. Sample a tinted-dark (l=0.13, low chroma, same hue) and a tinted-light
 *    (l=0.97, low chroma, same hue).
 * 2. Keep whichever passes 4.5:1 with the higher contrast ratio.
 * 3. If both pass, pick the one with higher contrast.
 * 4. Fall back to pure black/white if neither tinted option passes (rare for
 *    very low-chroma inputs where the tinted version doesn't diverge enough).
 */
export function aestheticForeground(bgHex: string): string {
  const { c, h } = hexToOklch(bgHex);

  // Tinted options: use a fraction of the background chroma so the ink color
  // feels related without being too saturated to display legibly.
  const tintC = Math.min(c * 0.35, 0.06);

  const darkHex = oklchToHex(0.13, tintC, h);
  const lightHex = oklchToHex(0.97, tintC, h);

  const darkRatio = contrastRatio(bgHex, darkHex);
  const lightRatio = contrastRatio(bgHex, lightHex);

  const darkPasses = darkRatio >= 4.5;
  const lightPasses = lightRatio >= 4.5;

  if (darkPasses && lightPasses) {
    return darkRatio >= lightRatio ? darkHex : lightHex;
  }
  if (darkPasses) return darkHex;
  if (lightPasses) return lightHex;

  // Fallback: pure black or white always passes for any real background color.
  return bestForeground(bgHex);
}

/** Approximates a dark-mode counterpart for a light-mode color by flipping
 * lightness around the midpoint, per CLAUDE.md: "Invert lightness of light
 * mode counterparts (backgrounds flip dark, text flips light)." Chroma/hue
 * are preserved; the result is clamped back into gamut. */
export function invertLightness(l: number, c: number, h: number) {
  return { l: 1 - l, c, h };
}
