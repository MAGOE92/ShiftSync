// ============================================================
// ShiftSync Pro · API-Gateway (einziges Tor zur Datenbank)
// ============================================================
// Alle Clients sprechen NUR mit dieser Funktion. Sie läuft mit
// service_role (umgeht RLS) und erzwingt selbst:
//   - Authentifizierung (PIN → PBKDF2-Hash, HMAC-Session-Token)
//   - Mandantentrennung (Token ist auf einen Betrieb gescoped)
//   - Feld-Whitelists (kein Selbst-Upgrade von Tarif/Status)
// PINs verlassen den Server nie; get() liefert Mitarbeiter ohne PIN.
//
// POST { action, ...payload }, Authorization: Bearer <session-token>
// Actions: login, setup, me, get, set, chpin, link_org, unlink_org, switch_org,
//          register_push, unregister_push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPER_ADMIN_CODE = "ADMIN";
const SUPER_ADMIN_LID = "superadmin";
const TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30 Tage — PWA-Nutzer bleiben eingeloggt

// Standard-Schichten & Rechte für neue Betriebe (Spiegel von src/theme/constants.js)
const DEFAULT_SHIFTS = [
  { key: "F", label: "Früh", start: "06:00", end: "14:00", required: 2, colorIdx: 0 },
  { key: "S", label: "Spät", start: "14:00", end: "22:00", required: 2, colorIdx: 1 },
  { key: "N", label: "Nacht", start: "22:00", end: "06:00", required: 1, colorIdx: 2 },
];
const PERM_KEYS = ["createPlan", "approveVac", "approveSick", "approveSwap", "manageStaff", "absEntry", "resetPins", "manageShifts", "manageOrg"];
const allPerms = (v: boolean) => Object.fromEntries(PERM_KEYS.map(k => [k, v]));
const DEFAULT_PERMS = {
  owner: allPerms(true),
  director: { createPlan: true, approveVac: true, approveSick: true, approveSwap: true, manageStaff: true, absEntry: true, resetPins: true, manageShifts: false, manageOrg: false },
  manager: { createPlan: true, approveVac: false, approveSick: true, approveSwap: true, manageStaff: false, absEntry: false, resetPins: false, manageShifts: false, manageOrg: false },
  staff: allPerms(false),
};

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// ─── Helpers: Antworten ───────────────────────────────────────

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Helpers: PIN-Hashing (PBKDF2, WebCrypto — kein bcrypt-Worker-Risiko) ──

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf.buffer : buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function pbkdf2(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256,
  );
  return b64(bits);
}

async function pinHash(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iter = 100_000;
  return `pbkdf2$${iter}$${b64(salt)}$${await pbkdf2(pin, salt, iter)}`;
}

async function pinVerify(pin: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2$")) {
    const [, iterS, saltB64, hashB64] = stored.split("$");
    const derived = await pbkdf2(pin, fromB64(saltB64), Number(iterS));
    return derived === hashB64;
  }
  // Legacy/Migration: Klartext-PIN in der DB → Trim-Vergleich (heilt Altdaten)
  return String(stored).trim() === pin;
}

const isHashed = (v: unknown) => typeof v === "string" && v.startsWith("pbkdf2$");

// ─── Helpers: Session-Token (HMAC-SHA256, handrolled) ────────────────────

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

