// The single, canonical implementation of token-presenting logic
// (canonical token -> target-framework shape). There is intentionally no
// other copy of this anywhere in the repo — see src/lib/exporters/README.md
// for why a previous duplicate (used by a test-only Next.js API route) was
// deleted. If this needs to change, this is the only file to touch.

export interface ResolvedToken {
  path: string;
  category: string;
  type: string;
  value: unknown;
}

export interface RawTokenValue {
  path: string;
  category: string;
  type: string;
  value: unknown;
  isAlias: boolean;
  aliasPath: string | null;
}

export interface PresentedTokens {
  framework: string;
  variables: Record<string, string>;
  document?: unknown;
  unmapped: string[];
}

export function resolveAliases(tokens: RawTokenValue[]): ResolvedToken[] {
  const byPath = new Map(tokens.map((t) => [t.path, t]));
  const resolved: ResolvedToken[] = [];

  function resolve(token: RawTokenValue, seen: Set<string>): unknown {
    if (!token.isAlias) return token.value;
    if (seen.has(token.path)) return null;
    const target = token.aliasPath ? byPath.get(token.aliasPath) : undefined;
    if (!target) return null;
    return resolve(target, new Set(seen).add(token.path));
  }

  for (const token of tokens) {
    resolved.push({
      path: token.path,
      category: token.category,
      type: token.type,
      value: resolve(token, new Set()),
    });
  }

  return resolved;
}

interface ShadowLayer {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

function shadowLayerToCss(layer: ShadowLayer): string {
  const inset = layer.inset ? "inset " : "";
  return `${inset}${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${layer.color}`;
}

function toCssValue(type: string, value: unknown): string | null {
  if (value === null || value === undefined || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  switch (type) {
    case "color":
      return String(v.oklch ?? v.hex ?? "");
    case "dimension":
      return `${v.value}${v.unit ?? "px"}`;
    case "duration":
      return `${v.value}${v.unit ?? "ms"}`;
    case "fontFamily": {
      const stack = (v.stack as string[]) ?? [String(v.primary ?? "")];
      return stack.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");
    }
    case "fontWeight":
    case "number":
      return String(v.value);
    case "cubicBezier":
      return `cubic-bezier(${v.p1x}, ${v.p1y}, ${v.p2x}, ${v.p2y})`;
    case "shadow": {
      const layers = v.layers as ShadowLayer[] | undefined;
      if (!layers?.length) return null;
      return layers.map(shadowLayerToCss).join(", ");
    }
    case "border": {
      const width = v.width as { value: number; unit: string } | undefined;
      if (!width) return null;
      return `${width.value}${width.unit} ${v.style} ${v.color}`;
    }
    case "transition": {
      const duration = v.duration as { value: number; unit: string } | undefined;
      const delay = v.delay as { value: number; unit: string } | undefined;
      const tf = v.timingFunction as { p1x: number; p1y: number; p2x: number; p2y: number } | undefined;
      if (!duration) return null;
      const timing = tf ? `cubic-bezier(${tf.p1x}, ${tf.p1y}, ${tf.p2x}, ${tf.p2y})` : "ease";
      const delayPart = delay ? ` ${delay.value}${delay.unit}` : "";
      return `all ${duration.value}${duration.unit} ${timing}${delayPart}`;
    }
    case "string":
    case "boolean":
      return String(v.value);
    default:
      return null;
  }
}

function pathToCssVar(path: string): string {
  return `--${path.replace(/\./g, "-")}`;
}

function presentCssVariables(tokens: ResolvedToken[]): PresentedTokens {
  const variables: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const token of tokens) {
    const value = toCssValue(token.type, token.value);
    if (value === null) {
      unmapped.push(token.path);
      continue;
    }
    variables[pathToCssVar(token.path)] = value;
  }
  return { framework: "css-variables", variables, unmapped };
}

function namespaceForV4(token: ResolvedToken): string | null {
  const segments = token.path.split(".");
  const key = segments.slice(1).join("-");

  switch (token.category) {
    case "color":
      return `--color-${key}`;
    case "font-family":
      return key === "base" ? "--font-sans" : `--font-${key}`;
    case "font-weight":
      return `--font-weight-${key}`;
    case "font-size":
      return `--text-${key}`;
    case "letter-spacing":
      return `--tracking-${key}`;
    case "line-height":
      return `--leading-${key}`;
    case "border-radius":
      return key === "base" ? "--radius" : `--radius-${key}`;
    case "shadow":
      return `--shadow-${key}`;
    case "drop-shadow":
      return `--drop-shadow-${key}`;
    case "text-shadow":
      return `--text-shadow-${key}`;
    case "easing":
      return `--ease-${key}`;
    case "animation":
      return `--animate-${key}`;
    case "breakpoint":
      return `--breakpoint-${key}`;
    case "spacing":
      return `--spacing-${key}`;
    // Tailwind v4's CSS-first theme has first-class namespaces for these too.
    case "duration":
      return `--duration-${key}`;
    case "opacity":
      return `--opacity-${key}`;
    case "sizing":
      return `--size-${key}`;
    case "z-index":
      return `--z-${key}`;
    // No native Tailwind v4 theme namespace for these — exposed as plain
    // custom properties rather than silently dropped.
    case "paragraph-spacing":
      return `--paragraph-spacing-${key}`;
    case "text-decoration":
      return `--text-decoration-${key}`;
    case "text-transform":
      return `--text-transform-${key}`;
    case "border-width":
      return `--border-width-${key}`;
    case "border-style":
      return `--border-style-${key}`;
    case "border":
      return `--border-${key}`;
    case "transition":
      return `--transition-${key}`;
    case "component":
      return `--component-${key}`;
    default:
      return null;
  }
}

function presentTailwindV4(tokens: ResolvedToken[]): PresentedTokens {
  const variables: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const token of tokens) {
    const varName = namespaceForV4(token);
    const value = varName ? toCssValue(token.type, token.value) : null;
    if (!varName || value === null) {
      unmapped.push(token.path);
      continue;
    }
    variables[varName] = value;
  }
  return { framework: "tailwind-v4", variables, unmapped };
}

