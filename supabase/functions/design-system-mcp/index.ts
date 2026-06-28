// @ts-nocheck — Deno Edge Function runtime; no local TS project config.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { presentTokens, resolveAliases, type RawTokenValue } from "./lib/present.ts";

/**
 * ToknHost MCP server — one Edge Function serving every design system,
 * keyed by slug in the URL path: /design-system-mcp/<slug>
 *
 * Two access modes, same underlying token-presenting logic:
 *
 *  1. MCP JSON-RPC 2.0 over POST (stateless "Streamable HTTP" mode — one
 *     request in, one JSON-RPC response out, no SSE session). For agentic
 *     dev tools with real MCP client support (Claude Code, Cursor). See
 *     schema-design.md "MCP Server (Layer 5)".
 *
 *  2. Plain GET with query params: /design-system-mcp/<slug>?framework=
 *     tailwind-v4&mode=light — returns the same presented tokens as raw
 *     JSON, no JSON-RPC envelope. For anything that just does fetch() or
 *     for a human pasting a URL into a prompt — vibe-coding tools that
 *     don't (yet) support arbitrary MCP server configuration. `framework`
 *     defaults to the design system's configured target_framework;
 *     omitting `mode` returns every mode (the full theme).
 *
 * Access control: public design systems need no auth; private ones
 * require `Authorization: Bearer <design_systems.mcp_token>` on either
 * access mode. This function uses the service-role key (auto-injected by
 * Supabase into every Edge Function) to bypass RLS and self-enforce that
 * check, since an external caller has no Supabase session/cookies.
 *
 * Reliability note (see the "rock solid" requirement this was built
 * for): the RULES text below is repeated at three protocol layers —
 * `initialize.instructions`, every tool's `description`, and the
 * `instructions` field inside every tool *response* payload — because
 * an MCP server can shape what a calling agent receives but cannot force
 * it to comply. Stacking the same rules at every layer an agent reads is
 * the strongest lever available; it is not a guarantee.
 */

