import type { ParsedToken, ParseResult } from "@/types/tokens";
import { cssColorToValue, fontFamilyValue, makeToken, numberValue, parseDimensionPx, stringValue } from "./shared";

// Bootstrap variable name -> our canonical path + kind. See
// parser-ref-bootstrap.md §12, §13, §15–17, §19.
type Kind = "color" | "dimension" | "font-family" | "number" | "string";
const VAR_MAP: Record<string, { path: string; kind: Kind }> = {
  primary: { path: "color.primary", kind: "color" },
  secondary: { path: "color.secondary", kind: "color" },
  success: { path: "color.success", kind: "color" },
  info: { path: "color.info", kind: "color" },
  warning: { path: "color.warning", kind: "color" },
  danger: { path: "color.danger", kind: "color" },
  light: { path: "color.light", kind: "color" },
  dark: { path: "color.dark", kind: "color" },
  blue: { path: "color.blue", kind: "color" },
  indigo: { path: "color.indigo", kind: "color" },
  purple: { path: "color.purple", kind: "color" },
  pink: { path: "color.pink", kind: "color" },
  red: { path: "color.red", kind: "color" },
  orange: { path: "color.orange", kind: "color" },
  yellow: { path: "color.yellow", kind: "color" },
  green: { path: "color.green", kind: "color" },
  teal: { path: "color.teal", kind: "color" },
  cyan: { path: "color.cyan", kind: "color" },
  white: { path: "color.white", kind: "color" },
  black: { path: "color.black", kind: "color" },
  "gray-100": { path: "color.gray.100", kind: "color" },
  "gray-200": { path: "color.gray.200", kind: "color" },
  "gray-300": { path: "color.gray.300", kind: "color" },
  "gray-400": { path: "color.gray.400", kind: "color" },
  "gray-500": { path: "color.gray.500", kind: "color" },
  "gray-600": { path: "color.gray.600", kind: "color" },
  "gray-700": { path: "color.gray.700", kind: "color" },
  "gray-800": { path: "color.gray.800", kind: "color" },
  "gray-900": { path: "color.gray.900", kind: "color" },
  "body-bg": { path: "color.background", kind: "color" },
  "body-color": { path: "color.foreground", kind: "color" },
  "border-color": { path: "color.border", kind: "color" },
  "border-radius": { path: "border-radius.base", kind: "dimension" },
  "border-radius-sm": { path: "border-radius.sm", kind: "dimension" },
  "border-radius-lg": { path: "border-radius.lg", kind: "dimension" },
  "border-radius-xl": { path: "border-radius.xl", kind: "dimension" },
  "border-radius-xxl": { path: "border-radius.xxl", kind: "dimension" },
  "border-radius-pill": { path: "border-radius.pill", kind: "dimension" },
  "border-width": { path: "border-width.base", kind: "dimension" },
  "font-sans-serif": { path: "font-family.sans", kind: "font-family" },
  "font-monospace": { path: "font-family.mono", kind: "font-family" },
  "body-font-size": { path: "font-size.base", kind: "dimension" },
  "body-line-height": { path: "line-height.base", kind: "number" },
  "box-shadow": { path: "shadow.base", kind: "string" },
  "box-shadow-sm": { path: "shadow.sm", kind: "string" },
  "box-shadow-lg": { path: "shadow.lg", kind: "string" },
  "breakpoint-sm": { path: "breakpoint.sm", kind: "dimension" },
  "breakpoint-md": { path: "breakpoint.md", kind: "dimension" },
  "breakpoint-lg": { path: "breakpoint.lg", kind: "dimension" },
  "breakpoint-xl": { path: "breakpoint.xl", kind: "dimension" },
  "breakpoint-xxl": { path: "breakpoint.xxl", kind: "dimension" },
};

// Same map, keyed by SCSS variable name (without the `$`) for the subset
// that's commonly customized at the top of a custom.scss.
const SCSS_VAR_MAP: Record<string, { path: string; kind: Kind }> = {
  primary: VAR_MAP.primary,
  secondary: VAR_MAP.secondary,
  success: VAR_MAP.success,
  info: VAR_MAP.info,
  warning: VAR_MAP.warning,
  danger: VAR_MAP.danger,
  light: VAR_MAP.light,
  dark: VAR_MAP.dark,
  "font-size-base": { path: "font-size.base", kind: "dimension" },
  "font-family-sans-serif": { path: "font-family.sans", kind: "font-family" },
  "font-family-monospace": { path: "font-family.mono", kind: "font-family" },
  "line-height-base": { path: "line-height.base", kind: "number" },
  "border-radius": VAR_MAP["border-radius"],
  "border-radius-sm": VAR_MAP["border-radius-sm"],
  "border-radius-lg": VAR_MAP["border-radius-lg"],
  spacer: { path: "spacing.base", kind: "dimension" },
};

