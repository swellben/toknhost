import type { ParseResult } from "@/types/tokens";
import { detectFormat } from "./detect";
import { parseDtcg } from "./dtcg";
import { parseTokensStudio } from "./tokens-studio";
import { parseTailwindV4 } from "./tailwind-v4";
import { parseTailwindV3 } from "./tailwind-v3";
import { parseShadcn } from "./shadcn";
import { parseBootstrap } from "./bootstrap";
import { parseMantine } from "./mantine";
import { parseFigmaVariables } from "./figma-variables";

/**
 * Detects the input format and dispatches to the right parser. Covers all
 * 8 ingestion formats from CLAUDE.md (DESIGN.md is export-only — decision
 * #6 — and is never a parse target here).
 */
export function parseInput(input: string): ParseResult {
  const format = detectFormat(input);

  switch (format) {
    case "dtcg":
      return parseDtcg(input);
    case "tokens-studio":
      return parseTokensStudio(input);
    case "tailwind-v4":
      return parseTailwindV4(input);
    case "tailwind-v3":
      return parseTailwindV3(input);
    case "shadcn":
      return parseShadcn(input);
    case "bootstrap":
      return parseBootstrap(input);
    case "mantine":
      return parseMantine(input);
    case "figma-variables":
      return parseFigmaVariables(input);
    default:
      return {
        format: "unknown",
        tokens: [],
        warnings: [
          "Could not detect a supported format. Supported: DTCG, Tokens Studio, Tailwind v3/v4, Shadcn, Bootstrap, Mantine, Figma Variables.",
        ],
      };
  }
}