async function hmacKey() {
  const secret = Deno.env.get("SESSION_SECRET");
  if (!secret) throw new ApiError("Server nicht konfiguriert (SESSION_SECRET)", 500);
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

type Session = { oid: string | null; eid: string | null; role: string; sup: boolean; exp: number };

async function signToken(s: Omit<Session, "exp">): Promise<string> {
  const payload = b64url(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S }));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload));
  return `${payload}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyToken(token: string | null): Promise<Session | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot), sigB64 = token.slice(dot + 1);
  try {
    const sig = Uint8Array.from(fromB64url(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), sig, new TextEncoder().encode(payload));
    if (!valid) return null;
    const s = JSON.parse(fromB64url(payload)) as Session;
    if (!s.exp || s.exp < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch { return null; }
}

function requireAuth(s: Session | null): Session {
  if (!s) throw new ApiError("Sitzung abgelaufen – bitte neu anmelden", 401);
  return s;
}

// ─── Helpers: Betriebs-ID (FNV-Hash, identisch zu src/lib/orgCode.js) ─────

function orgCode(name: string): string {
  const s = (name || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "") || "betrieb";
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const AB = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "", x = h;
  for (let i = 0; i < 5; i++) { code += AB[x % AB.length]; x = Math.floor(x / AB.length); }
  return code;
}

// ─── Push-Versand (FCM HTTP v1 — bedient Android UND iOS via APNs) ────────
// Benötigt Secret FCM_SERVICE_ACCOUNT = kompletter Service-Account-JSON
// aus der Firebase-Konsole. Fehlt es, wird Push still übersprungen.

let fcmCache: { token: string; exp: number } | null = null;

async function fcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  const sa = JSON.parse(raw);
  if (fcmCache && fcmCache.exp > Date.now() + 60_000) {
    return { token: fcmCache.token, projectId: sa.project_id };
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", fromB64(pem).buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) return null;
  fcmCache = { token: data.access_token, exp: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000 };
  return { token: data.access_token, projectId: sa.project_id };
}

// Schickt jedem betroffenen Mitarbeiter eine Push pro neuer Benachrichtigung.
// Best effort: Fehler werden geloggt, blockieren aber nie das Speichern.
async function sendPushForNotifs(orgId: string, notifs: Any[]) {
  try {
    if (!notifs.length) return;
    const auth = await fcmAccessToken();
    if (!auth) return;
    const empIds = [...new Set(notifs.map(n => n.emp_id).filter(Boolean))];
    if (!empIds.length) return;
    const { data: tokens } = await db.from("push_tokens")
      .select("token, emp_id").eq("org_id", orgId).in("emp_id", empIds);
    if (!tokens?.length) return;
    const byEmp: Record<string, string[]> = {};
    tokens.forEach((t: Any) => { (byEmp[t.emp_id] ||= []).push(t.token); });

    const dead: string[] = [];
    await Promise.all(notifs.flatMap(n => (byEmp[n.emp_id] || []).map(async token => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: "ShiftSync", body: String(n.text || "Neue Benachrichtigung") },
            data: { type: String(n.type || "info") },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
            android: { priority: "high" },
          },
        }),
      });
      if (res.status === 404 || res.status === 400) dead.push(token); // UNREGISTERED/ungültig
    })));
    if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  } catch (e) {
    console.error("push error:", e);
  }
}

// ─── Mapping: DB-Row ↔ App-Format ────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Any = any;

function mapOrg(row: Any) {
  return {
    id: row.id, code: row.code, name: row.name, sub: row.sub,
    weekStdHours: Number(row.week_std_hours),
    shifts: row.shifts || [], holidays: row.holidays || [], perms: row.perms || {},
    status: row.status, plan: row.plan,
    trialEnds: row.trial_ends ? new Date(row.trial_ends).getTime() : null,
    accent: row.accent, timeclock: row.timeclock || 'self',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    // Freie Betriebseinstellungen (availMode, absEntryMode, regenLeadDays, …)
    ...(row.settings || {}),
  };
}

// Mitarbeiter im App-Format — PIN wird NIE mitgeliefert.
function mapEmp(row: Any) {
  return {
    id: row.id, name: row.name, lid: row.lid,
    role: row.role, workPct: row.work_pct, pref: row.pref,
    inPlan: row.in_plan, notes: row.notes || "",
    linkedOrgs: row.linked_orgs || [],
    // Freie Profilfelder (avail, maxDaysPerWeek, vacDays, vacCarry, startDate, hrNotes, …)
    ...(row.profile || {}),
  };
}

async function loadOrgRow(orgId: string): Promise<Any> {
  const { data, error } = await db.from("orgs").select("*").eq("id", orgId).maybeSingle();
  if (error) throw new ApiError("Datenbankfehler: " + error.message, 500);
  return data;
}

// Alle Betriebsdaten im flachen App-Format { emps, wishes, scheds, reqs, notifs, clock, market }
async function loadOrgData(orgId: string) {
  const [empsR, schedsR, reqsR, notifsR, clockR, marketR, wishesR] = await Promise.all([
    db.from("employees").select("*").eq("org_id", orgId).order("created_at"),
    db.from("schedules").select("*").eq("org_id", orgId),
    db.from("requests").select("*").eq("org_id", orgId).order("created_at"),
    db.from("notifications").select("*").eq("org_id", orgId),
    db.from("clock_entries").select("*").eq("org_id", orgId),
    db.from("market_offers").select("*").eq("org_id", orgId).order("created_at"),
    db.from("wishes").select("*").eq("org_id", orgId),
  ]);
  for (const r of [empsR, schedsR, reqsR, notifsR, clockR, marketR, wishesR]) {
    if (r.error) throw new ApiError("Datenbankfehler: " + r.error.message, 500);
  }

  const emps = (empsR.data || []).map(mapEmp);
  const empName = (id: string) => (empsR.data || []).find((e: Any) => e.id === id)?.name || "";

  const scheds: Record<string, Any> = {};
  (schedsR.data || []).forEach((r: Any) => { scheds[r.month] = r.data; });

  const reqs = (reqsR.data || []).map((r: Any) => ({
    id: r.id, type: r.type, uid: r.emp_id, status: r.status,
    at: new Date(r.created_at).getTime(),
    decidedAt: r.decided_at ? new Date(r.decided_at).getTime() : undefined,
    decidedBy: r.decided_by || undefined,
    decisionNote: r.decision_note || "",
    ...(r.payload || {}),
  }));

  const notifs = (notifsR.data || []).map((n: Any) => ({
    id: n.id, uid: n.emp_id, type: n.type, text: n.text, read: n.read,
    at: new Date(n.created_at).getTime(),
  }));

  const clock: Record<string, Record<string, Any>> = {};
  (clockR.data || []).forEach((c: Any) => {
    const day = String(c.day).slice(0, 10);
    if (!clock[day]) clock[day] = {};
    const entry: Any = {};
    if (c.clock_in) entry.in = new Date(c.clock_in).getTime();
    if (c.clock_out) entry.out = new Date(c.clock_out).getTime();
    clock[day][c.emp_id] = entry;
  });

  const market = (marketR.data || []).map((m: Any) => ({
    id: m.id, mo: m.month, day: m.day, key: m.shift_key,
    empId: m.emp_id, empName: empName(m.emp_id),
    status: m.status,
    takerId: m.taker_id || undefined, takerName: m.taker_id ? empName(m.taker_id) : undefined,
    takenAt: m.taken_at ? new Date(m.taken_at).getTime() : undefined,
    at: new Date(m.created_at).getTime(),
  }));

  const wishes: Record<string, Any> = {};
  (wishesR.data || []).forEach((w: Any) => {
    wishes[`${w.month}-${w.emp_id}`] = { days: w.days || [], note: w.note || "" };
  });

  return { emps, wishes, scheds, reqs, notifs, clock, market };
}

// Schreibt den kompletten App-Zustand in die Tabellen (authoritative state):
// Upserts + Löschen von Zeilen, die im Payload fehlen — exakt die Semantik
// des lokalen "ganzes Objekt ersetzen". PINs: neue Klartext-PINs werden
// gehasht, fehlende PINs behalten den vorhandenen Hash.
async function saveOrgData(orgId: string, value: Any, session?: Session | null) {
  const {
    emps = [], scheds = {}, reqs = [], notifs = [], clock = {}, market = [], wishes = {},
  } = value || {};

  // ── employees: PIN-Merge ──
  const { data: existingEmps, error: exErr } = await db
    .from("employees").select("id, pin_hash").eq("org_id", orgId);
  if (exErr) throw new ApiError("Datenbankfehler: " + exErr.message, 500);
  const existingHash: Record<string, string> = {};
  (existingEmps || []).forEach((e: Any) => { existingHash[e.id] = e.pin_hash; });

  const empRows = [];
  for (const e of emps) {
    let hash: string;
    if (isHashed(e.pin)) hash = e.pin; // sollte nie vorkommen (get strippt), aber sicher
    else if (typeof e.pin === "string" && e.pin.trim().length >= 4) hash = await pinHash(e.pin.trim());
    else if (existingHash[e.id]) hash = existingHash[e.id];
    else throw new ApiError(`PIN fehlt für ${e.name || e.lid}`, 400);
    empRows.push({
      id: e.id, org_id: orgId, name: e.name,
      lid: String(e.lid || "").trim().toLowerCase(),
      pin_hash: hash,
      role: e.role || "staff", work_pct: Number(e.workPct) || 100,
      pref: e.pref || "any", in_plan: e.inPlan !== false,
      notes: e.notes || "", linked_orgs: e.linkedOrgs || [],
      profile: {
        avail: e.avail ?? null,
        maxDaysPerWeek: e.maxDaysPerWeek ?? null,
        vacDays: e.vacDays ?? null,
        vacCarry: e.vacCarry ?? null,
        startDate: e.startDate ?? null,
        hrNotes: e.hrNotes ?? null,
        // Kontaktdaten (vom Mitarbeiter selbst pflegbar, Admin sieht sie in der Akte)
        email: e.email ?? null,
        phone: e.phone ?? null,
        address: e.address ?? null,
        emergencyName: e.emergencyName ?? null,
        emergencyPhone: e.emergencyPhone ?? null,
      },
    });
  }
  if (empRows.length) {
    const { error } = await db.from("employees").upsert(empRows, { onConflict: "id" });
    if (error) throw new ApiError("Speichern (Mitarbeiter): " + error.message, 500);
  }

  // ── schedules ──
  const schedRows = Object.entries(scheds).map(([month, data]) => ({ org_id: orgId, month, data }));
  if (schedRows.length) {
    const { error } = await db.from("schedules").upsert(schedRows, { onConflict: "org_id,month" });
    if (error) throw new ApiError("Speichern (Pläne): " + error.message, 500);
  }

  // ── requests ──
  const reqRows = (reqs as Any[]).map(r => ({
    id: r.id, org_id: orgId, emp_id: r.uid, type: r.type,
    status: r.status || "pending",
    decided_by: r.decidedBy || null,
    decided_at: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    decision_note: r.decisionNote || "",
    created_at: r.at ? new Date(r.at).toISOString() : new Date().toISOString(),
    payload: {
      dates: r.dates, fromDate: r.fromDate, toDate: r.toDate,
      toId: r.toId, date: r.date, note: r.note, by: r.by,
    },
  }));
  if (reqRows.length) {
    const { error } = await db.from("requests").upsert(reqRows, { onConflict: "id" });
    if (error) throw new ApiError("Speichern (Anfragen): " + error.message, 500);
  }

  // ── notifications ──
  const notifRows = (notifs as Any[]).map(n => ({
    id: n.id, org_id: orgId, emp_id: n.uid, type: n.type, text: n.text,
    read: !!n.read,
    created_at: n.at ? new Date(n.at).toISOString() : new Date().toISOString(),
  }));
  if (notifRows.length) {
    // Vorher wissen, welche Benachrichtigungen NEU sind → nur die pushen
    const { data: existingNotifs } = await db.from("notifications")
      .select("id").eq("org_id", orgId).in("id", notifRows.map(n => n.id));
    const known = new Set((existingNotifs || []).map((n: Any) => n.id));
    const fresh = notifRows.filter(n => !known.has(n.id));

    const { error } = await db.from("notifications").upsert(notifRows, { onConflict: "id" });
    if (error) throw new ApiError("Speichern (Benachrichtigungen): " + error.message, 500);

    // Push an die Geräte der Empfänger — läuft nach der Antwort weiter
    const p = sendPushForNotifs(orgId, fresh);
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(p); else await p;
  }

  // ── clock ──
  const clockRows: Any[] = [];
  Object.entries(clock as Record<string, Any>).forEach(([dayStr, byEmp]) => {
    Object.entries(byEmp as Record<string, Any>).forEach(([empId, stamp]: [string, Any]) => {
      if (stamp?.in || stamp?.out) {
        clockRows.push({
          org_id: orgId, emp_id: empId, day: dayStr,
          clock_in: stamp.in ? new Date(stamp.in).toISOString() : null,
          clock_out: stamp.out ? new Date(stamp.out).toISOString() : null,
        });
      }
    });
  });
  if (clockRows.length) {
    const { error } = await db.from("clock_entries").upsert(clockRows, { onConflict: "org_id,emp_id,day" });
    if (error) throw new ApiError("Speichern (Stempeluhr): " + error.message, 500);
  }

  // ── market ──
  const marketRows = (market as Any[]).map(m => ({
    id: m.id, org_id: orgId, emp_id: m.empId,
    month: m.mo, day: m.day, shift_key: m.key,
    status: m.status || "open",
    taker_id: m.takerId || null,
    taken_at: m.takenAt ? new Date(m.takenAt).toISOString() : null,
    created_at: m.at ? new Date(m.at).toISOString() : new Date().toISOString(),
  }));
  if (marketRows.length) {
    const { error } = await db.from("market_offers").upsert(marketRows, { onConflict: "id" });
    if (error) throw new ApiError("Speichern (Schichtbörse): " + error.message, 500);
  }

  // ── wishes ── Key: "YYYY-MM-<empId>"
  const wishRows = Object.entries(wishes as Record<string, Any>).map(([k, v]) => {
    const month = k.slice(0, 7), empId = k.slice(8);
    const days = Array.isArray(v) ? v : (v?.days || []);
    const note = (v && typeof v === "object" && !Array.isArray(v)) ? (v.note || "") : "";
    return { org_id: orgId, emp_id: empId, month, days, note };
  }).filter(w => w.emp_id);
  if (wishRows.length) {
    const { error } = await db.from("wishes").upsert(wishRows, { onConflict: "org_id,emp_id,month" });
    if (error) throw new ApiError("Speichern (Wunschfrei): " + error.message, 500);
  }

  // ── Reconcile: Zeilen löschen, die der Client entfernt hat ──
  // Nebenläufigkeits-sicher: optional auf den handelnden Mitarbeiter (emp_id) begrenzt,
  // damit ein veralteter Client nicht die frischen Zeilen ANDERER Nutzer löscht.
  const delNotIn = async (table: string, ids: string[], scopeEmpId?: string) => {
    let q = db.from(table).delete().eq("org_id", orgId);
    if (scopeEmpId) q = q.eq("emp_id", scopeEmpId);
    if (ids.length) q = q.not("id", "in", `(${ids.map(i => `"${i}"`).join(",")})`);
    const { error } = await q;
    if (error) throw new ApiError(`Aufräumen (${table}): ` + error.message, 500);
  };
  // employees: voller Reconcile (delEmp braucht echtes Löschen; nur Management, geringe Nebenläufigkeit)
  await delNotIn("employees", empRows.map(r => r.id));
  // requests: NUR Upsert — die App löscht nie Anfragen (handleReq ändert nur den Status).
  //   Kein Reconcile-Delete => keine Anfragen-Verluste bei gleichzeitigen Nutzern.
  // notifications/market: Reconcile nur auf EIGENE Zeilen des handelnden Nutzers
  //   (clearMyNotifs/withdrawOffer betreffen ausschließlich eigene Zeilen).
  const eid = session && session.eid;
  if (eid) {
    await delNotIn("notifications", notifRows.map(r => r.id), eid);
    await delNotIn("market_offers", marketRows.map(r => r.id), eid);
  }
}

// Betriebe, die ein Mitarbeiter sehen darf: eigener + verknüpfte
async function orgsForEmp(ownOrgId: string, linkedOrgs: Any[]): Promise<Any[]> {
  const ids = [ownOrgId, ...(linkedOrgs || []).map((l: Any) => l.id).filter(Boolean)];
  const { data, error } = await db.from("orgs").select("*").in("id", ids).order("created_at");
  if (error) throw new ApiError("Datenbankfehler: " + error.message, 500);
  return (data || []).map(mapOrg);
}

async function allOrgs(): Promise<Any[]> {
  const { data, error } = await db.from("orgs").select("*").order("created_at");
  if (error) throw new ApiError("Datenbankfehler: " + error.message, 500);
  return (data || []).map(mapOrg);
}

// Status-Prüfung wie im lokalen doLogin
function checkOrgStatus(org: Any, role: string) {
  const st = org.status || "active";
  if (st === "suspended") throw new ApiError("Betrieb gesperrt – bitte Anbieter kontaktieren", 403);
  if (st === "archived" && role !== "owner") throw new ApiError("Dieser Betrieb ist offline gestellt", 403);
  if (st === "trial" && org.trial_ends && new Date(org.trial_ends).getTime() < Date.now()) {
    throw new ApiError("Testzeitraum abgelaufen", 403);
  }
}

// ─── Brute-Force-Schutz ───────────────────────────────────────────────────
// Ohne Bremse waere eine 4-stellige PIN in Minuten durchprobiert. Gezaehlt
// wird je Identitaet (email bzw. code:lid): nach MAX_FAILS Fehlversuchen
// innerhalb von WINDOW_MIN wird fuer LOCK_MIN gesperrt. Erfolgreicher Login
// setzt den Zaehler zurueck. Fehler der Bremse duerfen den Login NIE
// blockieren (fail-open) — sonst sperrt ein DB-Hickser alle aus.

const MAX_FAILS = 5;
const WINDOW_MIN = 15;
const LOCK_MIN = 15;

async function assertNotLocked(key: string) {
  try {
    const { data } = await db.from("login_attempts").select("locked_until").eq("key", key).maybeSingle();
    if (!data?.locked_until) return;
    const until = new Date(data.locked_until).getTime();
    if (until > Date.now()) {
      const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
      throw new ApiError(`Zu viele Fehlversuche. Bitte in ${mins} Minute${mins > 1 ? "n" : ""} erneut versuchen.`, 429);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e; // echte Sperre durchreichen
    // DB-Problem: Login nicht blockieren
  }
}

async function noteFail(key: string) {
  try {
    const { data } = await db.from("login_attempts").select("*").eq("key", key).maybeSingle();
    const now = Date.now();
    const windowStart = data?.first_fail ? new Date(data.first_fail).getTime() : now;
    const stale = now - windowStart > WINDOW_MIN * 60000;
    const fails = (stale || !data ? 0 : data.fails) + 1;
    await db.from("login_attempts").upsert({
      key,
      fails,
      first_fail: (stale || !data ? new Date(now) : new Date(windowStart)).toISOString(),
      locked_until: fails >= MAX_FAILS ? new Date(now + LOCK_MIN * 60000).toISOString() : null,
    }, { onConflict: "key" });
  } catch { /* Zaehler-Fehler darf den Login-Ablauf nicht stoeren */ }
}

const clearFails = async (key: string) => {
  try { await db.from("login_attempts").delete().eq("key", key); } catch { /* egal */ }
};

// ─── Actions ──────────────────────────────────────────────────────────────

// Gemeinsamer Abschluss beider Login-Wege (Betriebs-ID oder E-Mail).
async function finishLogin(orgRow: Any, empRow: Any, pin: string) {
  // Klartext-Altbestand beim erfolgreichen Login auf PBKDF2 heben
  if (!isHashed(empRow.pin_hash)) {
    await db.from("employees").update({ pin_hash: await pinHash(pin) }).eq("id", empRow.id);
  }
  checkOrgStatus(orgRow, empRow.role);
  const token = await signToken({ oid: orgRow.id, eid: empRow.id, role: empRow.role, sup: false });
  return ok({
    token,
    org: mapOrg(orgRow),
    orgs: await orgsForEmp(orgRow.id, empRow.linked_orgs),
    emp: mapEmp(empRow),
    data: await loadOrgData(orgRow.id),
  });
}

// E-Mail-Login: die PERSON ist der Einstieg, nicht der Betrieb.
// Die E-Mail liegt in employees.profile->>'email' (vom Mitarbeiter selbst
// gepflegt). Dieselbe Person kann in mehreren Betrieben eine Mitarbeiterkarte
// haben ("zwei Laura Bauer") → dann wird der Betrieb zur Auswahl angeboten,
// erst nach der Wahl gibt es ein Token.
async function actLoginEmail(body: Any) {
  const email = String(body.email || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  const orgId = body.orgId ? String(body.orgId) : null;
  if (!email || !pin) throw new ApiError("E-Mail und PIN eingeben", 400);

  const lockKey = `email:${email}`;
  await assertNotLocked(lockKey);

  const { data: rows, error } = await db.from("employees").select("*").eq("profile->>email", email);
  if (error) throw new ApiError("Datenbankfehler: " + error.message, 500);
  const cands = rows || [];
  // Bewusst identische Meldung bei unbekannter E-Mail und falscher PIN —
  // verrät nicht, ob eine Adresse im System existiert.
  if (!cands.length) { await noteFail(lockKey); throw new ApiError("E-Mail oder PIN falsch", 401); }

  const matched: Any[] = [];
  for (const e of cands) if (await pinVerify(pin, e.pin_hash)) matched.push(e);
  if (!matched.length) { await noteFail(lockKey); throw new ApiError("E-Mail oder PIN falsch", 401); }

  await clearFails(lockKey);
  const pick = orgId ? matched.find((e: Any) => e.org_id === orgId) : (matched.length === 1 ? matched[0] : null);
  if (!pick) {
    const ids = matched.map((e: Any) => e.org_id);
    const { data: orgsRows } = await db.from("orgs").select("id, code, name").in("id", ids);
    return ok({ chooseOrg: (orgsRows || []).map((o: Any) => ({ id: o.id, code: o.code, name: o.name })) });
  }
  const orgRow = await loadOrgRow(pick.org_id);
  if (!orgRow) throw new ApiError("Betrieb existiert nicht mehr", 404);
  return await finishLogin(orgRow, pick, pin);
}

async function actLogin(body: Any) {
  // Neuer Weg: E-Mail statt Betriebs-ID (klassischer Weg bleibt unverändert)
  if (body.email && !body.code) return await actLoginEmail(body);

  const code = String(body.code || "").trim().toUpperCase();
  const lid = String(body.lid || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!code || !lid || !pin) throw new ApiError("Fehlende Eingaben", 400);

  // Super-Admin
  if (code === SUPER_ADMIN_CODE && lid === SUPER_ADMIN_LID) {
    const superPw = Deno.env.get("SUPER_ADMIN_PW") || "";
    if (!superPw || pin !== superPw) throw new ApiError("PIN falsch für Super-Admin", 401);
    const token = await signToken({ oid: null, eid: null, role: "superadmin", sup: true });
    return ok({ super: true, token, orgs: await allOrgs() });
  }

  const lockKey = `code:${code}:${lid}`;
  await assertNotLocked(lockKey);

  const { data: orgRow, error } = await db.from("orgs").select("*").eq("code", code).maybeSingle();
  if (error) throw new ApiError("Datenbankfehler: " + error.message, 500);
  if (!orgRow) throw new ApiError("Betriebs-ID nicht gefunden", 404);

  const { data: empRow, error: e2 } = await db.from("employees")
    .select("*").eq("org_id", orgRow.id).eq("lid", lid).maybeSingle();
  if (e2) throw new ApiError("Datenbankfehler: " + e2.message, 500);
  if (!empRow) throw new ApiError(`Login-ID „${lid}" existiert in diesem Betrieb nicht`, 404);

  if (!(await pinVerify(pin, empRow.pin_hash))) {
    await noteFail(lockKey);
    throw new ApiError(`PIN falsch für ${empRow.name}`, 401);
  }
  await clearFails(lockKey);
  return await finishLogin(orgRow, empRow, pin);
}

