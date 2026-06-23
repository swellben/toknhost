"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  cssColorToValue,
  numberValue,
  parseDimensionPx,
  stringValue,
} from "@/lib/parsers/shared";
import type { TokenType, TokenValueShape } from "@/types/tokens";
import type { Json } from "@/types/supabase";

export type UpdateTokenResult = { error: string } | { success: true } | void;

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
