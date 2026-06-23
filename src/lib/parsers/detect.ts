import type { SupportedFormat } from "@/types/tokens";

/**
 * Programmatic signature matching — see CLAUDE.md "Format Detection".
 * First match wins. DESIGN.md is intentionally excluded: per CLAUDE.md
 * decision #6, it's an export-only format and is never ingested as a
 * source, even though the original format-detection sketch in CLAUDE.md
 * lists it (that sketch is explicitly "rough" — decision #6 overrides it).
 */
export function detectFormat(input: string): SupportedFormat {
  const trimmed = input.trim();

  // Try JSON-shaped formats first.
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    json = undefined;
  }

  if (json && typeof json === "object") {
    const text = trimmed;
    // Check before the generic "value"/"type" signature below — Figma's
    // Variable objects have neither a top-level "value" nor "$value" key.
    if (text.includes('"variableCollections"')) {
      return "figma-variables";
    }
    if (text.includes('"$value"')) {
      // DTCG mode if any token uses $value; legacy Tokens Studio also uses
      // "value"/"type" (no $) — distinguish on the $-prefixed keys.
      return "dtcg";
    }
    if (text.includes('"value"') && text.includes('"type"')) {
      return "tokens-studio";
    }
  }

  // Shadcn ships a globals.css that itself contains a Tailwind v4 "@theme
  // inline" block wrapping its semantic --primary/--background variables —
  // so the Shadcn signature (the variables themselves) must be checked
  // before the generic Tailwind v4 "@theme {" signature, or a pasted
  // Shadcn file would be misdetected as plain Tailwind v4.
  if (/--(primary|background):\s*(oklch\(|-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%)/.test(trimmed)) {
    return "shadcn";
  }
  if (/@theme(?:\s+\w+)*\s*\{/.test(trimmed)) return "tailwind-v4";
  if (trimmed.includes("--bs-")) return "bootstrap";
  if (/\$primary:|\$font-size-base:/.test(trimmed)) return "bootstrap";
  if (trimmed.includes("createTheme({") || trimmed.includes("createTheme( {")) return "mantine";
  if (/module\.exports|export default/.test(trimmed) && trimmed.includes("theme:")) {
    return "tailwind-v3";
  }

  return "unknown";
}