// ─── Mail-Versand (Resend) ────────────────────────────────────────────────
// Absender ist eine EINSTELLUNG (Secret RESEND_FROM), kein fester Wert:
//   - ohne eigene Domain: Resends Test-Absender (darf nur an die eigene
//     Resend-Konto-Adresse senden) — Standard, funktioniert sofort
//   - mit eigener, in Resend verifizierter Domain: RESEND_FROM setzen,
//     z.B. "ShiftSync <noreply@meine-domain.de>" — ohne Neu-Deploy.
// Fehler werden GELOGGT statt verschluckt: Resend antwortet bei nicht
// verifizierter Absender-Domain mit 4xx — das ist KEINE Exception, ein
// blosses .catch() haette es unsichtbar gemacht.

const DEFAULT_FROM = "ShiftSync <onboarding@resend.dev>";

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.error("mail: RESEND_API_KEY nicht gesetzt — es wurde nichts versendet"); return false; }
  if (!to) return false;
  const from = Deno.env.get("RESEND_FROM") || DEFAULT_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`mail: Resend lehnte ab (HTTP ${res.status}) an ${to} von "${from}": ${detail}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("mail: Netzwerkfehler an " + to + ":", e);
    return false;
  }
}

async function sendWelcomeMail(email: string, coName: string, code: string, lid: string) {
  if (!email) return;
  const appUrl = "https://shiftsync-pro-zeta.vercel.app";
  await sendMail(
    email,
    `Dein Betrieb ist bereit — Betriebs-ID: ${code}`,
    `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
        <h2 style="margin:0 0 8px">Willkommen bei ShiftSync Pro!</h2>
        <p style="color:#555">Dein Betrieb <strong>${coName}</strong> ist eingerichtet und einsatzbereit.</p>
        <div style="background:#f5f5f3;border-radius:10px;padding:20px;margin:24px 0">
          <div style="margin-bottom:10px"><span style="color:#888;font-size:12px">BETRIEBS-ID</span><br>
            <strong style="font-family:monospace;font-size:22px;letter-spacing:4px;color:#4f46e5">${code}</strong>
          </div>
          <div><span style="color:#888;font-size:12px">DEINE LOGIN-ID</span><br>
            <strong style="font-family:monospace">${lid}</strong>
          </div>
        </div>
        <a href="${appUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">App öffnen</a>
        <p style="margin-top:24px;font-size:12px;color:#888">Dein 14-Tage-Test läuft ab jetzt. Bei Fragen antworte einfach auf diese E-Mail.</p>
      </div>`,
  );
}

async function actSetup(body: Any, session: Session | null) {
  const coName = String(body.coName || "").trim();
  const coSub = String(body.coSub || "").trim() || "Tankstelle · 24/7";
  const weekStdHours = Number(body.weekStdHours) || 40;
  const name = String(body.name || "").trim();
  const lid = String(body.lid || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!coName || !name || !lid || pin.length < 4) throw new ApiError("Alle Felder, PIN ≥4", 400);

  const asSuper = !!session?.sup;

  // E-Mail-Pflicht + Anti-Abuse nur beim Self-Signup
  if (!asSuper) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError("Bitte eine gültige E-Mail-Adresse angeben", 400);
    }
    // Ein aktiver Betrieb pro E-Mail — verhindert Trial-Missbrauch
    const { data: existing } = await db.from("orgs")
      .select("id, name, status")
      .eq("email", email)
      .neq("status", "archived")
      .maybeSingle();
    if (existing) {
      throw new ApiError(
        `Diese E-Mail ist bereits mit dem Betrieb „${existing.name}" verknüpft. Bitte direkt einloggen oder den Support kontaktieren.`,
        409,
      );
    }
  }

  const code = orgCode(coName);
  const { data: clash } = await db.from("orgs").select("id").eq("code", code).maybeSingle();
  if (clash) throw new ApiError("Ein Betrieb mit diesem Namen existiert bereits – bitte einloggen.", 409);

  // Super wählt den Tarif (sofort aktiv, keine Testphase). Self-Signup = immer 14-Tage-Trial.
  const VALID_PLANS = ["free", "starter", "pro", "business"];
  const chosenPlan = asSuper && VALID_PLANS.includes(body.plan) ? body.plan : (asSuper ? "free" : "trial");

  const orgId = crypto.randomUUID();
  const empId = crypto.randomUUID();
  const orgRow = {
    id: orgId, code, name: coName, sub: coSub, week_std_hours: weekStdHours,
    shifts: Array.isArray(body.shifts) && body.shifts.length ? body.shifts : DEFAULT_SHIFTS,
    holidays: [], perms: (body.perms && Object.keys(body.perms).length) ? body.perms : DEFAULT_PERMS,
    status: asSuper ? "active" : "trial",
    plan: chosenPlan,
    trial_ends: asSuper ? null : new Date(Date.now() + 14 * 864e5).toISOString(),
    accent: "#4f46e5",
    email: email || null,
  };
  const { error } = await db.from("orgs").insert(orgRow);
  if (error) throw new ApiError("Anlegen fehlgeschlagen: " + error.message, 500);

  const empRow = {
    id: empId, org_id: orgId, name, lid,
    pin_hash: await pinHash(pin),
    role: "owner", work_pct: 100, pref: "any", in_plan: false,
    notes: "", linked_orgs: [],
    // Anmelde-E-Mail auch in die eigene Karte → Inhaber kann sich sofort
    // per E-Mail anmelden, ohne sie erst im Profil nachzutragen.
    profile: { email: email || null },
  };
  const { error: e2 } = await db.from("employees").insert(empRow);
  if (e2) {
    await db.from("orgs").delete().eq("id", orgId); // rollback
    throw new ApiError("Anlegen fehlgeschlagen: " + e2.message, 500);
  }

  const org = mapOrg({ ...orgRow, created_at: new Date().toISOString() });
  const emp = mapEmp(empRow);
  const data = { emps: [emp], wishes: {}, scheds: {}, reqs: [], notifs: [], clock: {}, market: [] };

  if (asSuper) {
    return ok({ super: true, org, emp, data, orgs: await allOrgs() });
  }
  const token = await signToken({ oid: orgId, eid: empId, role: "owner", sup: false });
  // Welcome-E-Mail im Hintergrund — blockiert nie die Antwort
  sendWelcomeMail(email, coName, code, lid);
  return ok({ token, org, emp, data, orgs: [org] });
}

