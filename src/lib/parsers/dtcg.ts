import type {
  ParsedToken,
  ParseResult,
  TokenCategory,
  TokenType,
} from "@/types/tokens";

// DTCG type -> our canonical (category, type). See schema-design.md and
// parser-ref-dtcg.md §4.1 for the cross-format mapping table.
const DTCG_TYPE_MAP: Record<string, { category: TokenCategory; type: TokenType }> = {
  color: { category: "color", type: "color" },
  dimension: { category: "spacing", type: "dimension" },
  fontFamily: { category: "font-family", type: "fontFamily" },
  fontWeight: { category: "font-weight", type: "fontWeight" },
  number: { category: "opacity", type: "number" },
  duration: { category: "duration", type: "duration" },
  cubicBezier: { category: "easing", type: "cubicBezier" },
  shadow: { category: "shadow", type: "shadow" },
  border: { category: "border", type: "border" },
  transition: { category: "transition", type: "transition" },
  typography: { category: "component", type: "typography" },
  gradient: { category: "color", type: "gradient" },
  strokeStyle: { category: "border-style", type: "string" },
};

const ALIAS_RE = /^\{([^{}]+)\}$/;

interface RawNode {
  [key: string]: unknown;
}

function isToken(node: unknown): node is RawNode {
  return (
    typeof node === "object" &&
    node !== null &&
    "$value" in (node as RawNode)
  );
}

function isGroup(node: unknown): node is RawNode {
  return (
    typeof node === "object" &&
    node !== null &&
    !("$value" in (node as RawNode)) &&
    Object.keys(node as RawNode).some((k) => !k.startsWith("$"))
  );
}

/** Best-effort dimension parser: "16px" / "1rem" -> { value, unit }. Also
 * tolerates unitless numbers from Tokens Studio-flavored DTCG exports. */
function parseDimension(raw: string): { value: number; unit: "px" | "rem" } {
  const match = /^(-?[\d.]+)(px|rem)?$/.exec(raw.trim());
  if (!match) return { value: 0, unit: "px" };
  const value = parseFloat(match[1]);
  const unit = (match[2] as "px" | "rem") ?? "px";
  // Normalize rem to px at a 16px base for internal storage, per
  // CLAUDE.md rule 8 ("all dimensions normalized to px in the DB").
  return unit === "rem" ? { value: value * 16, unit: "px" } : { value, unit: "px" };
}

function parseDuration(raw: string): { value: number; unit: "ms" } {
  const match = /^(-?[\d.]+)ms$/.exec(raw.trim());
  return { value: match ? parseFloat(match[1]) : 0, unit: "ms" };
}

function hexToOklch(hex: string): string {
  // Gap-fill / color-science conversion happens in src/lib/gap-fill — the
  // parser only needs to preserve the hex faithfully. Placeholder until the
  // gap-fill pass runs culori over every imported color.
  return `oklch(from ${hex} l c h)`;
}

function buildScalarValue(
  type: TokenType,
  raw: unknown
): { value: ParsedToken["value"]; rawValue: string } {
  switch (type) {
    case "color": {
      const hex = String(raw);
      return { value: { hex, oklch: hexToOklch(hex), space: "oklch" }, rawValue: hex };
    }
    case "dimension":
      return { value: parseDimension(String(raw)), rawValue: String(raw) };
    case "duration":
      return { value: parseDuration(String(raw)), rawValue: String(raw) };
    case "fontFamily": {
      const stack = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      return { value: { stack, primary: stack[0] }, rawValue: stack.join(", ") };
    }
    case "fontWeight": {
      const value = typeof raw === "number" ? raw : Number(raw) || 400;
      return { value: { value }, rawValue: String(raw) };
    }
    case "number":
      return { value: { value: Number(raw) }, rawValue: String(raw) };
    case "cubicBezier": {
      const [p1x, p1y, p2x, p2y] = raw as number[];
      return { value: { p1x, p1y, p2x, p2y }, rawValue: JSON.stringify(raw) };
    }
    case "shadow": {
      const layers = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
      return {
        value: {
          layers: layers.map((l) => ({
            offsetX: parseDimension(String(l.offsetX ?? "0px")).value,
            offsetY: parseDimension(String(l.offsetY ?? "0px")).value,
            blur: parseDimension(String(l.blur ?? "0px")).value,
            spread: parseDimension(String(l.spread ?? "0px")).value,
            color: String(l.color ?? "#000000"),
            inset: Boolean(l.inset),
          })),
        },
        rawValue: JSON.stringify(raw),
      };
    }
    case "border": {
      const b = raw as Record<string, unknown>;
      return {
        value: {
          color: String(b.color ?? ""),
          width: parseDimension(String(b.width ?? "1px")),
          style: String(b.style ?? "solid"),
        },
        rawValue: JSON.stringify(raw),
      };
    }
    case "transition": {
      const t = raw as Record<string, unknown>;
      const [p1x, p1y, p2x, p2y] = (t.timingFunction as number[]) ?? [0.4, 0, 0.2, 1];
      return {
        value: {
          duration: parseDuration(String(t.duration ?? "0ms")),
          delay: parseDuration(String(t.delay ?? "0ms")),
          timingFunction: { p1x, p1y, p2x, p2y },
        },
        rawValue: JSON.stringify(raw),
      };
    }
    case "string":
      return { value: { value: String(raw) }, rawValue: String(raw) };
    case "boolean":
      return { value: { value: Boolean(raw) }, rawValue: String(raw) };
    default:
      // typography / gradient — pass through as a loose object for now.
      return { value: raw as Record<string, unknown>, rawValue: JSON.stringify(raw) };
  }
}

/**
 * Parses a W3C DTCG token file into our canonical token list.
 * See docs/parser-refs/parser-ref-dtcg.md for the spec this implements.
 */
export function parseDtcg(input: string): ParseResult {
  const warnings: string[] = [];
  const tokens: ParsedToken[] = [];
  const root = JSON.parse(input) as RawNode;

  function walk(node: RawNode, pathParts: string[], inheritedType?: string) {
    const groupType = (node.$type as string | undefined) ?? inheritedType;

    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      const childPath = [...pathParts, key];

      if (isToken(child)) {
        const dtcgType = (child.$type as string | undefined) ?? groupType;
        if (!dtcgType) {
          warnings.push(`${childPath.join(".")}: no $type found, skipping`);
          continue;
        }

        const mapped = DTCG_TYPE_MAP[dtcgType];
        if (!mapped) {
          warnings.push(`${childPath.join(".")}: unsupported $type "${dtcgType}", skipping`);
          continue;
        }

        const rawValue = child.$value;
        const aliasMatch =
          typeof rawValue === "string" ? ALIAS_RE.exec(rawValue) : null;

        if (aliasMatch) {
          tokens.push({
            path: childPath.join("."),
            category: mapped.category,
            type: mapped.type,
            description: child.$description as string | undefined,
            isAlias: true,
            aliasPath: aliasMatch[1],
            value: null,
            rawValue: rawValue as string,
            provenanceMeta: { format: "dtcg" },
          });
          continue;
        }

        const { value, rawValue: rv } = buildScalarValue(mapped.type, rawValue);
        tokens.push({
          path: childPath.join("."),
          category: mapped.category,
          type: mapped.type,
          description: child.$description as string | undefined,
          isAlias: false,
          value,
          rawValue: rv,
          provenanceMeta: { format: "dtcg" },
        });
      } else if (isGroup(child)) {
        walk(child, childPath, groupType);
      }
    }
  }

  walk(root, [], undefined);

  return { format: "dtcg", tokens, warnings };
}