// Mirrors COLOR_NAME_MAP in src/lib/parsers/shadcn.ts.
const SHADCN_PATH_TO_VAR: Record<string, string> = {
  "color.background": "background",
  "color.foreground": "foreground",
  "color.card": "card",
  "color.card.foreground": "card-foreground",
  "color.popover": "popover",
  "color.popover.foreground": "popover-foreground",
  "color.primary": "primary",
  "color.primary.foreground": "primary-foreground",
  "color.secondary": "secondary",
  "color.secondary.foreground": "secondary-foreground",
  "color.muted": "muted",
  "color.muted.foreground": "muted-foreground",
  "color.accent": "accent",
  "color.accent.foreground": "accent-foreground",
  "color.danger": "destructive",
  "color.danger.foreground": "destructive-foreground",
  "color.border": "border",
  "color.input": "input",
  "color.ring": "ring",
  "color.chart.1": "chart-1",
  "color.chart.2": "chart-2",
  "color.chart.3": "chart-3",
  "color.chart.4": "chart-4",
  "color.chart.5": "chart-5",
  "color.sidebar": "sidebar",
  "color.sidebar.foreground": "sidebar-foreground",
  "color.sidebar.primary": "sidebar-primary",
  "color.sidebar.primary.foreground": "sidebar-primary-foreground",
  "color.sidebar.accent": "sidebar-accent",
  "color.sidebar.accent.foreground": "sidebar-accent-foreground",
  "color.sidebar.border": "sidebar-border",
  "color.sidebar.ring": "sidebar-ring",
};

function presentShadcn(tokens: ResolvedToken[]): PresentedTokens {
  const variables: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const token of tokens) {
    if (token.path === "border-radius.base") {
      const value = toCssValue(token.type, token.value);
      if (value !== null) variables.radius = value;
      continue;
    }
    const varName = SHADCN_PATH_TO_VAR[token.path];
    const value = varName ? toCssValue(token.type, token.value) : null;
    if (!varName || value === null) {
      unmapped.push(token.path);
      continue;
    }
    variables[varName] = value;
  }
  return { framework: "shadcn", variables, unmapped };
}