async function actMe(session: Session) {
  if (session.sup) return ok({ super: true, orgs: await allOrgs() });
  const orgRow = await loadOrgRow(session.oid!);
  if (!orgRow) throw new ApiError("Betrieb existiert nicht mehr", 404);
  const { data: empRow } = await db.from("employees").select("*").eq("id", session.eid!).maybeSingle();
  if (!empRow) throw new ApiError("Account existiert nicht mehr", 401);
  checkOrgStatus(orgRow, empRow.role);
  return ok({
    org: mapOrg(orgRow),
    orgs: await orgsForEmp(orgRow.id, empRow.linked_orgs),
    emp: mapEmp(empRow),
    data: await loadOrgData(orgRow.id),
  });
}

async function actGet(body: Any, session: Session) {
  const key = String(body.key || "");
  if (key === "orgs") {
    if (session.sup) return ok({ value: await allOrgs() });
    const { data: empRow } = await db.from("employees").select("linked_orgs").eq("id", session.eid!).maybeSingle();
    return ok({ value: await orgsForEmp(session.oid!, empRow?.linked_orgs || []) });
  }
  if (key.startsWith("org_")) {
    const orgId = key.slice(4);
    if (!session.sup && orgId !== session.oid) throw new ApiError("Kein Zugriff auf diesen Betrieb", 403);
    return ok({ value: await loadOrgData(orgId) });
  }
  return ok({ value: null });
}

