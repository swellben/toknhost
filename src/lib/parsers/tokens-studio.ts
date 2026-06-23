import type { ParsedToken, ParseResult, TokenCategory, TokenType } from "@/types/tokens";
import {
  ALIAS_RE,
  cssColorToValue,
  fontFamilyValue,
  makeToken,
  numberValue,
  parseDimensionPx,
  stringValue,
} from "./shared";

// Tokens Studio (legacy `value`/`type` mode) -> our canonical (category, type).
// See parser-ref-tokens-studio.md §2.4 and §2.11. Pluralized names
// (fontFamilies, fontWeights, ...) are TS's on-disk convention; singular
// forms also occur in some exports, so both are mapped.
const TS_TYPE_MAP: Record<string, { category: TokenCategory; type: TokenType }> = {
  color: { category: "color", type: "color" },
  dimension: { category: "spacing", type: "dimension" },
  spacing: { category: "spacing", type: "dimension" },
  sizing: { category: "sizing", type: "dimension" },
  borderRadius: { category: "border-radius", type: "dimension" },
  borderWidth: { category: "border-width", type: "dimension" },
  letterSpacing: { category: "letter-spacing", type: "dimension" },
  paragraphSpacing: { category: "paragraph-spacing", type: "dimension" },
  fontFamilies: { category: "font-family", type: "fontFamily" },
  fontFamily: { category: "font-family", type: "fontFamily" },
  fontWeights: { category: "font-weight", type: "fontWeight" },
  fontWeight: { category: "font-weight", type: "fontWeight" },
  fontSizes: { category: "font-size", type: "dimension" },
  fontSize: { category: "font-size", type: "dimension" },
  lineHeights: { category: "line-height", type: "number" },
  lineHeight: { category: "line-height", type: "number" },
  number: { category: "opacity", type: "number" },
  opacity: { category: "opacity", type: "number" },
  boolean: { category: "component", type: "boolean" },
  text: { category: "component", type: "string" },
  asset: { category: "component", type: "string" },
  border: { category: "border", type: "border" },
  boxShadow: { category: "shadow", type: "shadow" },
  typography: { category: "component", type: "typography" },
};

const ROOT_SKIP_KEYS = new Set(["$themes", "$metadata"]);

interface RawNode {
  [key: string]: unknown;
}

function isToken(node: unknown): node is RawNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "value" in (node as RawNode) &&
    "type" in (node as RawNode)
  );
}

function isGroup(node: unknown): node is RawNode {
  return typeof node === "object" && node !== null && !Array.isArray(node);
}

function buildValue(
  type: TokenType,
  raw: unknown,
  warnings: string[],
  path: string
): { value: ParsedToken["value"]; rawValue: string } {
  switch (type) {
    case "color": {
      const value = cssColorToValue(String(raw));
      if (!value) {
        warnings.push(`${path}: unrecognized color value "${raw}"`);
        return { value: stringValue(String(raw)), rawValue: String(raw) };
      }
      return { value, rawValue: String(raw) };
    }
    case "dimension":
      return { value: parseDimensionPx(String(raw)), rawValue: String(raw) };
    case "fontFamily":
      return { value: fontFamilyValue(String(raw)), rawValue: String(raw) };
    case "fontWeight": {
      // TS stores weight as either a number or a string keyword (e.g.
      // "Regular", "Bold") — see parser-ref-tokens-studio.md §2.5.
      const KEYWORD_WEIGHTS: Record<string, number> = {
        thin: 100,
        extralight: 200,
        light: 300,
        regular: 400,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900,
      };
      const asNumber = Number(raw);
      const value = !isNaN(asNumber)
        ? asNumber
        : KEYWORD_WEIGHTS[String(raw).toLowerCase()] ?? 400;
      return { value: { value }, rawValue: String(raw) };
    }
    case "number":
      // TS stores numbers as strings — see §2.5.
      return { value: numberValue(String(raw)), rawValue: String(raw) };
    case "boolean":
      return { value: { value: String(raw) === "true" }, rawValue: String(raw) };
    case "string":
      return { value: stringValue(String(raw)), rawValue: String(raw) };
    case "border": {
      const b = raw as Record<string, unknown>;
      const colorValue = cssColorToValue(String(b.color ?? "")) ?? stringValue(String(b.color ?? ""));
      return {
        value: {
          color: (colorValue as { hex?: string }).hex ?? String(b.color ?? ""),
          width: parseDimensionPx(String(b.width ?? "1")),
          style: String(b.style ?? "solid"),
        },
        rawValue: JSON.stringify(raw),
      };
    }
    case "shadow": {
      // TS calls this boxShadow: x/y instead of offsetX/offsetY, and
      // type: "dropShadow" | "innerShadow" instead of inset: boolean.
      // See parser-ref-tokens-studio.md §2.5.
      const layers = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
      return {
        value: {
          layers: layers.map((l) => ({
            offsetX: parseDimensionPx(String(l.x ?? "0")).value,
            offsetY: parseDimensionPx(String(l.y ?? "0")).value,
            blur: parseDimensionPx(String(l.blur ?? "0")).value,
            spread: parseDimensionPx(String(l.spread ?? "0")).value,
            color: String(l.color ?? "#000000"),
            inset: l.type === "innerShadow",
          })),
        },
        rawValue: JSON.stringify(raw),
      };
    }
    default:
      // typography composite — TS adds extra fields beyond DTCG's spec;
      // pass through loosely (see parser-ref-tokens-studio.md §2.5).
      return { value: raw as Record<string, unknown>, rawValue: JSON.stringify(raw) };
  }
}

