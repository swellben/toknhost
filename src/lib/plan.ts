import { createClient } from "@/lib/supabase/server";

// Central access model for the gating. See FREEMIUM-GATING-PLAN.md ("Access
// model v2"). The studio requires a free account; the gates here govern the
// value-extraction actions (export, MCP) and how many themes a user may keep.
// "Paid" is driven by the Stripe subscription (trialing/active), synced onto the
// profile by the billing webhook — never by a client-supplied value.

export type Plan = "free" | "paid";

// Stripe subscription statuses that grant premium access. A card-upfront trial
// is `trialing`; a paid subscription is `active`. Everything else (past_due,
// canceled, unpaid, incomplete, …) is treated as free.
const PAID_STATUSES = new Set(["trialing", "active"]);

export type Entitlements = {
  /** Whether there's a signed-in user at all. */
  authenticated: boolean;
  /** The stored billing plan on the profile (manual override; usually 'free'). */
  plan: Plan;
  /** Raw Stripe subscription status, or null if never subscribed/anonymous. */
  subscriptionStatus: string | null;
  /** paid if plan is 'paid' OR the Stripe subscription is trialing/active. */
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
  subscriptionStatus: null,
  effectivePlan: "free",
  canSave: false,
  canExport: false,
  canUseMcp: false,
  maxDesignSystems: 0,
};

/**
 * Resolves the current request's entitlements from the signed-in user's
 * profile. Anonymous callers get the locked-down set. Call this from server
 * actions and server components that gate premium features; never trust a
 * client-supplied plan.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return ANONYMOUS;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  const plan: Plan = profile?.plan === "paid" ? "paid" : "free";
  const subscriptionStatus = profile?.subscription_status ?? null;
  const subscribed =
    subscriptionStatus !== null && PAID_STATUSES.has(subscriptionStatus);
  const effectivePlan: Plan = plan === "paid" || subscribed ? "paid" : "free";
  const premium = effectivePlan === "paid";

  return {
    authenticated: true,
    plan,
    subscriptionStatus,
    effectivePlan,
    canSave: true,
    canExport: premium,
    canUseMcp: premium,
    maxDesignSystems: premium
      ? PAID_MAX_DESIGN_SYSTEMS
      : FREE_MAX_DESIGN_SYSTEMS,
  };
}
