import type { ParsedToken, ParseResult } from "@/types/tokens";
import { cssColorToValue, makeToken, parseDimensionPx } from "./shared";

// Shadcn CSS variable name -> our canonical color path. See
// parser-ref-shadcn.md §2 and §6. `destructive` maps to our `danger`
// semantic slot (no rename collision risk since we don't have a
// "destructive" category of our own).
export const COLOR_NAME_MAP: Record<string, string> = {
  background: "color.background",
  foreground: "color.foreground",
  card: "color.card",
  "card-foreground": "color.card.foreground",
  popover: "color.popover",
  "popover-foreground": "color.popover.foreground",
  primary: "color.primary",
  "primary-foreground": "color.primary.foreground",
  secondary: "color.secondary",
  "secondary-foreground": "color.secondary.foreground",
  muted: "color.muted",
  "muted-foreground": "color.muted.foreground",
  accent: "color.accent",
  "accent-foreground": "color.accent.foreground",
  destructive: "color.danger",
  "destructive-foreground": "color.danger.foreground", // legacy v3/HSL era only
  border: "color.border",
  input: "color.input",
  ring: "color.ring",
  "chart-1": "color.chart.1",
  "chart-2": "color.chart.2",
  "chart-3": "color.chart.3",
  "chart-4": "color.chart.4",
  "chart-5": "color.chart.5",
  sidebar: "color.sidebar",
  "sidebar-foreground": "color.sidebar.foreground",
  "sidebar-primary": "color.sidebar.primary",
  "sidebar-primary-foreground": "color.sidebar.primary.foreground",
  "sidebar-accent": "color.sidebar.accent",
  "sidebar-accent-foreground": "color.sidebar.accent.foreground",
  "sidebar-border": "color.sidebar.border",
  "sidebar-ring": "color.sidebar.ring",
};

function extractRootBlock(input: string, selector: RegExp): string | null {
  const match = selector.exec(input);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < input.length && depth > 0) {
    if (input[i] === "{") depth++;
    else if (input[i] === "}") depth--;
    i++;
  }
  return input.slice(start, i - 1);
}

/** Resolves a Shadcn color value to a CSS-parseable string. Handles both
 * eras: current OKLCH (`oklch(0.205 0 0)`) and legacy bare HSL triplets
 * (`221.2 83.2% 53.3%`, which need an `hsl()` wrapper to parse). See
 * parser-ref-shadcn.md §3. */
function toParseableColor(raw: string): string {
  const trimmed = raw.trim();
  if (/^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%/.test(trimmed)) {
    return `hsl(${trimmed})`;
  }
  return trimmed;
}

/**
 * Parses a Shadcn/UI `globals.css` (or just the `:root { ... }` block).
 * Only `:root` (light mode) is imported — `.dark` values are intentionally
 * skipped, since gap-fill regenerates dark mode algorithmically from the
 * light-mode tokens (see src/lib/gap-fill). See parser-ref-shadcn.md §4–5.
 */
export function parseShadcn(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];

  const rootBlock = extractRootBlock(input, /:root\s*\{/);
  if (!rootBlock) {
    return {
      format: "shadcn",
      tokens: [],
      warnings: ["No :root { ... } block found."],
    };
  }

  if (/\.dark\s*\{/.test(input)) {
    warnings.push(
      "A .dark block was found but was not imported — run gap-fill afterwards to generate dark mode automatically."
    );
  }

  const declarations = rootBlock.split(";").map((d) => d.trim()).filter(Boolean);

  for (const decl of declarations) {
    const match = /^--([\w-]+):\s*([\s\S]+)$/.exec(decl);
    if (!match) continue;
    const [, name, rawValue] = match;
    const value = rawValue.trim();

    if (name === "radius") {
      tokens.push(
        makeToken({
          path: "border-radius.base",
          category: "border-radius",
          type: "dimension",
          value: parseDimensionPx(value),
          rawValue: value,
          format: "shadcn",
        })
      );
      continue;
    }

    // Derived multiplier vars (radius-sm, radius-lg, ...) aren't raw input.
    if (/^radius-/.test(name)) continue;

    const path = COLOR_NAME_MAP[name];
    if (!path) {
      warnings.push(`--${name}: not a recognized Shadcn variable, skipped`);
      continue;
    }

    const colorValue = cssColorToValue(toParseableColor(value));
    if (!colorValue) {
      warnings.push(`--${name}: could not parse color value "${value}"`);
      continue;
    }

    tokens.push(
      makeToken({
        path,
        category: "color",
        type: "color",
        value: colorValue,
        rawValue: value,
        format: "shadcn",
      })
    );
  }

  return { format: "shadcn", tokens, warnings };
}
