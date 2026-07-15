import Stripe from "stripe";

// Server-only Stripe client, lazily constructed so importing this module during
// a build without STRIPE_SECRET_KEY doesn't throw — it's only instantiated when
// a checkout/webhook/portal request actually runs. Uses the SDK's pinned API
// version (currently 2026-06-24.dahlia).
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key);
  }
  return client;
}

/** The recurring price the "ToknHost Pro" subscription checks out against. */
export function getPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID is not set.");
  return priceId;
}

/** Days of free trial granted on the card-upfront subscription. */
export const TRIAL_PERIOD_DAYS = 7;
