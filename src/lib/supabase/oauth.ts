"use client";

import { createClient } from "@/lib/supabase/client";

/** OAuth providers we surface. Each must also be enabled + configured in the
 * Supabase dashboard (provider OAuth app credentials + redirect URLs). */
export type OAuthProvider = "google" | "github";

export const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
];

/**
 * Start an OAuth sign-in redirect. On success the provider redirects back to
 * /auth/callback, which exchanges the code and forwards to `next`.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
  next = "/studio"
): Promise<{ error?: string }> {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  return error ? { error: error.message } : {};
}
