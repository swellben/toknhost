// Calls the live, deployed MCP server (supabase/functions/design-system-mcp)
// instead of re-implementing alias resolution / token presentation here.
// That logic was deliberately consolidated into one place (see
// src/lib/exporters/README.md) — this is what "fetch the deployed Edge
// Function instead of reintroducing a duplicate" looks like in practice.
// As a side effect, every page load of the preview is a real, live test
// of the MCP server's get_tokens tool.

export interface PreviewTokens {
  framework: string;
  variables: Record<string, string>;
  unmapped: string[];
}

export async function fetchPreviewTokens(
  slug: string,
  mcpToken: string,
  isPublic: boolean,
  mode?: string
): Promise<PreviewTokens | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/design-system-mcp/${slug}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isPublic ? {} : { Authorization: `Bearer ${mcpToken}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_tokens", arguments: { framework: "css-variables", mode } },
      }),
      cache: "no-store", // tokens change often via inline editing — never serve stale
    });

    if (!res.ok) return null;

    const body = await res.json();
    const text = body?.result?.content?.[0]?.text;
    if (typeof text !== "string") return null;

    const parsed = JSON.parse(text) as {
      error?: string;
      modes?: Record<string, PreviewTokens>;
    };
    if (parsed.error || !parsed.modes) return null;

    const modeKey = mode && parsed.modes[mode] ? mode : Object.keys(parsed.modes)[0];
    return modeKey ? parsed.modes[modeKey] : null;
  } catch {
    return null;
  }
}

/** Fetches every mode's tokens in one call (the MCP server's get_theme
 * tool) — used to power the preview pane's own light/dark toggle, which
 * is independent of the rest of the page (so it shouldn't refetch from
 * the server on every flip; the client just switches between these). */
export async function fetchPreviewTheme(
  slug: string,
  mcpToken: string,
  isPublic: boolean
): Promise<Record<string, PreviewTokens> | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/design-system-mcp/${slug}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isPublic ? {} : { Authorization: `Bearer ${mcpToken}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_theme", arguments: { framework: "css-variables" } },
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const body = await res.json();
    const text = body?.result?.content?.[0]?.text;
    if (typeof text !== "string") return null;

    const parsed = JSON.parse(text) as {
      error?: string;
      modes?: Record<string, PreviewTokens>;
    };
    if (parsed.error || !parsed.modes) return null;

    return parsed.modes;
  } catch {
    return null;
  }
}
