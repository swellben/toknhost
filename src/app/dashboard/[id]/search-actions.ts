"use server";

import { createClient } from "@/lib/supabase/server";
import { classifyToken } from "@/lib/token-classification";

export interface TokenSearchResult {
  path: string;
  category: string;
  tab: "primitives" | "colors" | "tokens" | "typography";
}

/** Powers the top-nav token search — scoped to one design system, since
 * there's no cross-system token browsing UI (yet) for results to land on. */
export async function searchTokens(
  designSystemId: string,
  query: string
): Promise<TokenSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tokens")
    .select("path, category")
    .eq("design_system_id", designSystemId)
    .ilike("path", `%${q}%`)
    .order("path")
    .limit(20);

  if (error || !data) return [];

  return data.map((t) => ({
    path: t.path,
    category: t.category,
    tab: classifyToken(t.category, t.path),
  }));
}