const MGMT = ["owner", "director", "manager"];
// Felder, die ein Betrieb an sich selbst ändern darf (KEIN plan/status/code/trialEnds!)
const ORG_SELF_FIELDS: Record<string, string> = {
  name: "name", sub: "sub", weekStdHours: "week_std_hours",
  shifts: "shifts", holidays: "holidays", perms: "perms", accent: "accent", timeclock: "timeclock",
};
// Freie Einstellungen, die gesammelt in orgs.settings (jsonb) landen
const ORG_SETTINGS_FIELDS = ["availMode", "absEntryMode", "regenLeadDays", "modules"];

async function actSet(body: Any, session: Session) {
  const key = String(body.key || "");
  const value = body.value;

  if (key === "orgs") {
    const list = Array.isArray(value) ? value : [];
    if (session.sup) {
      // Super darf alles inkl. plan/status — Upsert aller übergebenen Betriebe
      for (const o of list) {
        const row: Any = {
          id: o.id, code: o.code, name: o.name, sub: o.sub || "Tankstelle · 24/7",
          week_std_hours: Number(o.weekStdHours) || 40,
          shifts: o.shifts || [], holidays: o.holidays || [], perms: o.perms || {},
          status: o.status || "trial", plan: o.plan || "trial",
          trial_ends: o.trialEnds ? new Date(o.trialEnds).toISOString() : null,
          accent: o.accent || "#4f46e5",
        };
        const { error } = await db.from("orgs").upsert(row, { onConflict: "id" });
        if (error) throw new ApiError("Speichern (Betrieb): " + error.message, 500);
      }
      return ok({ ok: true });
    }
    // Normaler Nutzer: nur die eigene Org, nur Whitelist-Felder, nur Management
    if (!MGMT.includes(session.role)) throw new ApiError("Keine Berechtigung", 403);
    const own = list.find((o: Any) => o.id === session.oid);
    if (!own) return ok({ ok: true }); // nichts für uns dabei
    const patch: Any = {};
    for (const [appField, dbField] of Object.entries(ORG_SELF_FIELDS)) {
      if (own[appField] !== undefined) {
        patch[dbField] = appField === "weekStdHours" ? (Number(own[appField]) || 40) : own[appField];
      }
    }
    const settings: Any = {};
    for (const f of ORG_SETTINGS_FIELDS) if (own[f] !== undefined) settings[f] = own[f];
    if (Object.keys(settings).length) patch.settings = settings;
    const { error } = await db.from("orgs").update(patch).eq("id", session.oid!);
    if (error) throw new ApiError("Speichern (Betrieb): " + error.message, 500);
    return ok({ ok: true });
  }

  if (key.startsWith("org_")) {
    const orgId = key.slice(4);
    if (value === null) {
      // Betrieb endgültig löschen — nur Super (SuperConsole-Papierkorb)
      if (!session.sup) throw new ApiError("Keine Berechtigung", 403);
      const { error } = await db.from("orgs").delete().eq("id", orgId);
      if (error) throw new ApiError("Löschen fehlgeschlagen: " + error.message, 500);
      return ok({ ok: true });
    }
    if (!session.sup) {
      if (orgId !== session.oid) throw new ApiError("Kein Zugriff auf diesen Betrieb", 403);
      // Mitarbeiter (staff) dürfen schreiben — aber nur eigene Daten ändern sich
      // in der App (Stempeluhr, Anfragen, Wünsche, Börse). Die Whole-State-Semantik
      // erlaubt keine feinere Prüfung ohne Diff — Mandantengrenze ist gesichert.
    }
    await saveOrgData(orgId, value, session);
    return ok({ ok: true });
  }

  return ok({ ok: true });
}

