// ShiftSync Pro · Stripe Webhook Handler
// Verarbeitet: checkout.session.completed, invoice.paid,
//              invoice.payment_failed, customer.subscription.deleted

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";
import { corsHeaders } from "../_shared/cors.ts";

// Tarif-Mapping: Stripe Price-ID → ShiftSync Plan-Key
// In .env als STRIPE_PRICE_IDS='{"starter":"price_xxx","pro":"price_yyy","business":"price_zzz"}'
const getPriceMap = (): Record<string, string> => {
  try { return JSON.parse(Deno.env.get("STRIPE_PRICE_IDS") || "{}"); }
  catch { return {}; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !secret) return new Response("Unauthorized", { status: 401 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    return new Response(`Webhook Error: ${e.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const priceMap = getPriceMap(); // { plan_key: price_id }
  // Invertieren: price_id → plan_key
  const priceToplan: Record<string, string> = {};
  Object.entries(priceMap).forEach(([plan, priceId]) => { priceToplan[priceId as string] = plan; });

  const obj = event.data.object as Stripe.Subscription & Stripe.Checkout.Session & Stripe.Invoice;

  switch (event.type) {
    // ── Checkout abgeschlossen → Abo verknüpfen + aktivieren ───────
    case "checkout.session.completed": {
      const session = obj as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      if (!orgId) break;
      const plan = priceToplan[session.metadata?.price_id || ""] || "starter";
      await supabase.from("orgs").update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan,
        status: "active",
        trial_ends: null,
      }).eq("id", orgId);
      break;
    }

    // ── Rechnung bezahlt → aktiv halten ────────────────────────────
    case "invoice.paid": {
      const invoice = obj as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const priceId = invoice.lines?.data?.[0]?.price?.id;
      const plan = priceId ? (priceToplan[priceId] || "starter") : undefined;
      const update: Record<string, unknown> = { status: "active" };
      if (plan) update.plan = plan;
      await supabase.from("orgs").update(update).eq("stripe_customer_id", customerId);
      break;
    }

    // ── Zahlung fehlgeschlagen → sperren (soft) ────────────────────
    case "invoice.payment_failed": {
      const invoice = obj as Stripe.Invoice;
      const attempt = (invoice as any).attempt_count || 1;
      const customerId = invoice.customer as string;
      // Erst ab 3. Fehlversuch sperren (Dunning-Grace-Period)
      if (attempt >= 3) {
        await supabase.from("orgs").update({ status: "suspended" })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }

    // ── Abo gekündigt → auf free downgraden ────────────────────────
    case "customer.subscription.deleted": {
      const sub = obj as Stripe.Subscription;
      const customerId = sub.customer as string;
      await supabase.from("orgs").update({ status: "active", plan: "free" })
        .eq("stripe_customer_id", customerId);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
