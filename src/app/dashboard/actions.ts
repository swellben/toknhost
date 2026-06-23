"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | void;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "design-system"
  );
}

export async function createDesignSystem(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const baseSlug = slugify(name);
  // Append a short suffix if the slug is taken — slugs are globally unique.
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 5) {
    const { data: existing } = await supabase
      .from("design_systems")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await supabase
    .from("design_systems")
    .insert({ name, slug, user_id: user!.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect(`/dashboard/${data.id}`);
}

export type UpdateDesignSystemResult = { error: string } | { success: true } | void;

export async function updateDesignSystem(
  designSystemId: string,
  _prevState: UpdateDesignSystemResult,
  formData: FormData
): Promise<UpdateDesignSystemResult> {
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required." };
  const description = (formData.get("description") as string)?.trim() || null;
  const isPublic = formData.get("isPublic") === "on";
  const targetFramework = (formData.get("targetFramework") as string) || "css-variables";

  const { error } = await supabase
    .from("design_systems")
    .update({ name, description, is_public: isPublic, target_framework: targetFramework })
    .eq("id", designSystemId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${designSystemId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteDesignSystem(designSystemId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // RLS (owner_all_design_systems) scopes this to the caller's own rows;
  // modes/tokens/token_values/accessibility_checks cascade-delete per the
  // FKs in 001_initial_schema.sql.
  const { error } = await supabase
    .from("design_systems")
    .delete()
    .eq("id", designSystemId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
}
