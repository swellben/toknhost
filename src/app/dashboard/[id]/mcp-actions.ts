"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RegenerateTokenResult = { error: string } | { token: string } | void;

/**
 * Rotates the bearer token an AI agent uses to authenticate to this
 * design system's MCP server when it's private (see supabase/functions/
 * design-system-mcp). Calls a SECURITY INVOKER Postgres function since
 * Supabase JS can't compute gen_random_bytes() client-side — the
 * function's UPDATE still runs under the caller's RLS, so only the owner
 * can actually rotate it.
 */
export async function regenerateMcpToken(designSystemId: string): Promise<RegenerateTokenResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("regenerate_mcp_token", {
    p_design_system_id: designSystemId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${designSystemId}`);
  return { token: data as string };
}