const TYPE_TO_DTCG: Record<string, string> = {
  color: "color",
  dimension: "dimension",
  fontFamily: "fontFamily",
  fontWeight: "fontWeight",
  number: "number",
  duration: "duration",
  cubicBezier: "cubicBezier",
  shadow: "shadow",
  border: "border",
  transition: "transition",
  typography: "typography",
  gradient: "gradient",
  string: "string",
  boolean: "boolean",
};

function dtcgValue(type: string, value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  switch (type) {
    case "color":
      return v.hex;
    case "dimension":
    case "duration":
      return `${v.value}${v.unit}`;
    case "fontFamily":
      return v.stack ?? v.primary;
    case "fontWeight":
    case "number":
      return v.value;
    case "cubicBezier":
      return [v.p1x, v.p1y, v.p2x, v.p2y];
    case "string":
    case "boolean":
      return v.value;
    default:
      return value;
  }
}

function presentDtcg(tokens: ResolvedToken[]): PresentedTokens {
  const document: Record<string, unknown> = {};
  const unmapped: string[] = [];
  const allPaths = tokens.map((t) => t.path);
  const hasDescendants = (path: string) => allPaths.some((p) => p.startsWith(`${path}.`));

  for (const token of tokens) {
    const dtcgType = TYPE_TO_DTCG[token.type];
    if (!dtcgType) {
      unmapped.push(token.path);
      continue;
    }
    const segments = token.path.split(".");
    let node = document;
    for (const segment of segments.slice(0, -1)) {
      node[segment] = (node[segment] as Record<string, unknown>) ?? {};
      node = node[segment] as Record<string, unknown>;
    }
    const leafKey = segments.at(-1)!;
    const tokenObject = { $value: dtcgValue(token.type, token.value), $type: dtcgType };
    if (hasDescendants(token.path)) {
      node[leafKey] = (node[leafKey] as Record<string, unknown>) ?? {};
      (node[leafKey] as Record<string, unknown>).DEFAULT = tokenObject;
    } else {
      node[leafKey] = tokenObject;
    }
  }

  return { framework: "dtcg", variables: {}, document, unmapped };
}

// category -> Tailwind v3 theme.extend key, for categories with a real
// native theme namespace.
const V3_NATIVE_CATEGORY_KEY: Record<string, string> = {
  shadow: "boxShadow",
  "drop-shadow": "dropShadow",
  easing: "transitionTimingFunction",
  duration: "transitionDuration",
  opacity: "opacity",
  "z-index": "zIndex",
  "border-width": "borderWidth",
};

// category -> generic camelCase bucket, for categories Tailwind v3 has no
// native theme key for. Exposed anyway so nothing is silently dropped —
// inert extra theme data is harmless, dropping real values isn't.
const V3_GENERIC_CATEGORY_KEY: Record<string, string> = {
  "text-shadow": "textShadow",
  animation: "animation",
  sizing: "sizing",
  "border-style": "borderStyle",
  border: "border",
  "paragraph-spacing": "paragraphSpacing",
  "text-decoration": "textDecoration",
  "text-transform": "textTransform",
  transition: "transition",
  component: "component",
};

