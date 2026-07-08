import { createClient } from "@/lib/supabase/server";

// Central access model for the freemium/reverse-trial gating.
// See FREEMIUM-GATING-PLAN.md. The studio itself is free + anonymous; the gates
// here govern the value-extraction actions (save, export, MCP) and how many
// design systems a user may keep.

export type Plan = "free" | "paid";

export type Entitlements = {
  /** Whether there's a signed-in user at all. */
  authenticated: boolean;
  /** The stored billing plan on the profile. */
  plan: Plan;
  /** True while the 14-day reverse trial is still active. */
  inTrial: boolean;
  /** ISO timestamp the trial ends, or null if none/anonymous. */
  trialEndsAt: string | null;
  /** paid if the plan is paid OR the trial is still active. Drives the gates. */
  effectivePlan: Plan;
  /** Persist a design system to the account (any signed-in user). */
  canSave: boolean;
  /** Produce a take-away artifact — file download or bulk copy. Premium only. */
  canExport: boolean;
  /** Access the hosted MCP endpoint. Premium only. */
  canUseMcp: boolean;
  /** How many design systems the user may keep. */
  maxDesignSystems: number;
};

const FREE_MAX_DESIGN_SYSTEMS = 1;
const PAID_MAX_DESIGN_SYSTEMS = Number.POSITIVE_INFINITY;

const ANONYMOUS: Entitlements = {
  authenticated: false,
  plan: "free",
  inTrial: false,
  trialEndsAt: null,
  effectivePlan: "free",
  canSave: false,
  canExport: false,
  canUseMcp: false,
  maxDesignSystems: 0,
};

/**
 * Resolves the current request's entitlements from the signed-in user's
 * profile. Anonymous users get the locked-down anonymous set (studio only —
 * no save/export/MCP). Call this from server actions and server components that
 * gate premium features; never trust a client-supplied plan.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return ANONYMOUS;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at")
    .eq("id", userId)
    .maybeSingle();

  const plan: Plan = profile?.plan === "paid" ? "paid" : "free";
  const trialEndsAt = profile?.trial_ends_at ?? null;
  const inTrial =
    trialEndsAt !== null && new Date(trialEndsAt).getTime() > Date.now();
  const effectivePlan: Plan = plan === "paid" || inTrial ? "paid" : "free";
  const premium = effectivePlan === "paid";

  return {
    authenticated: true,
    plan,
    inTrial,
    trialEndsAt,
    effectivePlan,
    canSave: true,
    canExport: premium,
    canUseMcp: premium,
    maxDesignSystems: premium
      ? PAID_MAX_DESIGN_SYSTEMS
      : FREE_MAX_DESIGN_SYSTEMS,
  };
}
