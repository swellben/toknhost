"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plan";

/**
 * The live MCP endpoint + direct-fetch details for a saved design system,
 * ready to render in the studio's MCP handoff panel. Shaped as a discriminated
 * union so the panel can render each state without prop-drilling nulls:
 *
 *  - `ok`       — the caller owns this system and may extract it via MCP.
 *  - `locked`   — the caller owns it, but their plan/trial doesn't include MCP
 *                 (drives the upgrade prompt; the endpoint stays hidden).
 *  - `error`    — not found / not owned (RLS) or a lookup failure.
 */
export type StudioMcpAccess =
  | {
      status: "ok";
      endpointUrl: string;
      isPublic: boolean;
      mcpToken: string;
      defaultFramework: string;
      modeNames: string[];
    }
  | { status: "locked" }
  | { status: "error"; message: string };

/**
 * Resolve the MCP handoff details for a saved studio design system. Gated on
 * `getEntitlements().canUseMcp` (see FREEMIUM-GATING-PLAN.md): the endpoint and
 * bearer token are only returned to entitled callers, so a free/expired-trial
 * user gets `locked` instead of a working URL. RLS scopes the row to its owner,
 * so a non-owner id resolves to `error`.
 */
export async function getStudioMcpAccess(
  designSystemId: string
): Promise<StudioMcpAccess> {
  const entitlements = await getEntitlements();
  if (!entitlements.canUseMcp) {
    return { status: "locked" };
  }

  const supabase = await createClient();
  const [{ data: ds, error: dsError }, { data: modes }] = await Promise.all([
    supabase
      .from("design_systems")
      .select("slug, is_public, mcp_token, target_framework")
      .eq("id", designSystemId)
      .maybeSingle(),
    supabase
      .from("modes")
      .select("name")
      .eq("design_system_id", designSystemId)
      .order("sort_order"),
  ]);

  if (dsError) return { status: "error", message: dsError.message };
  if (!ds) return { status: "error", message: "Design system not found." };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    return { status: "error", message: "MCP endpoint is not configured." };
  }

  return {
    status: "ok",
    endpointUrl: `${base}/functions/v1/design-system-mcp/${ds.slug}`,
    isPublic: ds.is_public,
    mcpToken: ds.mcp_token,
    defaultFramework: ds.target_framework,
    modeNames: (modes ?? []).map((m) => m.name),
  };
}

/**
 * Rotate the bearer token an AI agent uses to authenticate to this design
 * system's private MCP server. Delegates to the `regenerate_mcp_token` Postgres
 * function (SECURITY INVOKER — the UPDATE still runs under the caller's RLS, so
 * only the owner can rotate). Studio-native twin of the dashboard's
 * `regenerateMcpToken`, revalidating `/studio` instead of the dashboard route.
 */
export async function regenerateStudioMcpToken(
  designSystemId: string
): Promise<{ error: string } | { token: string }> {
  const entitlements = await getEntitlements();
  if (!entitlements.canUseMcp) {
    return { error: "Your plan doesn't include MCP access." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_mcp_token", {
    p_design_system_id: designSystemId,
  });
  if (error) return { error: error.message };

  revalidatePath("/studio");
  return { token: data as string };
}