function presentTailwindV3(tokens: ResolvedToken[]): PresentedTokens {
  const colors: Record<string, unknown> = {};
  const borderRadius: Record<string, string> = {};
  const fontFamily: Record<string, unknown> = {};
  const fontSize: Record<string, string> = {};
  const fontWeight: Record<string, string> = {};
  const letterSpacing: Record<string, string> = {};
  const lineHeight: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const screens: Record<string, string> = {};
  const extraBuckets: Record<string, Record<string, string>> = {};
  const unmapped: string[] = [];

  for (const token of tokens) {
    const segments = token.path.split(".");
    const value = toCssValue(token.type, token.value);
    if (value === null) { unmapped.push(token.path); continue; }

    if (token.category === "color") {
      const [, ...rest] = segments;
      if (rest.length === 0) { unmapped.push(token.path); continue; }
      const key = rest[0]!;
      if (rest.length === 1) {
        const existing = colors[key];
        if (existing && typeof existing === "object") {
          (existing as Record<string, string>).DEFAULT = value;
        } else {
          colors[key] = value;
        }
      } else {
        const step = rest.slice(1).join("-");
        if (!colors[key] || typeof colors[key] !== "object") {
          const prev = colors[key];
          colors[key] = prev !== undefined ? { DEFAULT: prev as string } : {};
        }
        (colors[key] as Record<string, string>)[step] = value;
      }
    } else if (token.category === "border-radius") {
      const key = segments.slice(1).join("-");
      borderRadius[key === "base" ? "DEFAULT" : key] = value;
    } else if (token.category === "font-family") {
      const key = segments.slice(1).join("-");
      fontFamily[key === "base" ? "sans" : key] = value.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    } else if (token.category === "font-size") {
      fontSize[segments.slice(1).join("-")] = value;
    } else if (token.category === "font-weight") {
      fontWeight[segments.slice(1).join("-")] = value;
    } else if (token.category === "letter-spacing") {
      letterSpacing[segments.slice(1).join("-")] = value;
    } else if (token.category === "line-height") {
      lineHeight[segments.slice(1).join("-")] = value;
    } else if (token.category === "spacing") {
      spacing[segments.slice(1).join("-") || "DEFAULT"] = value;
    } else if (token.category === "breakpoint") {
      screens[segments.slice(1).join("-")] = value;
    } else {
      const bucketKey = V3_NATIVE_CATEGORY_KEY[token.category] ?? V3_GENERIC_CATEGORY_KEY[token.category];
      if (!bucketKey) { unmapped.push(token.path); continue; }
      const key = segments.slice(1).join("-") || "DEFAULT";
      extraBuckets[bucketKey] = extraBuckets[bucketKey] ?? {};
      extraBuckets[bucketKey][key] = value;
    }
  }

  const themeExtend: Record<string, unknown> = {};
  if (Object.keys(colors).length)        themeExtend.colors = colors;
  if (Object.keys(borderRadius).length)  themeExtend.borderRadius = borderRadius;
  if (Object.keys(fontFamily).length)    themeExtend.fontFamily = fontFamily;
  if (Object.keys(fontSize).length)      themeExtend.fontSize = fontSize;
  for (const [bucketKey, values] of Object.entries(extraBuckets)) {
    themeExtend[bucketKey] = values;
  }
  if (Object.keys(fontWeight).length)    themeExtend.fontWeight = fontWeight;
  if (Object.keys(letterSpacing).length) themeExtend.letterSpacing = letterSpacing;
  if (Object.keys(lineHeight).length)    themeExtend.lineHeight = lineHeight;
  if (Object.keys(spacing).length)       themeExtend.spacing = spacing;
  if (Object.keys(screens).length)       themeExtend.screens = screens;

  return { framework: "tailwind-v3", variables: {}, document: { theme: { extend: themeExtend } }, unmapped };
}

// Bootstrap SCSS variable names for well-known semantic roles. Mirrors the
// pattern of SHADCN_PATH_TO_VAR above — explicit map for roles Bootstrap has
// a defined name for; everything else falls through to a generic $path-name.
const BOOTSTRAP_PATH_TO_VAR: Record<string, string> = {
  "color.primary": "primary",
  "color.secondary": "secondary",
  "color.success": "success",
  "color.danger": "danger",
  "color.warning": "warning",
  "color.info": "info",
  "color.background": "body-bg",
  "color.foreground": "body-color",
  "color.border": "border-color",
  "color.muted": "secondary-bg",
  "border-radius.base": "border-radius",
  "border-radius.sm": "border-radius-sm",
  "border-radius.lg": "border-radius-lg",
  "border-width.base": "border-width",
  "font-family.base": "font-family-base",
  "font-size.base": "font-size-base",
  "line-height.base": "line-height-base",
};

/**
 * Presents tokens as Bootstrap SCSS variables ($name: value;). Well-known
 * roles get Bootstrap's own variable names; breakpoints are additionally
 * collected into the `$grid-breakpoints` map (via `document`) since
 * Bootstrap expects that as a single SCSS map, not individual variables.
 */