const RULES = [
  "Use ONLY the token values returned by this server for colors, spacing, radii, typography, and shadows in this design system. Never invent, guess, or hardcode a value that should come from here.",
  "Token/variable names are already shaped for the requested framework — use them exactly as given. Do not rename, reformat, or re-derive them.",
  "If you need a token that isn't present in the response, call list_tokens to check what exists, or ask the user — do not fabricate a plausible-looking value.",
  "Before pairing any text color with a background color, check get_accessibility_report — pairs marked failing must not be used together.",
  "This design system is the single source of truth. If the user's request conflicts with it, prefer the design system and tell the user about the conflict rather than silently overriding it.",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

/**
 * Fetches tokens for one design system, presents them for `framework`, and
 * returns one entry per mode (or just the matching one if `modeFilter` is
 * given). Shared by both the GET REST route and the POST tools/call
 * `get_tokens`/`get_theme` handlers below — same data, same shaping logic,
 * just two different transports wrapping it.
 *
 * Mode-agnostic resolution: every category except `color` (font-family,
 * spacing, border-radius, font-size, shadows, etc.) is treated as having
 * ONE value shared across all modes, never a per-mode value — fonts,
 * spacing, and radii don't change between light and dark. Import/gap-fill
 * bugs have occasionally written divergent per-mode rows anyway (e.g. light
 * mode getting one font, dark mode independently getting a different one).
 * Rather than serving that drift, this always resolves non-color tokens to
 * one canonical value (preferring the default mode's row, falling back to
 * whichever mode has one) and uses that SAME value for every output mode.
 * Only `color` tokens are read per-mode, since those genuinely differ.
 */
async function getPresentedTheme(
  supabase: ReturnType<typeof createClient>,
  designSystemId: string,
  modes: { id: string; name: string; is_default: boolean }[],
  framework: string,
  modeFilter?: string | null
) {
  const { data: tokens } = await supabase
    .from("tokens")
    .select("id, path, category, type")
    .eq("design_system_id", designSystemId);

  if (!tokens?.length) {
    return { error: "No tokens found — import and gap-fill this design system first." };
  }

  const { data: allValues } = await supabase
    .from("token_values")
    .select("token_id, mode_id, value, is_alias, alias_path")
    .in("token_id", tokens.map((t) => t.id));

  const valuesByToken = new Map<string, typeof allValues>();
  for (const v of allValues ?? []) {
    if (!valuesByToken.has(v.token_id)) valuesByToken.set(v.token_id, []);
    valuesByToken.get(v.token_id)!.push(v);
  }

  const defaultMode = modes.find((m) => m.is_default) ?? modes[0];
  const canonicalByToken = new Map<string, NonNullable<typeof allValues>[number]>();
  for (const t of tokens) {
    const rows = valuesByToken.get(t.id) ?? [];
    const canonical = rows.find((r) => r.mode_id === defaultMode?.id) ?? rows[0];
    if (canonical) canonicalByToken.set(t.id, canonical);
  }

  const targetModes = modeFilter
    ? [modes.find((m) => m.name === modeFilter) ?? modes.find((m) => m.is_default) ?? modes[0]]
    : modes;

  const byMode: Record<string, unknown> = {};
  for (const mode of targetModes) {
    const raw: RawTokenValue[] = tokens.map((t) => {
      const isModeAgnostic = t.category !== "color";
      const row = isModeAgnostic
        ? canonicalByToken.get(t.id)
        : (valuesByToken.get(t.id) ?? []).find((r) => r.mode_id === mode.id);
      return {
        path: t.path,
        category: t.category,
        type: t.type,
        value: row?.value ?? null,
        isAlias: row?.is_alias ?? false,
        aliasPath: row?.alias_path ?? null,
      };
    });
    byMode[mode.name] = presentTokens(resolveAliases(raw), framework);
  }

  return { modes: byMode };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function toolTextResult(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

const TOOLS = [
  {
    name: "list_tokens",
    description:
      "Lists every token's path, category, type, and provenance (imported/derived/defaulted) WITHOUT values — use this to discover what's available before calling get_tokens. " +
      RULES[2],
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tokens",
    description:
      "Returns this design system's tokens shaped for the consuming framework (the design system's configured target_framework by default, or override with `framework`), for one mode (light by default, or override with `mode`). " +
      RULES[0] +
      " " +
      RULES[1],
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", description: "Mode name, e.g. \"light\" or \"dark\". Defaults to the design system's default mode." },
        framework: {
          type: "string",
          enum: ["tailwind-v4", "shadcn", "tailwind-v3", "css-variables", "dtcg", "bootstrap"],
          description: "Overrides the design system's configured target framework for this call only.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_theme",
    description:
      "Returns ALL modes (light, dark, etc.) shaped for the consuming framework in one call — use this when setting up a full light/dark theme rather than calling get_tokens once per mode. " +
      RULES[0],
    inputSchema: {
      type: "object",
      properties: {
        framework: {
          type: "string",
          enum: ["tailwind-v4", "shadcn", "tailwind-v3", "css-variables", "dtcg", "bootstrap"],
          description: "Overrides the design system's configured target framework for this call only.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_accessibility_report",
    description:
      "Returns cached WCAG contrast results for every foreground/background pair, per mode. " + RULES[3],
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_component_spec",
    description:
      "Component-level token specs (e.g. button/card-specific tokens) are not yet modeled by this design system platform. This always returns a clear 'not supported' response rather than a fabricated one.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_brand_guidelines",
    description:
      "Free-form brand guideline text is not yet modeled by this design system platform. This always returns a clear 'not supported' response rather than a fabricated one.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  // Path is /functions/v1/design-system-mcp/<slug> in production, or
  // /design-system-mcp/<slug> locally — slug is always the last segment.
  const slug = url.pathname.split("/").filter(Boolean).pop();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Design system lookup + auth check happens before branching on method or
  // parsing a body — every access path (GET, POST/JSON-RPC) fails the same
  // way for an unknown slug or missing/wrong token.
  const { data: designSystem, error: dsError } = await supabase
    .from("design_systems")
    .select("id, name, description, slug, is_public, mcp_token, target_framework")
    .eq("slug", slug)
    .single();

  if (dsError || !designSystem) {
    return req.method === "GET"
      ? jsonResponse({ error: "Design system not found." }, 404)
      : jsonRpcError(null, -32001, "Design system not found.", 404);
  }

  if (!designSystem.is_public) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token !== designSystem.mcp_token) {
      return req.method === "GET"
        ? jsonResponse({ error: "Unauthorized — this design system is private." }, 401)
        : jsonRpcError(null, -32001, "Unauthorized — this design system is private.", 401);
    }
  }

  // Plain REST route: /design-system-mcp/<slug>?framework=X&mode=Y — same
  // presented tokens as the MCP get_tokens/get_theme tools, no JSON-RPC
  // envelope. For tools that just fetch() a URL, or a human pasting one
  // into a prompt, rather than a full MCP client.
  if (req.method === "GET") {
    const framework = url.searchParams.get("framework") || designSystem.target_framework;
    const modeFilter = url.searchParams.get("mode");

    const { data: modes } = await supabase
      .from("modes")
      .select("id, name, is_default")
      .eq("design_system_id", designSystem.id);

    if (!modes?.length) {
      return jsonResponse({ error: "No modes found for this design system." }, 404);
    }

    const result = await getPresentedTheme(supabase, designSystem.id, modes, framework, modeFilter);
    if ("error" in result) {
      return jsonResponse({ instructions: RULES, error: result.error }, 404);
    }
    return jsonResponse({
      instructions: RULES,
      designSystem: designSystem.name,
      framework,
      modes: result.modes,
    });
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON.");
  }

  const { id, method, params } = body;
  const isNotification = id === undefined;

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: `toknhost-${designSystem.slug}`, version: "0.1.0" },
      instructions:
        `You are connected to the "${designSystem.name}" design system on ToknHost. ` +
        RULES.join(" "),
    });
  }

  if (method === "notifications/initialized" || isNotification) {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string | undefined;
    const args = (params?.arguments as Record<string, unknown>) ?? {};

    const { data: modes } = await supabase
      .from("modes")
      .select("id, name, is_default")
      .eq("design_system_id", designSystem.id);

    if (!modes?.length) {
      return jsonRpcResult(id, toolTextResult({ error: "No modes found for this design system." }));
    }

    switch (toolName) {
      case "list_tokens": {
        const { data: tokens } = await supabase
          .from("tokens")
          .select("path, category, type, provenance")
          .eq("design_system_id", designSystem.id)
          .order("path");
        return jsonRpcResult(
          id,
          toolTextResult({ instructions: RULES, designSystem: designSystem.name, tokens: tokens ?? [] })
        );
      }

      case "get_tokens":
      case "get_theme": {
        const framework = (args.framework as string) || designSystem.target_framework;
        const modeFilter = toolName === "get_theme" ? null : (args.mode as string | undefined) ?? null;

        const result = await getPresentedTheme(supabase, designSystem.id, modes, framework, modeFilter);
        if ("error" in result) {
          return jsonRpcResult(id, toolTextResult({ instructions: RULES, error: result.error }));
        }

        return jsonRpcResult(
          id,
          toolTextResult({
            instructions: RULES,
            designSystem: designSystem.name,
            framework,
            modes: result.modes,
          })
        );
      }

      case "get_accessibility_report": {
        const { data: checks } = await supabase
          .from("accessibility_checks")
          .select(
            "contrast_ratio, passes_aa_normal, passes_aa_large, passes_aaa_normal, passes_aaa_large, foreground:tokens!accessibility_checks_foreground_token_id_fkey(path), background:tokens!accessibility_checks_background_token_id_fkey(path), modes(name)"
          )
          .eq("design_system_id", designSystem.id);

        return jsonRpcResult(
          id,
          toolTextResult({
            instructions: RULES,
            checks: checks ?? [],
            failing: (checks ?? []).filter((c) => !c.passes_aa_normal),
          })
        );
      }

      case "get_component_spec":
        return jsonRpcResult(
          id,
          toolTextResult({
            supported: false,
            message:
              "Component-level token specs are not yet modeled by this design system platform. Use get_tokens for the raw design tokens instead.",
          })
        );

      case "get_brand_guidelines":
        return jsonRpcResult(
          id,
          toolTextResult({
            supported: false,
            message:
              "Free-form brand guideline text is not yet modeled by this design system platform. Use get_tokens for the raw design tokens instead.",
          })
        );

      default:
        return jsonRpcError(id, -32601, `Unknown tool: "${toolName}".`);
    }
  }

  return jsonRpcError(id, -32601, `Unknown method: "${method}".`);
});
