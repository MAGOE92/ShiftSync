// Lokaler Adapter (localStorage / window.storage) — Prototyp + Standalone + E2E.
// Implementiert dieselbe Schnittstelle wie der Supabase-Gateway-Client:
//   get/set/delete + login/setup/restore/switchOrg/linkOrg/unlinkOrg/chpin/logout
// Auth/Workflows laufen hier clientseitig (vertrauenswürdiger Einzelspeicher).
// PINs bleiben Klartext (getrimmt) — exakt das bisherige Verhalten.

import { SUPER_ADMIN_PW, DEFAULT_SHIFTS, DEFAULT_PERMS } from "../theme/constants.js";
import { orgCode } from "./orgCode.js";
import { rid } from "./utils.js";

// ─── rohe Speicher-Primitive (window.storage, Werte als JSON-Strings) ─────
const rawGet = async k => {
  try {
    const r = await window.storage.get(k);
    return r ? JSON.parse(r.value ?? r) : null;
  } catch { return null; }
};
const rawSet = async (k, v) => {
  try {
    if (v === null) await window.storage.delete(k);
    else await window.storage.set(k, JSON.stringify(v));
  } catch {}
};

// leichte In-Memory-Session (wer ist eingeloggt) — wird für link/unlink/chpin gebraucht
let session = null; // { orgId, empId } | null

const safeData = d => {
  const s = d || { emps: [], wishes: {}, scheds: {}, reqs: [] };
  if (!Array.isArray(s.reqs)) s.reqs = [];
  if (!Array.isArray(s.emps)) s.emps = [];
  if (!s.wishes) s.wishes = {};
  if (!s.scheds) s.scheds = {};
  if (!Array.isArray(s.notifs)) s.notifs = [];
  return s;
};

