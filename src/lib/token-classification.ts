// Single source of truth for "which tab does this token belong on" — used
// by the design system page's tab split AND the top-nav token search, so
// search results land on the tab that actually shows them. Don't
// duplicate this logic; both consumers import from here.

// Categories that are inherently scale/foundation values rather than
// named UI roles — these live on the "Primitives" tab. Color is special:
// a color token is a primitive only if its path ends in a numeric scale
// step (color.primary.500); a semantic name (color.primary, color.success)
// goes to "Tokens" instead. Typography categories are carved out first —
// they get their own tab regardless of this primitive/semantic split.
export const TYPOGRAPHY_CATEGORIES = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "paragraph-spacing",
  "text-decoration",
  "text-transform",
]);

export const PRIMITIVE_SCALE_CATEGORIES = new Set([
  "spacing",
  "border-radius",
  "breakpoint",
  "opacity",
  "z-index",
  "duration",
  "easing",
  "animation",
  "shadow",
  "drop-shadow",
  "text-shadow",
  "sizing",
  "border-width",
  "border-style",
  "border",
  "transition",
]);

export type TokenTab = "typography" | "primitives" | "colors" | "tokens";

export function classifyToken(category: string, path: string): TokenTab {
  if (TYPOGRAPHY_CATEGORIES.has(category)) return "typography";
  // All color tokens (both scale steps and semantic names) go to the Colors tab.
  if (category === "color") return "colors";
  return PRIMITIVE_SCALE_CATEGORIES.has(category) ? "primitives" : "tokens";
}
