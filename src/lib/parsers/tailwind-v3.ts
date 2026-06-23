import type { ParsedToken, ParseResult } from "@/types/tokens";
import { extractBalancedObject, looseObjectLiteralToJson } from "./js-object-literal";
import { cssColorToValue, fontFamilyValue, makeToken, parseCubicBezier, parseDimensionPx, stringValue } from "./shared";

interface ThemeShape {
  colors?: Record<string, unknown>;
  spacing?: Record<string, string>;
  fontFamily?: Record<string, string | string[]>;
  fontSize?: Record<string, unknown>;
  fontWeight?: Record<string, string | number>;
  letterSpacing?: Record<string, string>;
  lineHeight?: Record<string, string>;
  borderRadius?: Record<string, string>;
  boxShadow?: Record<string, string>;
  dropShadow?: Record<string, string>;
  opacity?: Record<string, string>;
  zIndex?: Record<string, string | number>;
  screens?: Record<string, string>;
  transitionTimingFunction?: Record<string, string>;
}

/** `DEFAULT` is Tailwind's convention for the suffix-less utility class
 * (e.g. `rounded`, not `rounded-DEFAULT`) — see parser-ref-tailwind-v3.md
 * §3, gotcha #1. We map it to `<category>.base` for a clean path. */
function keyToSegment(key: string): string {
  return key === "DEFAULT" ? "base" : key;
}

function flattenColors(colors: Record<string, unknown>, prefix: string[] = []): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      out.push([[...prefix, keyToSegment(key)].join("."), value]);
    } else if (value && typeof value === "object") {
      out.push(...flattenColors(value as Record<string, unknown>, [...prefix, key]));
    }
    // Skip callback-form values (functions) — not present after JSON parse.
  }
  return out;
}

/** fontSize values can be a plain string, `[size, lineHeight]`, or
 * `[size, { lineHeight, letterSpacing }]` — see parser-ref-tailwind-v3.md
 * §4, gotcha #4. We only take the size; the paired line-height/letter
 * spacing would need their own tokens, which we skip for MVP. */
function fontSizeOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/**
 * Parses a Tailwind v3 `tailwind.config.js` `theme` (and `theme.extend`)
 * object. See parser-ref-tailwind-v3.md §2–4 for the full key reference.
 * Callback-form values (`({ theme }) => ({...})`) aren't evaluated and are
 * dropped with a warning, since running arbitrary JS is out of scope.
 */