async function actChpin(body: Any, session: Session) {
  const cur = String(body.cur ?? "");
  const nw = String(body.nw || "").trim();
  if (nw.length < 4) throw new ApiError("≥4 Zeichen", 400);
  const { data: empRow } = await db.from("employees").select("id, pin_hash").eq("id", session.eid!).maybeSingle();
  if (!empRow) throw new ApiError("Account existiert nicht mehr", 401);
  if (!(await pinVerify(cur.trim(), empRow.pin_hash))) throw new ApiError("Aktueller PIN falsch", 401);
  const { error } = await db.from("employees").update({ pin_hash: await pinHash(nw) }).eq("id", empRow.id);
  if (error) throw new ApiError("Speichern fehlgeschlagen: " + error.message, 500);
  return ok({ ok: true });
}

async function actLinkOrg(body: Any, session: Session) {
  const code = String(body.code || "").trim().toUpperCase();
  const lid = String(body.lid || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!code || !lid || !pin) throw new ApiError("Alle Felder ausfüllen", 400);

  const { data: target } = await db.from("orgs").select("*").eq("code", code).maybeSingle();
  if (!target) throw new ApiError("Betriebs-ID nicht gefunden", 404);
  if (target.id === session.oid) throw new ApiError("Das ist der aktuelle Betrieb", 400);

  const { data: tacc } = await db.from("employees")
    .select("*").eq("org_id", target.id).eq("lid", lid).maybeSingle();
  if (!tacc || !(await pinVerify(pin, tacc.pin_hash))) {
    throw new ApiError("Login-ID oder PIN im Zielbetrieb falsch", 401);
  }
  if (!MGMT.includes(tacc.role)) throw new ApiError("Dieser Account darf dort nicht planen", 403);

  const { data: meRow } = await db.from("employees").select("*").eq("id", session.eid!).maybeSingle();
  if (!meRow) throw new ApiError("Account existiert nicht mehr", 401);
  const myOrg = await loadOrgRow(session.oid!);

  const myLink = { id: target.id, code: target.code, name: target.name, lid: tacc.lid };
  const myNew = [...(meRow.linked_orgs || []).filter((l: Any) => l.id !== target.id), myLink];
  await db.from("employees").update({ linked_orgs: myNew }).eq("id", meRow.id);

  const backLink = { id: myOrg.id, code: myOrg.code, name: myOrg.name, lid: meRow.lid };
  const tNew = [...(tacc.linked_orgs || []).filter((l: Any) => l.id !== myOrg.id), backLink];
  await db.from("employees").update({ linked_orgs: tNew }).eq("id", tacc.id);

  return ok({
    linkedOrgs: myNew,
    targetName: target.name,
    orgs: await orgsForEmp(session.oid!, myNew),
  });
}

