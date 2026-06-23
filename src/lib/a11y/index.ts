import { checkContrast } from "./contrast";
import { compositeOver } from "@/lib/gap-fill/oklch";

export { checkContrast } from "./contrast";
export type { ContrastCheck } from "./contrast";

export interface ColorTokenRef {
  id: string;
  path: string;
  hex: string;
}

export interface AccessibilityCheckPlan {
  foregroundTokenId: string;
  backgroundTokenId: string;
  /** Human-readable description of the pattern being tested */
  pattern: string;
  contrastRatio: number;
  passesAaNormal: boolean;
  passesAaLarge: boolean;
  passesAaaNormal: boolean;
  passesAaaLarge: boolean;
}

const FOREGROUND_SUFFIX = ".foreground";

// Semantic colors used as TEXT in alert/badge/tag patterns (not as button
// backgrounds). Each needs to be checked against the page background because
// that is what they actually sit on when used in alerts — not against their
// own tinted swatch. Also checked against the composited alert background
// (12% tint of the color over the page) for accuracy.
const SEMANTIC_TEXT_PATHS = [
  "color.warning",
  "color.success",
  "color.danger",
  "color.info",
];

const EXPLICIT_PAIRS: [fg: string, bg: string][] = [["color.foreground", "color.background"]];

/** Finds every foreground/background pair worth checking:
 *  1. *.foreground → its base token (button/badge foreground on fill)
 *  2. color.foreground → color.background (explicit base pair)
 *  3. semantic colors used as alert text → color.background (alert pattern)
 */
function buildPairs(paths: Set<string>): [fg: string, bg: string, pattern: string][] {
  const pairs: [string, string, string][] = [];

  // Rule 1: *.foreground / *
  for (const path of paths) {
    if (!path.endsWith(FOREGROUND_SUFFIX)) continue;
    const basePath = path.slice(0, -FOREGROUND_SUFFIX.length);
    if (paths.has(basePath)) pairs.push([path, basePath, "component foreground on fill"]);
  }

  // Rule 2: explicit base pair
  for (const [fg, bg] of EXPLICIT_PAIRS) {
    if (paths.has(fg) && paths.has(bg)) pairs.push([fg, bg, "page text on background"]);
  }

  // Rule 3: semantic colors as alert/badge text on page background
  if (paths.has("color.background")) {
    for (const sem of SEMANTIC_TEXT_PATHS) {
      if (paths.has(sem)) {
        pairs.push([sem, "color.background", "alert/badge text on page background"]);
      }
    }
  }

  return pairs;
}

/**
 * Computes WCAG contrast checks for every foreground/background pair
 * present in a single mode's color tokens. Pure function — no DB access.
 *
 * Two categories:
 *  a) *.foreground / * pairs — component fill checks (button, badge, etc.)
 *  b) Semantic-as-text alert pattern: color.warning / color.success /
 *     color.danger checked against the composited alert background
 *     (semantic color at 12% alpha over color.background). This is the
 *     actual surface these colors sit on in alert components — checking
 *     them against raw color.background would under-report failures.
 *
 * `pattern` is transient metadata for display only — not stored in the DB.
 */
export function computeAccessibilityChecks(
  colorTokens: ColorTokenRef[]
): AccessibilityCheckPlan[] {
  const byPath = new Map(colorTokens.map((t) => [t.path, t]));
  const pairs = buildPairs(new Set(byPath.keys()));
  const results: AccessibilityCheckPlan[] = [];

  for (const [fgPath, bgPath, pattern] of pairs) {
    const fg = byPath.get(fgPath)!;
    const bg = byPath.get(bgPath)!;

    // Alert-pattern checks: check against the composited tinted background
    // (12% alpha) rather than the raw background — more accurate to what
    // the user actually sees. A warning-yellow on near-white can fail even
    // though warning-foreground on full-warning passes.
    const effectiveBgHex =
      pattern === "alert/badge text on page background"
        ? compositeOver(fg.hex, bg.hex, 0.12)
        : bg.hex;

    const result = checkContrast(fg.hex, effectiveBgHex);
    results.push({
      foregroundTokenId: fg.id,
      backgroundTokenId: bg.id,
      pattern,
      contrastRatio: result.contrastRatio,
      passesAaNormal: result.passesAaNormal,
      passesAaLarge: result.passesAaLarge,
      passesAaaNormal: result.passesAaaNormal,
      passesAaaLarge: result.passesAaaLarge,
    });
  }

  return results;
}
