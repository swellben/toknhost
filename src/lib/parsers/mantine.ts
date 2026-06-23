import type { ParsedToken, ParseResult } from "@/types/tokens";
import { extractBalancedObject, looseObjectLiteralToJson } from "./js-object-literal";
import { cssColorToValue, emToPx, fontFamilyValue, makeToken, parseDimensionPx, stringValue } from "./shared";

interface MantineThemeShape {
  colors?: Record<string, string[]>;
  white?: string;
  black?: string;
  fontFamily?: string;
  fontFamilyMonospace?: string;
  fontSizes?: Record<string, string | number>;
  lineHeights?: Record<string, string | number>;
  fontWeights?: Record<string, string | number>;
  spacing?: Record<string, string | number>;
  radius?: Record<string, string | number>;
  breakpoints?: Record<string, string>;
  shadows?: Record<string, string>;
}

/** Numbers in Mantine's fontSizes/spacing/radius are treated as px and
 * converted to rem internally — see parser-ref-mantine.md §3.2, §4, §5.
 * For our purposes (px-normalized storage) that just means: numbers are
 * already px, strings need the usual rem/px parse. */
function dimensionOf(raw: string | number) {
  return typeof raw === "number" ? { value: raw, unit: "px" as const } : parseDimensionPx(raw);
}

/**
 * Parses a Mantine `createTheme({ ... })` call. See
 * parser-ref-mantine.md §1–9. Component overrides, `other`, gradients,
 * and `virtualColor`/`colorsTuple` helper calls are not evaluated — they
 * require running real JS — and are skipped with a warning.
 */
export function parseMantine(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];

  const objText = extractBalancedObject(input, /createTheme\s*\(/);
  if (!objText) {
    return { format: "mantine", tokens: [], warnings: ["No createTheme({ ... }) call found."] };
  }

  // Helper-function values (virtualColor(...), colorsTuple(...)) can't be
  // evaluated by the lenient JSON normalizer; strip those key/value pairs
  // before parsing, with a warning, rather than letting the whole parse fail.
  const stripped = objText.replace(
    /"?[\w$]+"?\s*:\s*(virtualColor|colorsTuple)\s*\([^()]*\)\s*,?/g,
    (m) => {
      warnings.push(`Skipped a theme.colors entry using ${m.includes("virtualColor") ? "virtualColor()" : "colorsTuple()"} — not evaluated.`);
      return "";
    }
  );

  const parsed = looseObjectLiteralToJson(stripped) as MantineThemeShape | null;
  if (!parsed) {
    return {
      format: "mantine",
      tokens: [],
      warnings: ["Could not parse the Mantine theme object — it may use unsupported JS (functions, spreads, computed keys)."],
    };
  }

  for (const [name, shades] of Object.entries(parsed.colors ?? {})) {
    if (!Array.isArray(shades)) continue;
    shades.forEach((hex, index) => {
      const value = cssColorToValue(String(hex));
      if (!value) {
        warnings.push(`color.${name}.${index}: could not parse "${hex}"`);
        return;
      }
      tokens.push(
        makeToken({
          path: `color.${name}.${index}`,
          category: "color",
          type: "color",
          value,
          rawValue: String(hex),
          format: "mantine",
        })
      );
    });
    // Mantine's "primary shade" (light: 6, dark: 8 by default) is the
    // closest analog to a semantic base color — alias it for convenience.
    if (shades[6]) {
      tokens.push(
        makeToken({
          path: `color.${name}`,
          category: "color",
          type: "color",
          aliasPath: `color.${name}.6`,
          value: null,
          rawValue: `{color.${name}.6}`,
          format: "mantine",
        })
      );
    }
  }

  if (parsed.white) {
    const value = cssColorToValue(parsed.white);
    if (value) tokens.push(makeToken({ path: "color.white", category: "color", type: "color", value, rawValue: parsed.white, format: "mantine" }));
  }
  if (parsed.black) {
    const value = cssColorToValue(parsed.black);
    if (value) tokens.push(makeToken({ path: "color.black", category: "color", type: "color", value, rawValue: parsed.black, format: "mantine" }));
  }

  if (parsed.fontFamily) {
    tokens.push(
      makeToken({
        path: "font-family.base",
        category: "font-family",
        type: "fontFamily",
        value: fontFamilyValue(parsed.fontFamily),
        rawValue: parsed.fontFamily,
        format: "mantine",
      })
    );
  }
  if (parsed.fontFamilyMonospace) {
    tokens.push(
      makeToken({
        path: "font-family.mono",
        category: "font-family",
        type: "fontFamily",
        value: fontFamilyValue(parsed.fontFamilyMonospace),
        rawValue: parsed.fontFamilyMonospace,
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.fontSizes ?? {})) {
    tokens.push(
      makeToken({
        path: `font-size.${key}`,
        category: "font-size",
        type: "dimension",
        value: dimensionOf(raw),
        rawValue: String(raw),
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.spacing ?? {})) {
    tokens.push(
      makeToken({
        path: `spacing.${key}`,
        category: "spacing",
        type: "dimension",
        value: dimensionOf(raw),
        rawValue: String(raw),
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.radius ?? {})) {
    tokens.push(
      makeToken({
        path: `border-radius.${key}`,
        category: "border-radius",
        type: "dimension",
        value: dimensionOf(raw),
        rawValue: String(raw),
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.fontWeights ?? {})) {
    tokens.push(
      makeToken({
        path: `font-weight.${key}`,
        category: "font-weight",
        type: "fontWeight",
        value: { value: Number(raw) || 400 },
        rawValue: String(raw),
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.lineHeights ?? {})) {
    tokens.push(
      makeToken({
        path: `line-height.${key}`,
        category: "line-height",
        type: "number",
        value: { value: Number(raw) || 1.5 },
        rawValue: String(raw),
        format: "mantine",
      })
    );
  }

  // Breakpoints are in em (not auto-converted by Mantine, unlike spacing
  // and radius) — see parser-ref-mantine.md §6.
  for (const [key, raw] of Object.entries(parsed.breakpoints ?? {})) {
    tokens.push(
      makeToken({
        path: `breakpoint.${key}`,
        category: "breakpoint",
        type: "dimension",
        value: { value: emToPx(raw), unit: "px" },
        rawValue: raw,
        format: "mantine",
      })
    );
  }

  for (const [key, raw] of Object.entries(parsed.shadows ?? {})) {
    tokens.push(
      makeToken({
        path: `shadow.${key}`,
        category: "shadow",
        type: "string",
        value: stringValue(raw),
        rawValue: raw,
        format: "mantine",
      })
    );
  }

  if (tokens.length === 0) {
    warnings.push("createTheme({ ... }) was found but contained no recognized theme keys.");
  }

  return { format: "mantine", tokens, warnings };
}
