import type { ParsedToken, ParseResult, TokenCategory, TokenType } from "@/types/tokens";
import { makeToken, rgbaFloatToValue, stringValue } from "./shared";

interface FigmaVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  valuesByMode: Record<string, unknown>;
  description?: string;
}

interface FigmaCollection {
  id: string;
  defaultModeId: string;
}

interface FigmaMeta {
  variables: Record<string, FigmaVariable>;
  variableCollections: Record<string, FigmaCollection>;
}

function toPath(name: string): string {
  return name.replace(/\//g, ".");
}

function isAlias(value: unknown): value is { type: "VARIABLE_ALIAS"; id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "VARIABLE_ALIAS"
  );
}

function typeOf(resolvedType: FigmaVariable["resolvedType"], path: string): { category: TokenCategory; type: TokenType } {
  switch (resolvedType) {
    case "COLOR":
      return { category: "color", type: "color" };
    case "BOOLEAN":
      return { category: "component", type: "boolean" };
    case "FLOAT":
      // Figma strips units from FLOAT variables — see
      // parser-ref-figma-variables.md §3.5/§4.2. We can't know if this was
      // meant as px, so it's stored as a bare number rather than guessing
      // a dimension unit.
      return { category: "sizing", type: "number" };
    case "STRING":
      return path.toLowerCase().includes("font")
        ? { category: "font-family", type: "fontFamily" }
        : { category: "component", type: "string" };
  }
}

/**
 * Parses the Figma Variables REST API response (`GET /v1/files/:key/
 * variables/local`), either the full `{ meta: {...} }` envelope or just
 * the `meta` object. Only each collection's `defaultModeId` value is
 * imported — other modes (e.g. a Dark Figma mode) are skipped, same as
 * the Shadcn `.dark` block, since gap-fill regenerates dark mode. See
 * parser-ref-figma-variables.md §3.3–3.7.
 */
export function parseFigmaVariables(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];

  const json = JSON.parse(input) as { meta?: FigmaMeta } & Partial<FigmaMeta>;
  const meta: FigmaMeta = json.meta ?? (json as FigmaMeta);

  if (!meta?.variables || !meta?.variableCollections) {
    return { format: "figma-variables", tokens: [], warnings: ["No variables/variableCollections found."] };
  }

  const idToPath = new Map<string, string>();
  for (const v of Object.values(meta.variables)) {
    idToPath.set(v.id, toPath(v.name));
  }

  let skippedModes = 0;

  for (const variable of Object.values(meta.variables)) {
    const path = toPath(variable.name);
    const collection = meta.variableCollections[variable.variableCollectionId];
    if (!collection) {
      warnings.push(`${path}: missing variable collection, skipped`);
      continue;
    }

    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length > 1) skippedModes += modeIds.length - 1;

    const raw = variable.valuesByMode[collection.defaultModeId];
    if (raw === undefined) {
      warnings.push(`${path}: no value for the default mode, skipped`);
      continue;
    }

    const mapped = typeOf(variable.resolvedType, path);

    if (isAlias(raw)) {
      const aliasPath = idToPath.get(raw.id);
      if (!aliasPath) {
        warnings.push(`${path}: alias target not found, skipped`);
        continue;
      }
      tokens.push(
        makeToken({
          path,
          category: mapped.category,
          type: mapped.type,
          description: variable.description,
          aliasPath,
          value: null,
          rawValue: `{${aliasPath}}`,
          format: "figma-variables",
        })
      );
      continue;
    }

    let value: ParsedToken["value"];
    let rawValue: string;

    if (variable.resolvedType === "COLOR") {
      const c = raw as { r: number; g: number; b: number; a: number };
      value = rgbaFloatToValue(c.r, c.g, c.b);
      rawValue = JSON.stringify(c);
    } else if (variable.resolvedType === "BOOLEAN") {
      value = { value: Boolean(raw) };
      rawValue = String(raw);
    } else if (variable.resolvedType === "FLOAT") {
      value = { value: Number(raw) };
      rawValue = String(raw);
    } else {
      value = stringValue(String(raw));
      rawValue = String(raw);
    }

    tokens.push(
      makeToken({
        path,
        category: mapped.category,
        type: mapped.type,
        description: variable.description,
        value,
        rawValue,
        format: "figma-variables",
      })
    );
  }

  if (skippedModes > 0) {
    warnings.push(
      `${skippedModes} non-default mode value(s) were skipped — run gap-fill afterwards to generate dark mode automatically.`
    );
  }

  return { format: "figma-variables", tokens, warnings };
}
