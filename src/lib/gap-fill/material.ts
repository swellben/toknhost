/**
 * Ramp-based perceptual color system.
 *
 * Inspired by the approach in the working palette generator:
 *
 *   1. Build an 11-step OKLCH ramp where chroma follows a continuous envelope
 *      that peaks at the perceptual mid-tone (L=0.58) and tapers toward the
 *      light/dark ends — mirroring how real pigments behave. No hardcoded
 *      per-step percentages; one formula covers all steps.
 *
 *   2. Light and dark modes draw from the SAME ramp, just from different
 *      positions. No separate inversion function; dark mode is structurally
 *      guaranteed to be harmonious because everything shares the same hue and
 *      chroma envelope.
 *
 *   3. CTA tokens (color.primary / color.secondary) get their dark value by
 *      searching for the lightest OKLCH step that achieves ≥3.5:1 contrast on
 *      the dark surface (L=0.18). Warm hues land darker; cool hues land lighter.
 *
 *   4. Neutral ramp: same hue, fixed C=0.012 → "warm grays" that feel related
 *      to the brand without being saturated. Used for all surfaces / text.
 */

import { oklchToHex, hexToOklch, toOklchString, aestheticForeground, contrastRatio } from "./oklch";
import { converter, formatHex as culoriFormatHex } from "culori";

export const STEP_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// HSL-based scale — proven approach from the working palette generator.
// Uses HSL (not OKLCH) because saturation in HSL maps naturally to "vivid"
// for warm hues like orange; OKLCH chroma does not have this property.
const toHsl = converter("hsl");

// Lightness targets (%) per step — directly from the palette generator.
const HSL_LIGHTNESS = [97, 94, 86, 76, 64, 50, 39, 30, 21, 14, 9];

function hslSatEnvelope(s: number, step: number): number {
  if (step <= 100) return Math.max(28, s * 0.55);  // raised floor: step-50/100 must be visibly tinted
  if (step <= 200) return Math.max(22, s * 0.55);
  if (step <= 400) return s * 0.82;
  if (step <= 600) return s;
  if (step <= 800) return s * 0.90;
  return s * 0.75;
}

// Hue drift per step — mirrors real pigment behaviour: shadows pull toward
// blue-violet, tints drift slightly warm. Makes scales read as hand-crafted
// rather than mechanically uniform.
const HUE_DRIFT: Record<number, number> = {
  50: -6, 100: -4, 200: -2,
  300: 0, 400: 0, 500: 0, 600: 0,
  700: 4, 800: 7, 900: 9, 950: 11,
};

function applyHueDrift(h: number, step: number): number {
  const drift = HUE_DRIFT[step] ?? 0;
  return ((h + drift) % 360 + 360) % 360;
}

const ANCHOR_INDEX = STEP_NAMES.indexOf(500); // 5
const LIGHT_CEILING = 97;
const DARK_FLOOR = 9;

/**
 * Generates a 50–950 color scale from a seed hex, anchored so step 500
 * IS the seed color exactly — not just hue/saturation-matched at an
 * independently-fixed lightness.
 *
 * Previously this only extracted hue+saturation from the seed and placed
 * every step (including 500) on a fixed lightness ladder regardless of the
 * seed's own lightness. That meant a real brand color almost never appeared
 * anywhere in its own generated scale — e.g. a dark seed like #2a6500
 * (~20% lightness) landed nowhere near step 500 (fixed at 50% lightness),
 * closer to step 800 instead. Found live: an external AI tool (Lovable)
 * consuming our MCP tokens used `bg-primary-500` for a primary button,
 * reasonably expecting 500 to be "the base/main color" (the convention in
 * Tailwind, Radix, Material, etc.) and got an unrelated bright lime green
 * instead of the actual brand color.
 *
 * Fix: step 500 always uses the seed hex exactly. The other 10 steps are
 * computed as before (same hue drift, same saturation envelope) but their
 * lightness is now proportionally interpolated FROM the seed's own
 * lightness toward a light ceiling (lighter steps) or dark floor (darker
 * steps), preserving the original ramp's relative spacing/shape — rather
 * than an absolute, seed-independent ladder.
 *
 * The ceiling/floor are pushed outward (never inward) to stay strictly
 * above/below the seed's own lightness — NOT by clamping the seed's
 * lightness itself away from its true value. An earlier version of this
 * fix did the latter (clamped the anchor used for neighbor steps but kept
 * step 500 at the literal unclamped seed), which broke monotonic ordering
 * for extreme seeds: a near-white seed could end up LIGHTER at step 500
 * than at step 400, since 400 was computed from a clamped, slightly-darker
 * anchor. Expanding the ceiling/floor instead keeps every step computed
 * from the exact same seed lightness, so the ramp can't invert.
 */
export function materialColorScale(seedHex: string): Record<number, string> {
  const hsl = toHsl(seedHex);
  const h = hsl?.h ?? 0;
  const s = (hsl?.s ?? 0) * 100;  // culori 0–1 → 0–100
  const seedL = (hsl?.l ?? 0.5) * 100;
  const ceiling = Math.max(LIGHT_CEILING, seedL + 1);
  const floor = Math.min(DARK_FLOOR, seedL - 1);

  const scale: Record<number, string> = {};
  STEP_NAMES.forEach((step, i) => {
    if (step === 500) {
      scale[500] = seedHex.toLowerCase();
      return;
    }
    const sat = hslSatEnvelope(s, step);
    const hDrifted = applyHueDrift(h, step);

    const l =
      i < ANCHOR_INDEX
        ? seedL +
          ((HSL_LIGHTNESS[i] - HSL_LIGHTNESS[ANCHOR_INDEX]) /
            (HSL_LIGHTNESS[0] - HSL_LIGHTNESS[ANCHOR_INDEX])) *
            (ceiling - seedL)
        : seedL -
          ((HSL_LIGHTNESS[ANCHOR_INDEX] - HSL_LIGHTNESS[i]) /
            (HSL_LIGHTNESS[ANCHOR_INDEX] - HSL_LIGHTNESS[HSL_LIGHTNESS.length - 1])) *
            (seedL - floor);

    scale[step] = culoriFormatHex({ mode: "hsl", h: hDrifted, s: sat / 100, l: l / 100 })!;
  });
  return scale;
}

