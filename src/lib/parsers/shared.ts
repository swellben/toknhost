import { formatHex, parse as parseCssColor } from "culori";
import type { ParsedToken, TokenValueShape } from "@/types/tokens";

export const ALIAS_RE = /^\{([^{}]+)\}$/;

/**
 * Converts any CSS Color 4 string culori understands — hex, rgb(), hsl(),
 * oklch(), bare "h s% l%" wrapped in hsl(), etc. — into our canonical
 * `{ hex, oklch, space }` color value shape. Centralizing this here means
 * every parser (Tailwind v4's oklch(), Shadcn's bare HSL triplet, Bootstrap's
 * hex, Figma's r/g/b floats) converges on the same internal representation,
 * per CLAUDE.md rule 7: "Colors are stored as OKLCH internally."
 */
export function cssColorToValue(raw: string): TokenValueShape | null {
  const parsed = parseCssColor(raw);
  if (!parsed) return null;
  const hex = formatHex(parsed);
  return { hex, oklch: `oklch(from ${hex} l c h)`, space: "oklch" };
}

export function rgbaFloatToValue(r: number, g: number, b: number): TokenValueShape {
  const toHex = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return { hex, oklch: `oklch(from ${hex} l c h)`, space: "oklch" };
}

/** Parses "16px" / "1rem" / unitless "16" (treated as px) into { value, unit }.
 * Normalizes rem to px at a 16px base, per CLAUDE.md rule 8. */
export function parseDimensionPx(raw: string | number): { value: number; unit: "px" } {
  if (typeof raw === "number") return { value: raw, unit: "px" };
  const match = /^(-?[\d.]+)\s*(px|rem)?$/.exec(raw.trim());
  if (!match) return { value: 0, unit: "px" };
  const value = parseFloat(match[1]);
  const unit = match[2];
  return unit === "rem" ? { value: value * 16, unit: "px" } : { value, unit: "px" };
}

/** Same as parseDimensionPx but for em units (used by Mantine breakpoints). */
export function emToPx(raw: string): number {
  const match = /^(-?[\d.]+)em$/.exec(raw.trim());
  return match ? parseFloat(match[1]) * 16 : 0;
}

export function parseDurationMs(raw: string | number): { value: number; unit: "ms" } {
  if (typeof raw === "number") return { value: raw, unit: "ms" };
  const match = /^(-?[\d.]+)\s*ms$/.exec(raw.trim());
  return { value: match ? parseFloat(match[1]) : 0, unit: "ms" };
}

/** Parses a CSS `cubic-bezier(a, b, c, d)` string into our cubicBezier shape. */
export function parseCubicBezier(raw: string): TokenValueShape | null {
  const match = /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/.exec(
    raw
  );
  if (!match) return null;
  const [, p1x, p1y, p2x, p2y] = match.map(Number) as unknown as [
    number,
    number,
    number,
    number,
    number,
  ];
  return { p1x, p1y, p2x, p2y };
}

export function stringValue(raw: string): TokenValueShape {
  return { value: raw };
}

export function numberValue(raw: string | number): TokenValueShape {
  return { value: typeof raw === "number" ? raw : Number(raw) || 0 };
}

export function fontFamilyValue(raw: string | string[]): TokenValueShape {
  const stack = Array.isArray(raw)
    ? raw.map((s) => s.trim())
    : raw.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  return { stack, primary: stack[0] };
}

/** Small helper for building a ParsedToken without repeating the boilerplate
 * across every format-specific parser. */
export function makeToken(
  partial: Omit<ParsedToken, "isAlias" | "aliasPath" | "provenanceMeta"> & {
    aliasPath?: string;
    format: string;
  }
): ParsedToken {
  const { format, ...rest } = partial;
  return {
    ...rest,
    isAlias: Boolean(partial.aliasPath),
    provenanceMeta: { format },
  };
}