function presentBootstrap(tokens: ResolvedToken[]): PresentedTokens {
  const variables: Record<string, string> = {};
  const breakpoints: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const token of tokens) {
    const value = toCssValue(token.type, token.value);
    if (value === null) {
      unmapped.push(token.path);
      continue;
    }

    if (token.category === "breakpoint") {
      const key = token.path.split(".").slice(1).join("-");
      breakpoints[key] = value;
      continue;
    }

    const varName = BOOTSTRAP_PATH_TO_VAR[token.path];
    if (!varName) {
      // Generic fallback: turn any other token into a plausibly-named SCSS var
      // rather than dropping it — Bootstrap doesn't define names for most of
      // our categories (shadow, transition, sizing, component, etc.).
      variables[token.path.replace(/\./g, "-")] = value;
      continue;
    }
    variables[varName] = value;
  }

  const document = Object.keys(breakpoints).length ? { gridBreakpoints: breakpoints } : undefined;
  return { framework: "bootstrap", variables, document, unmapped };
}

/** Converts a hex color (#rrggbb or #rrggbbaa) to Figma's float RGBA shape. */
function hexToFigmaRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function figmaResolvedType(type: string): "BOOLEAN" | "FLOAT" | "STRING" | "COLOR" {
  switch (type) {
    case "color":
      return "COLOR";
    case "boolean":
      return "BOOLEAN";
    case "dimension":
    case "duration":
    case "fontWeight":
    case "number":
      return "FLOAT";
    default:
      // fontFamily, cubicBezier, shadow, border, transition, string — Figma
      // variables have no composite types, so these are serialized as STRING.
      return "STRING";
  }
}

function figmaRawValue(type: string, resolvedType: ReturnType<typeof figmaResolvedType>, value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if (resolvedType === "COLOR") return hexToFigmaRgba(String(v.hex ?? "#000000"));
  if (resolvedType === "FLOAT") return Number(v.value ?? 0);
  if (resolvedType === "BOOLEAN") return Boolean(v.value);
  // STRING fallback — reuse the CSS string form so the value is still
  // human-readable when pasted into Figma (e.g. "1px solid #e5e7eb").
  return toCssValue(type, value) ?? JSON.stringify(value);
}

/**
 * Presents tokens as a Figma Variables REST API response — the exact shape
 * `parseFigmaVariables` (src/lib/parsers/figma-variables.ts) reads back in,
 * so this is a true round-trip format, not just Figma-flavored JSON.
 * One collection ("Tokens"), one mode ("Default") since our tokens are
 * already mode-resolved by the time they reach this presenter.
 */
function presentFigmaVariables(tokens: ResolvedToken[]): PresentedTokens {
  const collectionId = "VariableCollectionId:1:0";
  const modeId = "1:0";
  const variables: Record<string, unknown> = {};
  const unmapped: string[] = [];

  for (const token of tokens) {
    const resolvedType = figmaResolvedType(token.type);
    const raw = figmaRawValue(token.type, resolvedType, token.value);
    if (raw === null || raw === undefined) {
      unmapped.push(token.path);
      continue;
    }
    const id = `VariableID:${token.path}`;
    variables[id] = {
      id,
      name: token.path.replace(/\./g, "/"),
      variableCollectionId: collectionId,
      resolvedType,
      valuesByMode: { [modeId]: raw },
    };
  }

  const document = {
    meta: {
      variables,
      variableCollections: {
        [collectionId]: { id: collectionId, defaultModeId: modeId },
      },
    },
  };

  return { framework: "figma-variables", variables: {}, document, unmapped };
}

export function presentTokens(tokens: ResolvedToken[], framework: string): PresentedTokens {
  switch (framework) {
    case "tailwind-v4":
      return presentTailwindV4(tokens);
    case "shadcn":
      return presentShadcn(tokens);
    case "tailwind-v3":
      return presentTailwindV3(tokens);
    case "bootstrap":
      return presentBootstrap(tokens);
    case "figma-variables":
      return presentFigmaVariables(tokens);
    case "dtcg":
      return presentDtcg(tokens);
    case "css-variables":
    default:
      return presentCssVariables(tokens);
  }
}
