// Renders a token_values.value JSONB blob (shape depends on tokens.type —
// see schema-design.md) into something human-readable for the token table.

export interface FormattedValue {
  display: string;
  swatch?: string; // hex, when the value is a color
}

export function formatTokenValue(type: string, value: unknown): FormattedValue {
  if (value === null || value === undefined) {
    return { display: "—" };
  }

  if (typeof value !== "object") {
    return { display: String(value) };
  }

  const v = value as Record<string, unknown>;

  switch (type) {
    case "color":
      return { display: String(v.hex ?? ""), swatch: String(v.hex ?? "") };
    case "dimension":
    case "duration":
      return { display: `${v.value}${v.unit ?? ""}` };
    case "fontFamily":
      return { display: String(v.primary ?? (v.stack as string[])?.[0] ?? "") };
    case "fontWeight":
    case "number":
      return { display: String(v.value) };
    case "cubicBezier":
      return { display: `cubic-bezier(${v.p1x}, ${v.p1y}, ${v.p2x}, ${v.p2y})` };
    case "string":
      return { display: String(v.value) };
    case "boolean":
      return { display: String(v.value) };
    default:
      return { display: JSON.stringify(value) };
  }
}
