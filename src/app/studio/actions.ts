"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ThemeConfig } from "@/lib/studio/theme";
import {
  serializeConfig,
  deserializeConfig,
  type StudioDesignSystem,
} from "@/lib/studio/persist";
import type { Json } from "@/types/supabase";

// studio_config is plain JSON-serializable data; the DB column is jsonb.
function toJson(value: unknown): Json {
  return value as unknown as Json;
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
