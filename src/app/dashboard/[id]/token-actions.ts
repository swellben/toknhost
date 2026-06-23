"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  cssColorToValue,
  numberValue,
  parseDimensionPx,
  stringValue,
} from "@/lib/parsers/shared";
import { materialColorScale } from "@/lib/gap-fill/material";
import { aestheticForeground, hexToOklch, toOklchString } from "@/lib/gap-fill/oklch";
import type { TokenType, TokenValueShape } from "@/types/tokens";
import type { Json } from "@/types/supabase";

export type UpdateTokenResult = { error: string } | { success: true } | void;

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

function colorValue(hex: string): TokenValueShape {
  const { l, c, h } = hexToOklch(hex);
  return { hex, oklch: toOklchString(l, c, h), space: "oklch" };
}

/**
 * Regenerates a base color's 50–950 scale + foreground in the SAME mode
 * that was just edited, if a scale already exists for it. Fixes a real bug:
 * editing color.primary's swatch previously left color.primary.50..950
 * silently stale (wrong hue entirely), since nothing recomputed the scale
 * from the new seed — found live on master-reference, where the scale was
 * still blue after the base was edited to green days earlier.
 *
 * Deliberately scoped to the SAME mode only — does not touch the other
 * mode's scale, since cross-mode propagation is a separate, bigger design
 * decision (would risk clobbering an intentionally-customized dark mode)
 * that hasn't been asked for. This only fixes the proven same-mode drift.
 */
async function regenerateScaleIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  designSystemId: string,
  editedPath: string,
  editedCategory: string,
  editedType: string,
  modeId: string,
  newHex: string
): Promise<{ error: string } | void> {
  if (editedCategory !== "color" || editedType !== "color") return;
  // Only base colors get regenerated — a path ending in a scale-step suffix
  // or "foreground" IS a scale member, not a base; editing one shouldn't
  // regenerate anything.
  if (/\.(50|100|200|300|400|500|600|700|800|900|950|foreground)$/.test(editedPath)) return;

  const scalePaths = SCALE_STEPS.map((step) => `${editedPath}.${step}`);
  const foregroundPath = `${editedPath}.foreground`;

  const { data: scaleTokens, error: scaleError } = await supabase
    .from("tokens")
    .select("id, path")
    .eq("design_system_id", designSystemId)
    .in("path", [...scalePaths, foregroundPath]);
  if (scaleError) return { error: scaleError.message };
  if (!scaleTokens?.length) return; // no existing scale — nothing to keep in sync

  const scale = materialColorScale(newHex);
  const foregroundHex = aestheticForeground(newHex);

  const rows = scaleTokens.map((t) => {
    const stepMatch = t.path.match(/\.(\d+)$/);
    const hex = stepMatch ? scale[Number(stepMatch[1])] : foregroundHex;
    return {
      token_id: t.id,
      mode_id: modeId,
      value: colorValue(hex) as unknown as Json,
      is_alias: false,
    };
  });

  const { error: upsertError } = await supabase
    .from("token_values")
    .upsert(rows, { onConflict: "token_id,mode_id" });
  if (upsertError) return { error: upsertError.message };
}

/** Parses whatever the editor's input produced back into our canonical
 * JSONB value shape, based on the token's type. Mirrors the parsing
 * logic in src/lib/parsers/* — same rules, just one token at a time. */
function buildValue(type: TokenType, raw: string): TokenValueShape | null {
  switch (type) {
    case "color":
      return cssColorToValue(raw);
    case "dimension":
      return parseDimensionPx(raw);
    case "fontWeight":
    case "number":
      return numberValue(raw);
    case "string":
    case "boolean":
      return stringValue(raw);
    default:
      // Composite types (shadow/border/transition/typography) aren't
      // editable as a single text field yet — reject rather than corrupt.
      return null;
  }
}

/**
 * Edits a single token's value for one mode. Always sets provenance to
 * "imported" — a manual edit is, by definition, no longer just a derived
 * or defaulted guess; it's now the user's explicit decision.
 */
export async function updateTokenValue(
  designSystemId: string,
  tokenId: string,
  modeId: string,
  type: TokenType,
  rawValue: string
): Promise<UpdateTokenResult> {
  const value = buildValue(type, rawValue);
  if (value === null) {
    return { error: `"${rawValue}" isn't a valid ${type} value.` };
  }

  const supabase = await createClient();

  const { data: tokenRow, error: tokenLookupError } = await supabase
    .from("tokens")
    .select("path, category")
    .eq("id", tokenId)
    .single();
  if (tokenLookupError) return { error: tokenLookupError.message };

  const { error: valueError } = await supabase
    .from("token_values")
    .upsert(
      {
        token_id: tokenId,
        mode_id: modeId,
        value: value as Json,
        is_alias: false,
        alias_path: null,
        raw_value: rawValue,
      },
      { onConflict: "token_id,mode_id" }
    );

  if (valueError) return { error: valueError.message };

  const { error: tokenError } = await supabase
    .from("tokens")
    .update({ provenance: "imported" })
    .eq("id", tokenId);

  if (tokenError) return { error: tokenError.message };

  const newHex = (value as { hex?: string }).hex;
  if (newHex) {
    const scaleResult = await regenerateScaleIfNeeded(
      supabase,
      designSystemId,
      tokenRow.path,
      tokenRow.category,
      type,
      modeId,
      newHex
    );
    if (scaleResult && "error" in scaleResult) return scaleResult;
  }

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true };
}

export type DeleteTokenResult = { error: string } | void;

/** Deletes a token entirely (cascades to its values across every mode
 * and any accessibility_checks referencing it — see 001_initial_schema.sql
 * ON DELETE CASCADE). */
export async function deleteToken(
  designSystemId: string,
  tokenId: string
): Promise<DeleteTokenResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("tokens").delete().eq("id", tokenId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${designSystemId}`);
}