/**
 * Parses a Tokens Studio for Figma export in legacy (`value`/`type`) mode.
 * DTCG-mode TS exports (using `$value`/`$type`) are handled by parseDtcg —
 * see detect.ts. Multiple token sets are flattened into one set of paths;
 * per parser-ref-tokens-studio.md §2.9, later sets win on path collisions
 * (matching `$metadata.tokenSetOrder`'s "rightmost wins" rule).
 */
export function parseTokensStudio(input: string): ParseResult {
  const warnings: string[] = [];
  const root = JSON.parse(input) as RawNode;
  const byPath = new Map<string, ParsedToken>();

  const setNames = Object.keys(root).filter((k) => !ROOT_SKIP_KEYS.has(k));
  const order = (root.$metadata as { tokenSetOrder?: string[] } | undefined)?.tokenSetOrder;
  const orderedSets = order?.length ? order.filter((s) => setNames.includes(s)) : setNames;

  function walk(node: RawNode, pathParts: string[]) {
    for (const [key, child] of Object.entries(node)) {
      const childPath = [...pathParts, key];
      const fullPath = childPath.join(".");

      if (isToken(child)) {
        const tsType = String(child.type);
        const mapped = TS_TYPE_MAP[tsType];
        if (!mapped) {
          warnings.push(`${fullPath}: unsupported type "${tsType}", skipping`);
          continue;
        }

        const rawValue = child.value;
        const aliasMatch = typeof rawValue === "string" ? ALIAS_RE.exec(rawValue) : null;
        // Partial interpolation (rgba({ref}, 0.5)) and math expressions
        // are TS extensions DTCG doesn't support — see §2.6. We don't
        // evaluate them; store as a raw string and flag for the user.
        const looksLikePartialRef =
          typeof rawValue === "string" && !aliasMatch && rawValue.includes("{");

        if (aliasMatch) {
          byPath.set(
            fullPath,
            makeToken({
              path: fullPath,
              category: mapped.category,
              type: mapped.type,
              aliasPath: aliasMatch[1],
              value: null,
              rawValue: rawValue as string,
              format: "tokens-studio",
            })
          );
          continue;
        }

        if (looksLikePartialRef) {
          warnings.push(
            `${fullPath}: contains an unresolved reference/math expression ("${rawValue}") — imported as a literal string`
          );
        }

        const { value, rawValue: rv } = buildValue(mapped.type, rawValue, warnings, fullPath);
        byPath.set(
          fullPath,
          makeToken({
            path: fullPath,
            category: mapped.category,
            type: mapped.type,
            description: child.description as string | undefined,
            value,
            rawValue: rv,
            format: "tokens-studio",
          })
        );
      } else if (isGroup(child)) {
        walk(child, childPath);
      }
    }
  }

  for (const setName of orderedSets) {
    const set = root[setName];
    if (isGroup(set)) walk(set as RawNode, []);
  }

  return { format: "tokens-studio", tokens: [...byPath.values()], warnings };
}
