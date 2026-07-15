"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, getPriceId, TRIAL_PERIOD_DAYS } from "@/lib/stripe";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://tokn.host";
}

/**
 * Start the card-upfront 7-day trial: ensure the user has a Stripe customer,
 * then create a subscription Checkout Session (card required even during the
 * trial) and redirect to Stripe's hosted checkout. The webhook flips the
 * account to paid once the subscription exists.
 */
export async function startCheckout(): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const stripe = getStripe();
  const service = createServiceClient();

  // Reuse the profile's Stripe customer, or create + persist one so the webhook
  // can map subscription events back to this user by customer id.
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await service
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = await requestOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getPriceId(), quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS },
    // Require a card even though the trial is free, so it auto-charges at day 7.
    payment_method_collection: "always",
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${origin}/studio?billing=success`,
    cancel_url: `${origin}/studio?billing=cancel`,
  });

  if (!session.url) return { error: "Could not start checkout." };
  redirect(session.url);
}

/** Open the Stripe billing portal so the user can manage / cancel. */
export async function openBillingPortal(): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return { error: "You don't have a billing account yet." };
  }

  const origin = await requestOrigin();
  const portal = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/studio`,
  });
  redirect(portal.url);
}
