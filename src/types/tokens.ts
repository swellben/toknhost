// Canonical token shapes — mirrors the `tokens` / `token_values` schema in
// supabase/migrations/001_initial_schema.sql. See schema-design.md for the
// full JSONB value-format rationale. This is OUR schema, not DTCG — DTCG is
// just one ingestion source among nine.

export type TokenCategory =
  | "color"
  | "font-size"
  | "font-family"
  | "font-weight"
  | "line-height"
  | "letter-spacing"
  | "paragraph-spacing"
  | "text-decoration"
  | "text-transform"
  | "spacing"
  | "border-radius"
  | "shadow"
  | "drop-shadow"
  | "text-shadow"
  | "border-width"
  | "border-style"
  | "border"
  | "opacity"
  | "z-index"
  | "duration"
  | "easing"
  | "transition"
  | "animation"
  | "breakpoint"
  | "sizing"
  | "component";

export type TokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "number"
  | "duration"
  | "cubicBezier"
  | "shadow"
  | "border"
  | "transition"
  | "typography"
  | "gradient"
  | "string"
  | "boolean";

export type Provenance = "imported" | "derived" | "defaulted";

/** A single shadow layer — see schema-design.md "type: shadow". */
export interface ShadowLayer {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

/** The JSONB shapes that can live in `token_values.value`, keyed by TokenType. */
export type TokenValueShape =
  | { hex: string; oklch: string; space: "oklch" } // color
  | { value: number; unit: "px" | "rem" | "ms" } // dimension / duration
  | { stack: string[]; primary: string } // fontFamily
  | { value: number } // fontWeight / number
  | { p1x: number; p1y: number; p2x: number; p2y: number } // cubicBezier
  | { layers: ShadowLayer[] } // shadow
  | { color: string; width: { value: number; unit: string }; style: string } // border
  | {
      duration: { value: number; unit: string };
      delay: { value: number; unit: string };
      timingFunction: { p1x: number; p1y: number; p2x: number; p2y: number };
    } // transition
  | Record<string, unknown> // typography / gradient (composite, looser shape for now)
  | { value: string } // string
  | { value: boolean }; // boolean

/** One token + its value, as produced by a parser before it's written to the DB. */
export interface ParsedToken {
  path: string; // dot-notation, e.g. "color.brand.primary"
  category: TokenCategory;
  type: TokenType;
  description?: string;
  isAlias: boolean;
  aliasPath?: string; // dot-path of referenced token, when isAlias
  value: TokenValueShape | null; // null when isAlias (resolved at application layer)
  rawValue?: string; // original as-imported string, for round-trip fidelity
  provenanceMeta?: Record<string, unknown>;
}

export type SupportedFormat =
  | "dtcg"
  | "tokens-studio"
  | "tailwind-v4"
  | "tailwind-v3"
  | "shadcn"
  | "bootstrap"
  | "mantine"
  | "figma-variables"
  | "design-md"
  | "unknown";

export interface ParseResult {
  format: SupportedFormat;
  tokens: ParsedToken[];
  warnings: string[];
}