const db = {
  mode: "local",

  get: rawGet,
  set: rawSet,
  delete: async k => rawSet(k, null),

  // ── Auth/Workflows ──────────────────────────────────────────

  login: async (codeRaw, lidRaw, pinRaw) => {
    const code = String(codeRaw).trim().toUpperCase();
    const lid = String(lidRaw).trim().toLowerCase();
    const pin = String(pinRaw).trim();

    if (code === "ADMIN" && lid === "superadmin" && pin === SUPER_ADMIN_PW) {
      session = { orgId: null, empId: null, super: true };
      return { super: true, orgs: (await rawGet("orgs")) || [] };
    }

    const orgs = (await rawGet("orgs")) || [];
    const o = orgs.find(x => x.code === code);
    if (!o) throw new Error("Betriebs-ID nicht gefunden");

    const d = safeData(await rawGet(`org_${o.id}`));
    const byId = d.emps.find(e => String(e.lid).trim().toLowerCase() === lid);
    if (!byId) throw new Error(`Login-ID „${lid}" existiert in diesem Betrieb nicht`);
    if (String(byId.pin).trim() !== pin) throw new Error(`PIN falsch für ${byId.name}`);

    const st = o.status || "active";
    if (st === "suspended") throw new Error("Betrieb gesperrt – bitte Anbieter kontaktieren");
    if (st === "archived" && byId.role !== "owner") throw new Error("Dieser Betrieb ist offline gestellt");
    if (st === "trial" && o.trialEnds && o.trialEnds < Date.now()) throw new Error("Testzeitraum abgelaufen");

    session = { orgId: o.id, empId: byId.id };
    return { org: o, orgs, emp: byId, data: d };
  },

  setup: async payload => {
    const coName = String(payload.coName || "").trim();
    const coSub = String(payload.coSub || "").trim() || "Tankstelle · 24/7";
    const weekStdHours = Number(payload.weekStdHours) || 40;
    const name = String(payload.name || "").trim();
    const lid = String(payload.lid || "").trim().toLowerCase();
    const pin = String(payload.pin || "").trim();
    const asSuper = !!payload.asSuper;
    if (!coName || !name || !lid || pin.length < 4) throw new Error("Alle Felder, PIN ≥4");

    const code = orgCode(coName);
    const orgs = (await rawGet("orgs")) || [];
    if (orgs.some(o => o.code === code)) {
      throw new Error("Ein Betrieb mit diesem Namen existiert bereits – bitte einloggen.");
    }

    const newOrg = {
      id: rid(), code, name: coName, sub: coSub, weekStdHours,
      shifts: DEFAULT_SHIFTS, holidays: [], perms: DEFAULT_PERMS, createdAt: Date.now(),
      status: asSuper ? "active" : "trial",
      plan: asSuper ? "pro" : "trial",
      trialEnds: asSuper ? null : Date.now() + 14 * 864e5,
      accent: "#4f46e5",
    };
    const owner = { id: rid(), name, lid, pin, pref: "any", role: "owner", workPct: 100, inPlan: false, notes: "" };
    const orgList = [...orgs, newOrg];
    await rawSet("orgs", orgList);
    const data = { emps: [owner], wishes: {}, scheds: {}, reqs: [], notifs: [], clock: {}, market: [] };
    await rawSet(`org_${newOrg.id}`, data);

    if (!asSuper) session = { orgId: newOrg.id, empId: owner.id };
    return { super: asSuper, org: newOrg, emp: owner, data, orgs: orgList };
  },

  // lokal kein persistenter Login über Reload hinweg (wie bisher)
  restore: async () => null,

  switchOrg: async (targetId, lid) => {
    const orgs = (await rawGet("orgs")) || [];
    const o = orgs.find(x => x.id === targetId);
    if (!o) throw new Error("Betrieb nicht gefunden");
    const d = safeData(await rawGet(`org_${targetId}`));
    const acc = d.emps.find(e => e.lid === lid) || d.emps.find(e => e.role === "owner") || d.emps[0];
    if (!acc) throw new Error("Kein Account im Zielbetrieb");
    session = { orgId: targetId, empId: acc.id };
    return { org: o, orgs, emp: acc, data: d };
  },

  linkOrg: async (codeRaw, lidRaw, pinRaw) => {
    if (!session?.orgId) throw new Error("Nicht angemeldet");
    const code = String(codeRaw).trim().toUpperCase();
    const lid = String(lidRaw).trim().toLowerCase();
    const pin = String(pinRaw).trim();
    if (!code || !lid || !pin) throw new Error("Alle Felder ausfüllen");

    const orgs = (await rawGet("orgs")) || [];
    const target = orgs.find(x => x.code === code);
    if (!target) throw new Error("Betriebs-ID nicht gefunden");
    if (target.id === session.orgId) throw new Error("Das ist der aktuelle Betrieb");

    const td = safeData(await rawGet(`org_${target.id}`));
    const tacc = td.emps.find(e => e.lid === lid && String(e.pin).trim() === pin);
    if (!tacc) throw new Error("Login-ID oder PIN im Zielbetrieb falsch");
    if (!["owner", "director", "manager"].includes(tacc.role)) {
      throw new Error("Dieser Account darf dort nicht planen");
    }

    const myOrg = orgs.find(x => x.id === session.orgId);
    const myData = safeData(await rawGet(`org_${session.orgId}`));
    const me = myData.emps.find(e => e.id === session.empId);
    if (!me) throw new Error("Account existiert nicht mehr");

    const myLink = { id: target.id, code: target.code, name: target.name, lid: tacc.lid };
    const myNew = [...(me.linkedOrgs || []).filter(l => l.id !== target.id), myLink];
    myData.emps = myData.emps.map(e => e.id === me.id ? { ...e, linkedOrgs: myNew } : e);
    await rawSet(`org_${session.orgId}`, myData);

    const backLink = { id: myOrg.id, code: myOrg.code, name: myOrg.name, lid: me.lid };
    const tNew = [...(tacc.linkedOrgs || []).filter(l => l.id !== myOrg.id), backLink];
    td.emps = td.emps.map(e => e.id === tacc.id ? { ...e, linkedOrgs: tNew } : e);
    await rawSet(`org_${target.id}`, td);

    return { linkedOrgs: myNew, targetName: target.name, orgs };
  },

  unlinkOrg: async targetId => {
    if (!session?.orgId) throw new Error("Nicht angemeldet");
    const myData = safeData(await rawGet(`org_${session.orgId}`));
    const me = myData.emps.find(e => e.id === session.empId);
    if (!me) throw new Error("Account existiert nicht mehr");
    const myNew = (me.linkedOrgs || []).filter(l => l.id !== targetId);
    myData.emps = myData.emps.map(e => e.id === me.id ? { ...e, linkedOrgs: myNew } : e);
    await rawSet(`org_${session.orgId}`, myData);
    const orgs = (await rawGet("orgs")) || [];
    return { linkedOrgs: myNew, orgs };
  },

  chpin: async (cur, nw) => {
    if (!session?.orgId) throw new Error("Nicht angemeldet");
    const myData = safeData(await rawGet(`org_${session.orgId}`));
    const me = myData.emps.find(e => e.id === session.empId);
    if (!me) throw new Error("Account existiert nicht mehr");
    if (String(me.pin).trim() !== String(cur).trim()) throw new Error("Aktueller PIN falsch");
    const nwT = String(nw).trim();
    if (nwT.length < 4) throw new Error("≥4 Zeichen");
    myData.emps = myData.emps.map(e => e.id === me.id ? { ...e, pin: nwT } : e);
    await rawSet(`org_${session.orgId}`, myData);
    return { ok: true };
  },

  logout: () => { session = null; },

  subscribe: () => () => {},
};

export default db;
