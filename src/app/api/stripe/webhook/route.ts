import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Stripe's signature verification needs the raw body + Node crypto.
export const runtime = "nodejs";

function idOf(
  ref: string | { id: string } | null | undefined
): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new NextResponse("Missing webhook secret or signature.", {
      status: 400,
    });
  }

  const stripe = getStripe();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[stripe-webhook] signature verification failed:", message);
    return new NextResponse(`Invalid signature: ${message}`, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // First sync after a successful checkout — map the customer +
        // subscription onto the user (by client_reference_id) and record status.
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = idOf(session.customer);
        const subscriptionId = idOf(session.subscription);
        if (!userId || !customerId) break;

        let status: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
        }
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: status,
          })
          .eq("id", userId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Keep the profile's status in sync for the whole lifecycle
        // (trialing → active → past_due/canceled). Matched by customer id,
        // which was persisted when the customer was created at checkout.
        const sub = event.data.object;
        const customerId = idOf(sub.customer);
        if (!customerId) break;
        await supabase
          .from("profiles")
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(
      `[stripe-webhook] handler error for ${event.type}:`,
      message
    );
    return new NextResponse(`Webhook handler error: ${message}`, {
      status: 500,
    });
  }

  return NextResponse.json({ received: true });
}
