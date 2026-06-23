"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeAccessibilityChecks, type ColorTokenRef } from "@/lib/a11y";
import type { TablesInsert } from "@/types/supabase";

export type A11yResult =
  | { error: string }
  | { success: true; checkedCount: number; failingCount: number }
  | void;

function hexOf(value: unknown): string | null {
  if (value && typeof value === "object" && "hex" in value) {
    return String((value as { hex: unknown }).hex);
  }
  return null;
}

/**
 * Runs WCAG contrast checks for every foreground/background color pair,
 * independently per mode, and caches results in `accessibility_checks`.
 * See CLAUDE.md "Accessibility Check Logic" — deterministic math, run
 * after gap-fill, never computed at query time.
 */
export async function runAccessibilityChecks(designSystemId: string): Promise<A11yResult> {
  const supabase = await createClient();

  const { data: modes, error: modesError } = await supabase
    .from("modes")
    .select("id, name")
    .eq("design_system_id", designSystemId);
  if (modesError) return { error: modesError.message };
  if (!modes?.length) return { error: "No modes found for this design system." };

  const { data: colorTokens, error: tokensError } = await supabase
    .from("tokens")
    .select("id, path")
    .eq("design_system_id", designSystemId)
    .eq("category", "color")
    .eq("type", "color");
  if (tokensError) return { error: tokensError.message };
  if (!colorTokens?.length) {
    return { error: "No color tokens yet — import and gap-fill first." };
  }

  let checkedCount = 0;
  let failingCount = 0;

  for (const mode of modes) {
    const { data: values, error: valuesError } = await supabase
      .from("token_values")
      .select("token_id, value")
      .eq("mode_id", mode.id)
      .in(
        "token_id",
        colorTokens.map((t) => t.id)
      );
    if (valuesError) return { error: valuesError.message };

    const valueByTokenId = new Map(values.map((v) => [v.token_id, v.value]));
    const refs: ColorTokenRef[] = colorTokens
      .map((t) => {
        const hex = hexOf(valueByTokenId.get(t.id));
        return hex ? { id: t.id, path: t.path, hex } : null;
      })
      .filter((r): r is ColorTokenRef => r !== null);

    const plan = computeAccessibilityChecks(refs);
    if (plan.length === 0) continue;

    const rows: TablesInsert<"accessibility_checks">[] = plan.map((p) => ({
      design_system_id: designSystemId,
      foreground_token_id: p.foregroundTokenId,
      background_token_id: p.backgroundTokenId,
      mode_id: mode.id,
      contrast_ratio: Math.round(p.contrastRatio * 100) / 100,
      passes_aa_normal: p.passesAaNormal,
      passes_aa_large: p.passesAaLarge,
      passes_aaa_normal: p.passesAaaNormal,
      passes_aaa_large: p.passesAaaLarge,
    }));

    const { error: insertError } = await supabase
      .from("accessibility_checks")
      .upsert(rows, { onConflict: "foreground_token_id,background_token_id,mode_id" });
    if (insertError) return { error: insertError.message };

    checkedCount += plan.length;
    failingCount += plan.filter((p) => !p.passesAaNormal).length;
  }

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true, checkedCount, failingCount };
}
