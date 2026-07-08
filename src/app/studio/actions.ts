"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ThemeConfig } from "@/lib/studio/theme";
import { translateThemeToRows } from "@/lib/studio/translate";
import {
  serializeConfig,
  deserializeConfig,
  type StudioDesignSystem,
} from "@/lib/studio/persist";
import type { Json, TablesInsert, Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// studio_config is plain JSON-serializable data; the DB column is jsonb.
function toJson(value: unknown): Json {
  return value as unknown as Json;
}

/**
 * Translate the current editor state into the normalized alias-aware token rows
 * the hosted MCP reads (`tokens`/`token_values`/`modes`), and upsert them. Runs
 * on every create/save so the MCP output tracks the studio. The token set is
 * fixed, so this is pure upsert — no orphan cleanup needed. See
 * `src/lib/studio/translate.ts`.
 */
async function writeThemeRows(
  supabase: SupabaseClient<Database>,
  designSystemId: string,
  config: ThemeConfig
): Promise<{ error: string } | { ok: true }> {
  const { tokens, values } = translateThemeToRows(config);

  // Ensure both modes exist. A DB trigger creates the "light" default mode on
  // design-system insert; "dark" is not auto-created, so add it here. Both are
  // handled defensively so this is safe on create and re-save alike.
  const { data: existingModes, error: modesError } = await supabase
    .from("modes")
    .select("id, name")
    .eq("design_system_id", designSystemId);
  if (modesError) return { error: modesError.message };

  const modeIdByName = new Map((existingModes ?? []).map((m) => [m.name, m.id]));
  const ensureMode = async (name: "light" | "dark") => {
    const existing = modeIdByName.get(name);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("modes")
      .insert({
        design_system_id: designSystemId,
        name,
        is_default: name === "light",
        sort_order: name === "light" ? 0 : 1,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? `Could not create ${name} mode.`);
    modeIdByName.set(name, data.id);
    return data.id;
  };

  try {
    await ensureMode("light");
    await ensureMode("dark");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not set up modes." };
  }

  // Upsert token identities, then map path -> id for the value rows.
  const tokenRows: TablesInsert<"tokens">[] = tokens.map((t) => ({
    design_system_id: designSystemId,
    path: t.path,
    category: t.category,
    type: t.type,
    provenance: "derived",
  }));
  const { data: insertedTokens, error: tokenError } = await supabase
    .from("tokens")
    .upsert(tokenRows, { onConflict: "design_system_id,path" })
    .select("id, path");
  if (tokenError) return { error: tokenError.message };
  const idByPath = new Map(insertedTokens.map((t) => [t.path, t.id]));

  const valueRows: TablesInsert<"token_values">[] = [];
  for (const v of values) {
    const tokenId = idByPath.get(v.path);
    const modeId = modeIdByName.get(v.mode);
    if (!tokenId || !modeId) continue;
    valueRows.push({
      token_id: tokenId,
      mode_id: modeId,
      value: v.isAlias ? null : (v.value as Json),
      is_alias: v.isAlias,
      alias_path: v.aliasPath,
      raw_value: null,
    });
  }
  const { error: valueError } = await supabase
    .from("token_values")
    .upsert(valueRows, { onConflict: "token_id,mode_id" });
  if (valueError) return { error: valueError.message };

  return { ok: true };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "theme"
  );
}

/** A unique slug for a new design system (slugs are globally unique). */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string
): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("design_systems")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

/** The caller's design systems, most-recently-updated first (RLS-scoped). */
export async function listStudioDesignSystems(): Promise<StudioDesignSystem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("design_systems")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    updatedAt: d.updated_at,
  }));
}

/** Load one design system's editor recipe. */
export async function getStudioConfig(
  id: string
): Promise<{ name: string; config: ThemeConfig } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("design_systems")
    .select("name, studio_config")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Design system not found." };
  return { name: data.name, config: deserializeConfig(data.studio_config) };
}

/** Create a new design system from the current editor state. */
export async function createStudioDesignSystem(
  name: string,
  config: ThemeConfig
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in to save." };

  const trimmed = name.trim() || "Untitled theme";
  const slug = await uniqueSlug(supabase, trimmed);

  const { data, error } = await supabase
    .from("design_systems")
    .insert({
      name: trimmed,
      slug,
      user_id: user.id,
      target_framework: "tailwind-v4",
      studio_config: toJson(serializeConfig(config)),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Write the MCP-servable token rows for the new design system.
  const rows = await writeThemeRows(supabase, data.id, config);
  if ("error" in rows) return { error: rows.error };

  revalidatePath("/studio");
  return { id: data.id };
}

/** Save the current editor state back onto an existing design system. */
export async function saveStudioConfig(
  id: string,
  name: string,
  config: ThemeConfig
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("design_systems")
    .update({
      name: name.trim() || "Untitled theme",
      studio_config: toJson(serializeConfig(config)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Keep the MCP-servable token rows in sync with the saved editor state.
  const rows = await writeThemeRows(supabase, id, config);
  if ("error" in rows) return { error: rows.error };

  revalidatePath("/studio");
  return { success: true };
}

/** Delete a design system (RLS-scoped; tokens/modes cascade per the FKs). */
export async function deleteStudioDesignSystem(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("design_systems").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/studio");
  return { success: true };
}
