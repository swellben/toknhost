/**
 * Best-effort conversion of a JS object literal (unquoted keys, single
 * quotes, trailing commas — as found in `tailwind.config.js` and Mantine's
 * `createTheme({...})`) into something `JSON.parse` can read.
 *
 * This is intentionally NOT a JS parser. It can't evaluate function calls,
 * template literals, spreads, or callback values — those are dropped by
 * the caller (see tailwind-v3.ts / mantine.ts) before normalization, with
 * a warning surfaced to the user. For everything else (the vast majority
 * of real theme objects: nested literals, strings, arrays, numbers) this
 * round-trips correctly.
 */
export function looseObjectLiteralToJson(text: string): unknown | null {
  let normalized = text;

  // Strip // and /* */ comments.
  normalized = normalized.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Quote unquoted object keys: `foo:` -> `"foo":`, `50:` -> `"50":`.
  // Already-quoted keys (single or double) are left for the quote-style
  // pass below.
  normalized = normalized.replace(
    /([{,]\s*)([A-Za-z_$0-9][\w$-]*)(\s*:)/g,
    '$1"$2"$3'
  );

  // Convert single-quoted strings to double-quoted. Naive but sufficient
  // for theme files, which rarely contain escaped quotes.
  normalized = normalized.replace(/'((?:[^'\\]|\\.)*)'/g, (_m, inner) => {
    const escaped = inner.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  // Remove trailing commas before a closing bracket/brace.
  normalized = normalized.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

/** Extracts the text of the first balanced `{ ... }` block starting right
 * after `headerRe` matches (e.g. `createTheme(` or `theme:`). */
export function extractBalancedObject(input: string, headerRe: RegExp): string | null {
  const match = headerRe.exec(input);
  if (!match) return null;
  const openBraceIndex = input.indexOf("{", match.index + match[0].length - 1);
  if (openBraceIndex === -1) return null;

  let depth = 1;
  let i = openBraceIndex + 1;
  while (i < input.length && depth > 0) {
    if (input[i] === "{") depth++;
    else if (input[i] === "}") depth--;
    i++;
  }
  return input.slice(openBraceIndex, i);
}