// OKLCH lightness stops — used for neutral ramp and dark-mode inversion
const L_STEPS = [0.97, 0.93, 0.87, 0.78, 0.68, 0.58, 0.50, 0.42, 0.34, 0.26, 0.18];

// Keep OKLCH chroma envelope for dark-mode inversion (still needed there)
function chromaEnvelope(l: number, baseChroma: number): number {
  const dist = Math.abs(l - 0.58) / 0.58;
  return Math.min(baseChroma * (1 - 0.55 * dist), 0.37);
}

/**
 * 11-step neutral ramp: same hue, fixed low chroma (C=0.012).
 * "Warm grays" — related to the brand but not saturated. Used for
 * all surface, text, and border tokens.
 */
function neutralRamp(hue: number): string[] {
  return L_STEPS.map((l) => oklchToHex(l, 0.012, hue));
}

/**
 * Surface token defaults (background, foreground, muted, border) derived
 * from the neutral ramp so all surfaces feel "of a piece" with the brand.
 *
 * Index mapping:
 *   N[0]  = L 0.97 (lightest)   N[10] = L 0.18 (darkest)
 *   Light mode draws from the light end; dark mode draws from the dark end.
 */
export function materialSurfaces(primaryHex: string): {
  light: { background: string; foreground: string; muted: string; mutedForeground: string; border: string };
  dark:  { background: string; foreground: string; muted: string; mutedForeground: string; border: string };
} {
  const { h } = hexToOklch(primaryHex);
  const N = neutralRamp(h);

  return {
    light: {
      background:      N[0],   // L=0.97 — tinted near-white
      foreground:      N[10],  // L=0.18 — tinted near-black
      muted:           N[1],   // L=0.93
      mutedForeground: N[6],   // L=0.50
      border:          N[2],   // L=0.87
    },
    dark: {
      background:      N[10],  // L=0.18 — tinted near-black
      foreground:      N[1],   // L=0.93 — near-white
      muted:           N[9],   // L=0.26
      mutedForeground: N[4],   // L=0.68
      border:          N[8],   // L=0.34
    },
  };
}

type ColorValue = { hex: string; oklch: string; space: string };

/**
 * Dark-mode CTA pair (container + foreground) using contrast-anchored step selection.
 *
 * Rather than hardcoding L=0.68, we find the lightest step that achieves ≥3.5:1
 * contrast against the dark surface (L=0.18 neutral). This guarantees warm hues
 * (amber, coral) don't silently produce unreadable dark-mode CTAs, and lets cool
 * hues (periwinkle, cyan) land as light/vivid as possible on dark surfaces.
 */
export function ctaDarkPair(lightHex: string): { container: ColorValue; foreground: ColorValue } {
  const { c, h } = hexToOklch(lightHex);

  // Hue-matched dark surface — same hue the CTA will sit on top of
  const darkBgHex = oklchToHex(0.18, 0.012, h);

  // Try from lightest to darkest; stop at the first step that passes 3.5:1
  const candidateL = [0.82, 0.78, 0.72, 0.68, 0.62, 0.58, 0.50];
  let darkL = 0.68;
  for (const l of candidateL) {
    const testHex = oklchToHex(l, chromaEnvelope(l, c), h);
    if (contrastRatio(darkBgHex, testHex) >= 3.5) {
      darkL = l;
      break;
    }
  }

  const darkC = chromaEnvelope(darkL, c);
  const containerHex = oklchToHex(darkL, darkC, h);
  const foregroundHex = aestheticForeground(containerHex);

  return {
    container: {
      hex: containerHex,
      oklch: toOklchString(darkL, darkC, h),
      space: "oklch",
    },
    foreground: {
      hex: foregroundHex,
      oklch: (({ l, c, h }) => toOklchString(l, c, h))(hexToOklch(foregroundHex)),
      space: "oklch",
    },
  };
}

/**
 * Dark-mode equivalent for non-CTA color tokens (scale steps, semantic colors,
 * borders, etc.). Uses ramp mirror logic: reflects L across the mid-tone
 * anchor (L=0.58) so a step-600 color (L=0.50) becomes a step-400 equivalent
 * (L=0.66), and a near-white surface (L=0.97) maps to a near-black (L=0.19).
 * Chroma follows the envelope at the new lightness.
 */
export function materialDarkInvert(hex: string): string {
  const { l, c, h } = hexToOklch(hex);

  // Mirror L across the 0.58 mid-tone anchor: 0.58 + (0.58 - l) = 1.16 - l
  const mirrorL = Math.min(Math.max(1.16 - l, L_STEPS[L_STEPS.length - 1]), L_STEPS[0]);

  // For surface-like colors (very light or very dark), keep chroma very low
  // so the result reads as a tinted neutral rather than a vivid color.
  const isSurface = l > 0.85 || l < 0.22;
  const darkC = isSurface
    ? Math.min(chromaEnvelope(mirrorL, c), 0.015)
    : chromaEnvelope(mirrorL, c);

  return oklchToHex(mirrorL, darkC, h);
}
