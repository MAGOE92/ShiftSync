// ShiftSync Pro · Login Edge Function
// POST { code, lid, pin } → { token, emp, org } | { error }
//
// Verwendet bcrypt für PIN-Vergleich (nie Klartext im JWT).
// Gibt ein signiertes JWT mit { org_id, emp_id, role, is_super } zurück.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPER_ADMIN_CODE = "ADMIN";
const SUPER_ADMIN_LID = "superadmin";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, lid, pin } = await req.json() as {
      code: string; lid: string; pin: string;
    };

    if (!code || !lid || !pin) {
      return err("Fehlende Eingaben", 400);
    }

    const trimCode = code.trim().toUpperCase();
    const trimLid = lid.trim().toLowerCase();
    const trimPin = pin.trim();

    // ── Super-Admin ───────────────────────────────────────────────
    if (trimCode === SUPER_ADMIN_CODE && trimLid === SUPER_ADMIN_LID) {
      const superPw = Deno.env.get("SUPER_ADMIN_PW") || "";
      if (!superPw || trimPin !== superPw) return err("Super-Admin PIN falsch", 401);
      const token = await signJwt({ is_super: true, role: "superadmin" });
      return ok({ token, emp: { role: "superadmin" }, org: null });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Betrieb suchen ────────────────────────────────────────────
    const { data: org } = await supabase
      .from("orgs")
      .select("id, code, name, sub, status, plan, trial_ends")
      .eq("code", trimCode)
      .single();

    if (!org) return err("Betriebs-ID nicht gefunden", 404);

    // Status-Prüfung (suspended/archived vor Login)
    if (org.status === "suspended") return err("Betrieb gesperrt – bitte Anbieter kontaktieren", 403);
    if (org.status === "archived") {
      // Inhaber darf trotzdem rein (wird nach Employee-Check geprüft)
    }
    if (org.status === "trial" && org.trial_ends && new Date(org.trial_ends) < new Date()) {
      return err("Testzeitraum abgelaufen", 403);
    }

    // ── Mitarbeiter suchen ────────────────────────────────────────
    const { data: emp } = await supabase
      .from("employees")
      .select("id, name, lid, pin_hash, role, work_pct, pref, in_plan, linked_orgs")
      .eq("org_id", org.id)
      .eq("lid", trimLid)
      .single();

    if (!emp) return err(`Login-ID „${trimLid}" existiert in diesem Betrieb nicht`, 404);

    // Archived: nur Inhaber darf rein
    if (org.status === "archived" && emp.role !== "owner") {
      return err("Dieser Betrieb ist offline gestellt", 403);
    }

    // PIN prüfen: bcrypt → Fallback Klartext (Migration alter Daten)
    const pinOk = emp.pin_hash.startsWith("$2")
      ? await bcrypt.compare(trimPin, emp.pin_hash)
      : String(emp.pin_hash).trim() === trimPin;

    if (!pinOk) return err(`PIN falsch für ${emp.name}`, 401);

    // ── JWT ausstellen ────────────────────────────────────────────
    const token = await signJwt({
      org_id: org.id,
      emp_id: emp.id,
      role: emp.role,
      is_super: false,
    });

    return ok({
      token,
      emp: {
        id: emp.id,
        name: emp.name,
        lid: emp.lid,
        role: emp.role,
        workPct: emp.work_pct,
        pref: emp.pref,
        inPlan: emp.in_plan,
        linkedOrgs: emp.linked_orgs || [],
        // Pin NICHT zurückgeben — Frontend nutzt JWT für Auth
      },
      org: {
        id: org.id,
        code: org.code,
        name: org.name,
        sub: org.sub,
        status: org.status,
        plan: org.plan,
      },
    });
  } catch (e) {
    console.error("login error:", e);
    return err("Interner Fehler", 500);
  }
});

async function signJwt(payload: Record<string, unknown>) {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET nicht gesetzt");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return create({ alg: "HS256", typ: "JWT" }, {
    ...payload,
    exp: getNumericDate(60 * 60 * 8), // 8 Stunden
    iat: getNumericDate(0),
  }, key);
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
