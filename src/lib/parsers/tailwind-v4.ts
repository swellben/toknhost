import type { ParsedToken, ParseResult, TokenCategory, TokenType } from "@/types/tokens";
import {
  cssColorToValue,
  fontFamilyValue,
  makeToken,
  numberValue,
  parseCubicBezier,
  parseDimensionPx,
  stringValue,
} from "./shared";

/** Extracts the contents of every balanced `{ ... }` block following a
 * given prefix (e.g. "@theme"), handling nested braces (needed because
 * `@keyframes` blocks can appear inside `@theme`). */
function extractBlocks(input: string, headerRe: RegExp): string[] {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(input))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < input.length && depth > 0) {
      if (input[i] === "{") depth++;
      else if (input[i] === "}") depth--;
      i++;
    }
    blocks.push(input.slice(start, i - 1));
    headerRe.lastIndex = i;
  }
  return blocks;
}

/** Removes nested `@keyframes name { ... }` blocks so line-splitting on
 * `;` doesn't get confused by the braces inside them. */
function removeBalancedKeyframeBlocks(theme: string): string {
  let result = "";
  let i = 0;
  while (i < theme.length) {
    const kfMatch = /@keyframes\s+[\w-]+\s*\{/.exec(theme.slice(i));
    if (!kfMatch || kfMatch.index !== 0) {
      // find next occurrence
      const rest = theme.slice(i);
      const nextMatch = /@keyframes\s+[\w-]+\s*\{/.exec(rest);
      if (!nextMatch) {
        result += rest;
        break;
      }
      result += rest.slice(0, nextMatch.index);
      i += nextMatch.index;
      continue;
    }
    const start = i + kfMatch[0].length;
    let depth = 1;
    let j = start;
    while (j < theme.length && depth > 0) {
      if (theme[j] === "{") depth++;
      else if (theme[j] === "}") depth--;
      j++;
    }
    i = j;
  }
  return result;
}

interface Mapped {
  category: TokenCategory;
  type: TokenType;
  path: string;
}

/** Longest-prefix-first namespace dispatch — order matters, e.g.
 * `--text-shadow-*` must be checked before the generic `--text-*` prefix.
 * See parser-ref-tailwind-v4.md §4 for the full namespace list. */
function mapNamespace(name: string): Mapped | null {
  const rules: [RegExp, (key: string) => Mapped][] = [
    [/^font-weight-(.+)$/, (k) => ({ category: "font-weight", type: "fontWeight", path: `font-weight.${k}` })],
    [/^font-(?!weight-)(.+)$/, (k) => ({ category: "font-family", type: "fontFamily", path: `font-family.${k}` })],
    [
      /^color-(.+)$/,
      (k) => {
        // "brand-500" -> "brand.500" so this reads as a family+shade path
        // (matching the DTCG/Tailwind v3 convention) instead of a flat key
        // — this also lets gap-fill recognize it as an existing scale step.
        const shadeMatch = /^(.+)-(\d+)$/.exec(k);
        const path = shadeMatch ? `color.${shadeMatch[1]}.${shadeMatch[2]}` : `color.${k}`;
        return { category: "color", type: "color", path };
      },
    ],
    [/^breakpoint-(.+)$/, (k) => ({ category: "breakpoint", type: "dimension", path: `breakpoint.${k}` })],
    [/^spacing$/, () => ({ category: "spacing", type: "dimension", path: "spacing.base" })],
    [/^text-shadow-(.+)$/, (k) => ({ category: "text-shadow", type: "string", path: `text-shadow.${k}` })],
    [/^text-(?!shadow-)([\w-]+?)(--line-height)?$/, (k) => ({ category: "font-size", type: "dimension", path: `font-size.${k}` })],
    [/^tracking-(.+)$/, (k) => ({ category: "letter-spacing", type: "dimension", path: `letter-spacing.${k}` })],
    [/^leading-(.+)$/, (k) => ({ category: "line-height", type: "number", path: `line-height.${k}` })],
    [/^radius-(.+)$/, (k) => ({ category: "border-radius", type: "dimension", path: `border-radius.${k}` })],
    [/^inset-shadow-(.+)$/, (k) => ({ category: "shadow", type: "string", path: `inset-shadow.${k}` })],
    [/^drop-shadow-(.+)$/, (k) => ({ category: "drop-shadow", type: "string", path: `drop-shadow.${k}` })],
    [/^shadow-(.+)$/, (k) => ({ category: "shadow", type: "string", path: `shadow.${k}` })],
    [/^ease-(.+)$/, (k) => ({ category: "easing", type: "cubicBezier", path: `easing.${k}` })],
    [/^animate-(.+)$/, (k) => ({ category: "animation", type: "string", path: `animation.${k}` })],
  ];

  for (const [re, build] of rules) {
    const match = re.exec(name);
    if (match) return build(match[1]);
  }
  return null;
}

const SKIP_PREFIXES = ["container-", "blur-", "perspective-", "aspect-", "default-"];

function buildValue(
  type: TokenType,
  raw: string
): { value: ParsedToken["value"]; rawValue: string } | null {
  switch (type) {
    case "color": {
      const value = cssColorToValue(raw);
      return value ? { value, rawValue: raw } : null;
    }
    case "dimension":
      return { value: parseDimensionPx(raw), rawValue: raw };
    case "fontFamily":
      return { value: fontFamilyValue(raw), rawValue: raw };
    case "fontWeight":
      return { value: { value: Number(raw) || 400 }, rawValue: raw };
    case "number":
      return { value: numberValue(raw), rawValue: raw };
    case "cubicBezier": {
      const value = parseCubicBezier(raw);
      return value ? { value, rawValue: raw } : { value: stringValue(raw), rawValue: raw };
    }
    case "string":
      return { value: stringValue(raw), rawValue: raw };
    default:
      return { value: stringValue(raw), rawValue: raw };
  }
}

/**
 * Parses a Tailwind v4 `@theme { ... }` CSS block. See
 * parser-ref-tailwind-v4.md §2–4 for the full namespace reference.
 */
export function parseTailwindV4(input: string): ParseResult {
  const warnings: string[] = [];
  const byPath = new Map<string, ParsedToken>();

  // Matches `@theme`, `@theme inline`, `@theme default`, etc.
  const blocks = extractBlocks(input, /@theme(?:\s+(?:inline|default|reference))*\s*\{/g);

  for (const rawBlock of blocks) {
    const block = removeBalancedKeyframeBlocks(rawBlock);
    const declarations = block.split(";").map((d) => d.trim()).filter(Boolean);

    for (const decl of declarations) {
      const match = /^--([\w-]+):\s*([\s\S]+)$/.exec(decl);
      if (!match) continue;
      const [, name, rawValue] = match;
      const value = rawValue.trim();

      if (value === "initial") continue; // namespace-removal directive
      if (SKIP_PREFIXES.some((p) => name.startsWith(p))) {
        warnings.push(`--${name}: namespace not yet imported, skipped`);
        continue;
      }
      if (name.includes("--")) continue; // sub-property like --text-lg--line-height

      const mapped = mapNamespace(name);
      if (!mapped) {
        warnings.push(`--${name}: unrecognized Tailwind v4 namespace, skipped`);
        continue;
      }

      const built = buildValue(mapped.type, value);
      if (!built) {
        warnings.push(`--${name}: could not parse value "${value}"`);
        continue;
      }

      byPath.set(
        mapped.path,
        makeToken({
          path: mapped.path,
          category: mapped.category,
          type: mapped.type,
          value: built.value,
          rawValue: built.rawValue,
          format: "tailwind-v4",
        })
      );
    }
  }

  if (byPath.size === 0) {
    warnings.push("No @theme block found, or it was empty.");
  }

  return { format: "tailwind-v4", tokens: [...byPath.values()], warnings };
}
