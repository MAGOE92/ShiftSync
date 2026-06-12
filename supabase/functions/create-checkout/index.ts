// ShiftSync Pro · Stripe Checkout Session erstellen
// POST { org_id, plan, success_url, cancel_url } → { url }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, plan, success_url, cancel_url } = await req.json();

    const priceMap: Record<string, string> = JSON.parse(
      Deno.env.get("STRIPE_PRICE_IDS") || "{}"
    );
    const priceId = priceMap[plan];
    if (!priceId) return err(`Kein Preis für Plan "${plan}"`, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: org } = await supabase.from("orgs")
      .select("id, name, stripe_customer_id").eq("id", org_id).single();
    if (!org) return err("Betrieb nicht gefunden", 404);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Bestehenden Customer wiederverwenden oder neuen anlegen
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, metadata: { org_id } });
      customerId = customer.id;
      await supabase.from("orgs").update({ stripe_customer_id: customerId }).eq("id", org_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || `${Deno.env.get("APP_URL")}/`,
      cancel_url: cancel_url || `${Deno.env.get("APP_URL")}/`,
      metadata: { org_id, price_id: priceId },
      subscription_data: { metadata: { org_id } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err(e.message, 500);
  }
});

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