async function actUnlinkOrg(body: Any, session: Session) {
  const targetId = String(body.targetId || "");
  const { data: meRow } = await db.from("employees").select("linked_orgs").eq("id", session.eid!).maybeSingle();
  if (!meRow) throw new ApiError("Account existiert nicht mehr", 401);
  const myNew = (meRow.linked_orgs || []).filter((l: Any) => l.id !== targetId);
  await db.from("employees").update({ linked_orgs: myNew }).eq("id", session.eid!);
  return ok({ linkedOrgs: myNew, orgs: await orgsForEmp(session.oid!, myNew) });
}

async function actSwitchOrg(body: Any, session: Session) {
  const targetId = String(body.targetId || "");
  const targetOrg = await loadOrgRow(targetId);
  if (!targetOrg) throw new ApiError("Betrieb nicht gefunden", 404);

  let lid: string | null = body.lid ? String(body.lid).trim().toLowerCase() : null;

  if (!session.sup) {
    // Verknüpfung serverseitig prüfen — dem Client wird nicht vertraut
    const { data: meRow } = await db.from("employees").select("linked_orgs").eq("id", session.eid!).maybeSingle();
    const link = (meRow?.linked_orgs || []).find((l: Any) => l.id === targetId);
    if (!link) throw new ApiError("Kein Zugriff auf diesen Betrieb", 403);
    lid = link.lid;
  }

  const { data: targetEmps } = await db.from("employees").select("*").eq("org_id", targetId);
  const acc = (targetEmps || []).find((e: Any) => lid && e.lid === lid)
    || (targetEmps || []).find((e: Any) => e.role === "owner")
    || (targetEmps || [])[0];
  if (!acc) throw new ApiError("Kein Account im Zielbetrieb", 404);

  const resp: Any = {
    org: mapOrg(targetOrg),
    emp: mapEmp(acc),
    data: await loadOrgData(targetId),
  };
  if (session.sup) {
    resp.orgs = await allOrgs(); // Super behält sein Token
  } else {
    resp.token = await signToken({ oid: targetId, eid: acc.id, role: acc.role, sup: false });
    resp.orgs = await orgsForEmp(targetId, acc.linked_orgs);
  }
  return ok(resp);
}

