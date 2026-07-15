import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Service-role Supabase client for trusted, non-user-scoped server writes — the
 * Stripe billing webhook and the checkout customer bootstrap. This BYPASSES RLS
 * (profiles has no user UPDATE policy), so only ever import it in server code
 * that isn't reachable by the client. Reads SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role credentials are not set.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