export function parseTailwindV3(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];

  const objText = extractBalancedObject(input, /theme\s*:/);
  if (!objText) {
    return { format: "tailwind-v3", tokens: [], warnings: ["No theme: { ... } block found."] };
  }

  // Strip callback-form values like `backgroundSize: ({ theme }) => ({...})`
  // before JSON normalization, since `=>` isn't valid JSON and can't be
  // evaluated without running the file as real JS.
  const stripped = objText.replace(/"?[\w$]+"?\s*:\s*\([^()]*\)\s*=>\s*\([\s\S]*?\)\s*,?/g, (m) => {
    warnings.push("Skipped a callback-form theme value (\"({ theme }) => ({...})\") — not evaluated.");
    return "";
  });

  const parsed = looseObjectLiteralToJson(stripped) as { extend?: ThemeShape } & ThemeShape | null;
  if (!parsed) {
    return {
      format: "tailwind-v3",
      tokens: [],
      warnings: ["Could not parse the theme object — it may use unsupported JS (requires, spreads, computed keys)."],
    };
  }

  // `extend` merges additively; since we have no "defaults" to merge
  // against in this pipeline, we just treat its entries the same as
  // top-level ones, with extend taking precedence on path collisions.
  const merged: ThemeShape = { ...parsed, ...parsed.extend };

  if (merged.colors) {
    for (const [path, raw] of flattenColors(merged.colors, ["color"])) {
      const value = cssColorToValue(raw);
      if (!value) {
        warnings.push(`${path}: could not parse color value "${raw}"`);
        continue;
      }
      tokens.push(makeToken({ path, category: "color", type: "color", value, rawValue: raw, format: "tailwind-v3" }));
    }
  }

  for (const [key, raw] of Object.entries(merged.spacing ?? {})) {
    tokens.push(
      makeToken({
        path: `spacing.${keyToSegment(key)}`,
        category: "spacing",
        type: "dimension",
        value: parseDimensionPx(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.fontFamily ?? {})) {
    tokens.push(
      makeToken({
        path: `font-family.${keyToSegment(key)}`,
        category: "font-family",
        type: "fontFamily",
        value: fontFamilyValue(raw),
        rawValue: Array.isArray(raw) ? raw.join(", ") : raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.fontSize ?? {})) {
    const size = fontSizeOf(raw);
    if (!size) {
      warnings.push(`font-size.${key}: unrecognized fontSize shape, skipped`);
      continue;
    }
    tokens.push(
      makeToken({
        path: `font-size.${keyToSegment(key)}`,
        category: "font-size",
        type: "dimension",
        value: parseDimensionPx(size),
        rawValue: size,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.fontWeight ?? {})) {
    tokens.push(
      makeToken({
        path: `font-weight.${keyToSegment(key)}`,
        category: "font-weight",
        type: "fontWeight",
        value: { value: Number(raw) || 400 },
        rawValue: String(raw),
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.letterSpacing ?? {})) {
    tokens.push(
      makeToken({
        path: `letter-spacing.${keyToSegment(key)}`,
        category: "letter-spacing",
        type: "dimension",
        value: parseDimensionPx(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.lineHeight ?? {})) {
    const isBareNumber = /^[\d.]+$/.test(raw.trim());
    tokens.push(
      makeToken({
        path: `line-height.${keyToSegment(key)}`,
        category: "line-height",
        type: isBareNumber ? "number" : "dimension",
        value: isBareNumber ? { value: parseFloat(raw) } : parseDimensionPx(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.borderRadius ?? {})) {
    tokens.push(
      makeToken({
        path: `border-radius.${keyToSegment(key)}`,
        category: "border-radius",
        type: "dimension",
        value: parseDimensionPx(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.boxShadow ?? {})) {
    tokens.push(
      makeToken({
        path: `shadow.${keyToSegment(key)}`,
        category: "shadow",
        type: "string",
        value: stringValue(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.dropShadow ?? {})) {
    tokens.push(
      makeToken({
        path: `drop-shadow.${keyToSegment(key)}`,
        category: "drop-shadow",
        type: "string",
        value: stringValue(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.opacity ?? {})) {
    tokens.push(
      makeToken({
        path: `opacity.${keyToSegment(key)}`,
        category: "opacity",
        type: "number",
        value: { value: parseFloat(raw) },
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.zIndex ?? {})) {
    const num = Number(raw);
    if (isNaN(num)) continue; // skip "auto"
    tokens.push(
      makeToken({
        path: `z-index.${keyToSegment(key)}`,
        category: "z-index",
        type: "number",
        value: { value: num },
        rawValue: String(raw),
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.screens ?? {})) {
    if (typeof raw !== "string") continue; // skip object-form (min/max range) screens
    tokens.push(
      makeToken({
        path: `breakpoint.${keyToSegment(key)}`,
        category: "breakpoint",
        type: "dimension",
        value: parseDimensionPx(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  for (const [key, raw] of Object.entries(merged.transitionTimingFunction ?? {})) {
    const bezier = parseCubicBezier(raw);
    tokens.push(
      makeToken({
        path: `easing.${keyToSegment(key)}`,
        category: "easing",
        type: bezier ? "cubicBezier" : "string",
        value: bezier ?? stringValue(raw),
        rawValue: raw,
        format: "tailwind-v3",
      })
    );
  }

  if (tokens.length === 0) {
    warnings.push("theme: { ... } was found but contained no recognized keys.");
  }

  return { format: "tailwind-v3", tokens, warnings };
}
