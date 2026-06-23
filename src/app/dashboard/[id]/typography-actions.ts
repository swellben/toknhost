"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fontFallback, googleFontsUrl } from "@/lib/google-fonts";
import type { Json, TablesInsert } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type TypographyActionResult = { error: string } | { success: true } | void;

/** Typography tokens apply the same across every mode (light/dark don't
 * usually have different fonts or scales) — but schema-design.md's "no
 * global token value" rule means we still need one token_values row per
 * mode, so we write the same value into all of them. */
async function writeAcrossAllModes(
  supabase: SupabaseClient<Database>,
  designSystemId: string,
  tokenId: string,
  value: Json
): Promise<{ error: string } | void> {
  const { data: modes, error: modesError } = await supabase
    .from("modes")
    .select("id")
    .eq("design_system_id", designSystemId);

  if (modesError || !modes?.length) return { error: "Could not load modes for this design system." };

  const rows: TablesInsert<"token_values">[] = modes.map((m) => ({
    token_id: tokenId,
    mode_id: m.id,
    value,
    is_alias: false,
  }));

  const { error } = await supabase.from("token_values").upsert(rows, { onConflict: "token_id,mode_id" });
  if (error) return { error: error.message };
}

export async function setFontFamily(
  designSystemId: string,
  _prevState: TypographyActionResult,
  formData: FormData
): Promise<TypographyActionResult> {
  const source = formData.get("source") as string;
  const supabase = await createClient();

  let primary: string;
  let stack: string[];
  let fontUrl: string | null;

  if (source === "custom") {
    primary = (formData.get("customName") as string)?.trim();
    const url = (formData.get("customUrl") as string)?.trim();
    if (!primary || !url) return { error: "Custom fonts need both a name and a file URL." };
    stack = [primary, "sans-serif"];
    fontUrl = url;
  } else {
    primary = (formData.get("fontName") as string)?.trim();
    if (!primary) return { error: "Pick a font." };
    stack = [primary, fontFallback(primary)];
    fontUrl = googleFontsUrl(primary);
  }

  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .upsert(
      {
        design_system_id: designSystemId,
        path: "font-family.base",
        category: "font-family",
        type: "fontFamily",
        provenance: "imported",
        code_syntax: { web: fontUrl } as Json,
      },
      { onConflict: "design_system_id,path" }
    )
    .select("id")
    .single();

  if (tokenError) return { error: tokenError.message };

  const result = await writeAcrossAllModes(supabase, designSystemId, token.id, {
    stack,
    primary,
  } as Json);
  if (result && "error" in result) return result;

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true };
}

const SCALE_STEPS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"] as const;
const SCALE_EXPONENTS: Record<(typeof SCALE_STEPS)[number], number> = {
  xs: -2,
  sm: -1,
  base: 0,
  lg: 1,
  xl: 2,
  "2xl": 3,
  "3xl": 4,
};

export async function setTypeScale(
  designSystemId: string,
  _prevState: TypographyActionResult,
  formData: FormData
): Promise<TypographyActionResult> {
  const baseSize = Number(formData.get("baseSize"));
  const ratio = Number(formData.get("ratio"));

  if (!baseSize || baseSize <= 0) return { error: "Base size must be a positive number." };
  if (!ratio || ratio <= 1) return { error: "Ratio must be greater than 1." };

  const supabase = await createClient();

  for (const step of SCALE_STEPS) {
    const px = Math.round(baseSize * ratio ** SCALE_EXPONENTS[step]);
    const path = `font-size.${step}`;

    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .upsert(
        {
          design_system_id: designSystemId,
          path,
          category: "font-size",
          type: "dimension",
          provenance: "imported",
        },
        { onConflict: "design_system_id,path" }
      )
      .select("id")
      .single();

    if (tokenError) return { error: tokenError.message };

    const result = await writeAcrossAllModes(supabase, designSystemId, token.id, {
      value: px,
      unit: "px",
    } as Json);
    if (result && "error" in result) return result;
  }

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true };
}