function buildToken(
  path: string,
  kind: Kind,
  raw: string,
  warnings: string[]
): ParsedToken | null {
  switch (kind) {
    case "color": {
      const value = cssColorToValue(raw);
      if (!value) {
        warnings.push(`${path}: could not parse color value "${raw}"`);
        return null;
      }
      return makeToken({
        path,
        category: "color",
        type: "color",
        value,
        rawValue: raw,
        format: "bootstrap",
      });
    }
    case "dimension":
      return makeToken({
        path,
        category: path.split(".")[0] as ParsedToken["category"],
        type: "dimension",
        value: parseDimensionPx(raw),
        rawValue: raw,
        format: "bootstrap",
      });
    case "font-family":
      return makeToken({
        path,
        category: "font-family",
        type: "fontFamily",
        value: fontFamilyValue(raw),
        rawValue: raw,
        format: "bootstrap",
      });
    case "number":
      return makeToken({
        path,
        category: "line-height",
        type: "number",
        value: numberValue(raw),
        rawValue: raw,
        format: "bootstrap",
      });
    case "string":
      return makeToken({
        path,
        category: "shadow",
        type: "string",
        value: stringValue(raw),
        rawValue: raw,
        format: "bootstrap",
      });
  }
}

function parseCssVariables(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];
  const re = /--bs-([\w-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(input))) {
    const [, name, rawValue] = match;
    const value = rawValue.trim();
    if (name.endsWith("-rgb")) continue; // derived helper, not user-facing
    if (/-(text-emphasis|bg-subtle|border-subtle)$/.test(name)) continue; // too granular for MVP

    const mapped = VAR_MAP[name];
    if (!mapped) continue; // not every --bs-* var maps to a canonical token

    const token = buildToken(mapped.path, mapped.kind, value, warnings);
    if (token) tokens.push(token);
  }

  if (tokens.length === 0) {
    warnings.push("No recognized --bs-* variables found.");
  }

  return { format: "bootstrap", tokens, warnings };
}

/** Resolves simple `$name: $other-name;` references and literal values
 * across a flat collection of SCSS variable declarations. Function calls
 * (mix(), shift-color(), maps) are intentionally not evaluated. */
function parseScssVariables(input: string): ParseResult {
  const warnings: string[] = [];
  const re = /\$([\w-]+):\s*([^;]+?)(?:\s*!default)?;/g;
  const raw = new Map<string, string>();
  let match: RegExpExecArray | null;

  while ((match = re.exec(input))) {
    raw.set(match[1], match[2].trim());
  }

  const tokens: ParsedToken[] = [];
  for (const [name, mapped] of Object.entries(SCSS_VAR_MAP)) {
    let value = raw.get(name);
    if (!value) continue;

    // Resolve a single level of $variable reference, e.g. `$primary: $blue;`
    const refMatch = /^\$([\w-]+)$/.exec(value);
    if (refMatch) {
      const resolved = raw.get(refMatch[1]);
      if (!resolved) {
        warnings.push(`$${name}: references undefined $${refMatch[1]}, skipped`);
        continue;
      }
      value = resolved;
    } else if (/[a-zA-Z-]+\(/.test(value)) {
      warnings.push(`$${name}: Sass function call ("${value}") not evaluated, skipped`);
      continue;
    }

    const token = buildToken(mapped.path, mapped.kind, value, warnings);
    if (token) tokens.push(token);
  }

  if (tokens.length === 0) {
    warnings.push("No recognized $variables found.");
  }

  return { format: "bootstrap", tokens, warnings };
}

/**
 * Parses Bootstrap v5.3 theme customization — either compiled CSS
 * (`--bs-*` custom properties) or source SCSS (`$variable` overrides).
 * See parser-ref-bootstrap.md §12–19.
 */
export function parseBootstrap(input: string): ParseResult {
  if (input.includes("--bs-")) return parseCssVariables(input);
  return parseScssVariables(input);
}