// Geräte-Token einer nativen App speichern (ein Token wandert mit dem Login mit)
async function actRegisterPush(body: Any, session: Session) {
  if (session.sup || !session.oid || !session.eid) return ok({ ok: true });
  const token = String(body.pushToken || "").trim();
  const platform = body.platform === "ios" ? "ios" : "android";
  if (!token) throw new ApiError("Push-Token fehlt", 400);
  const { error } = await db.from("push_tokens").upsert({
    token, org_id: session.oid, emp_id: session.eid, platform,
    updated_at: new Date().toISOString(),
  }, { onConflict: "token" });
  if (error) throw new ApiError("Push-Registrierung fehlgeschlagen: " + error.message, 500);
  return ok({ ok: true });
}

async function actUnregisterPush(body: Any, session: Session) {
  const token = String(body.pushToken || "").trim();
  if (token) await db.from("push_tokens").delete().eq("token", token).eq("emp_id", session.eid!);
  return ok({ ok: true });
}

// ─── HTTP-Handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new ApiError("Nur POST", 405);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const session = await verifyToken(token);

    switch (action) {
      case "login": return await actLogin(body);
      case "setup": return await actSetup(body, session);
      case "me": return await actMe(requireAuth(session));
      case "get": return await actGet(body, requireAuth(session));
      case "set": return await actSet(body, requireAuth(session));
      case "chpin": return await actChpin(body, requireAuth(session));
      case "link_org": return await actLinkOrg(body, requireAuth(session));
      case "unlink_org": return await actUnlinkOrg(body, requireAuth(session));
      case "switch_org": return await actSwitchOrg(body, requireAuth(session));
      case "register_push": return await actRegisterPush(body, requireAuth(session));
      case "unregister_push": return await actUnregisterPush(body, requireAuth(session));
      default: throw new ApiError(`Unbekannte Aktion: ${action}`, 400);
    }
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    const message = e instanceof ApiError ? e.message : "Interner Fehler";
    if (!(e instanceof ApiError)) console.error("api error:", e);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
