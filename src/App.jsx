import { useState, useEffect, createContext, useContext } from "react";
import db from "./lib/storage.js";
import { orgCode } from "./lib/orgCode.js";
import { arbzgCheck } from "./lib/arbzg.js";
import { algo } from "./lib/algo.js";
import { rid, tms, nms, pm, isoDate, hoursOf, relTime, doICS, datesBetween } from "./lib/utils.js";
import {
  SH, SHIFT_COLORS, ROLES, ACCENTS, PLANS, STATUS,
  PERMS, DEFAULT_PERMS, DEFAULT_SHIFTS, MF, DW, PR,
} from "./theme/constants.js";
import { Icon } from "./theme/icons.jsx";
import LoginView from "./views/Login.jsx";
import SetupView from "./views/Setup.jsx";
import SuperConsoleView from "./views/SuperConsole.jsx";
import AdminView from "./views/admin/AdminView.jsx";
import EmpView from "./views/employee/EmpView.jsx";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [dark, setDark] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [cfg, setCfg] = useState({ selfSignup: false });
  const [orgId, setOrgId] = useState(null);
  const [data, setData] = useState({ emps: [], wishes: {}, scheds: {}, reqs: [] });
  const [view, setView] = useState("loading");
  const [me, setMe] = useState(null);
  const [isSuper, setIsSuper] = useState(false);
  const [wasSuper, setWasSuper] = useState(false);
  const [aTab, setATab] = useState("dash");
  const [eTab, setETab] = useState("home");
  const [msg, setMsg] = useState(null);
  const [planView, setPlanView] = useState("month");
  const [planDate, setPlanDate] = useState(isoDate(new Date()));
  const [empPlanView, setEmpPlanView] = useState("month");
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [reqFilter, setReqFilter] = useState("pending");

  const [lOrg, setLOrg] = useState(""); const [lId, setLId] = useState(""); const [lPin, setLPin] = useState("");
  const [wiz, setWiz] = useState({ coName: "", coSub: "Tankstelle · 24/7", weekStdHours: 40, name: "", lid: "", pin: "", plan: "free", email: "" });
  const [showOrgs, setShowOrgs] = useState(false);
  const [linkForm, setLinkForm] = useState({ code: "", lid: "", pin: "" });
  const [editE, setEditE] = useState(null); const [ef, setEf] = useState({});
  const [rstE, setRstE] = useState(null); const [rstP, setRstP] = useState("");
  const [orgEd, setOrgEd] = useState(null);
  const [editShift, setEditShift] = useState(null);
  const [showHoliday, setShowHoliday] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [editReq, setEditReq] = useState(null); const [decNote, setDecNote] = useState("");
  const [nef, setNef] = useState({ name: "", lid: "", pin: "", pref: "any", role: "staff", workPct: 100, inPlan: true });
  const [dragSh, setDragSh] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [planMo, setPlanMo] = useState(nms); const [genLoad, setGenLoad] = useState(false);
  const [editMode, setEditMode] = useState(false); const [draft, setDraft] = useState(null); const [paint, setPaint] = useState("");
  const [wishMonth, setWishMonth] = useState(nms); const [wsel, setWsel] = useState([]); const [wishNote, setWishNote] = useState("");
  const [rqForm, setRqForm] = useState({ type: "vac", dates: [], note: "", toId: "", toDate: "", fromDate: "", vacMonth: "" });
  const [rqTab, setRqTab] = useState("new");
  const [pinCh, setPinCh] = useState({ cur: "", nw: "", cf: "" });

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3400); };
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const isMobile = vw < 640;
  useEffect(() => { const h = () => setVw(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  useEffect(() => {
    if (document.getElementById("ss-fonts")) return;
    const l = document.createElement("link"); l.id = "ss-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Schibsted+Grotesk:wght@500;600;700;800&display=swap"; document.head.appendChild(l);
    const st = document.createElement("style"); st.id = "ss-style"; st.textContent = `
      *{font-family:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased;}
      h1,h2,h3{font-family:'Schibsted Grotesk','Hanken Grotesk',sans-serif!important;letter-spacing:-.02em;}
      table{font-variant-numeric:tabular-nums;}
      input,select,textarea,button{font-family:inherit;}
      input:focus,select:focus,textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,.18);}
      ::selection{background:rgba(99,102,241,.22);}
      *::-webkit-scrollbar{width:11px;height:11px;}
      *::-webkit-scrollbar-thumb{background:rgba(120,120,120,.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box;}
      *::-webkit-scrollbar-thumb:hover{background:rgba(120,120,120,.5);background-clip:padding-box;}
    `; document.head.appendChild(st);
  }, []);

  // Setzt den React-State aus einer Login/Setup/Restore-Antwort des Adapters.
  const applySession = r => {
    if (r.super) {
      setOrgs(r.orgs || []); setIsSuper(true); setWasSuper(false);
      setMe(null); setOrgId(null); setView("super"); return;
    }
    setOrgs(r.orgs || []); setIsSuper(false); setWasSuper(false);
    setOrgId(r.org.id); setData(r.data); setMe(r.emp);
    const rolePerms = (r.org.perms?.[r.emp.role]) || DEFAULT_PERMS[r.emp.role] || {};
    const isMgmt = r.emp.role === "owner" || r.emp.role === "director" || r.emp.role === "manager"
      || Object.values(rolePerms).some(v => v);
    if (isMgmt) { setView("admin"); setATab("dash"); } else { setView("emp"); setETab("home"); }
  };

  useEffect(() => {
    (async () => {
      const [d, c] = await Promise.all([db.get("dark"), db.get("config")]);
      if (d !== null) setDark(d);
      if (c) setCfg(c);
      // Bestehende Sitzung wiederherstellen (Gateway: via gespeichertem Token; lokal: immer null)
      try {
        const r = await db.restore?.();
        if (r) { applySession(r); return; }
      } catch { /* Token ungültig → normaler Login */ }
      // Keine Sitzung: nur im Lokal-Modus vorhandene Betriebe laden + Altdaten migrieren.
      // Im Gateway-Modus gibt es ohne Token keine globale Betriebsliste (Mandantentrennung).
      if (db.mode !== "supabase") {
        try {
          const o = await db.get("orgs");
          if (o && o.length) {
            let migrated = false;
            const migratedOrgs = o.map(x => {
              let nx = { ...x };
              if (!nx.code) { nx.code = orgCode(nx.name); migrated = true; }
              if (!nx.status) { nx.status = "active"; migrated = true; }
              if (!nx.plan) { nx.plan = "pro"; migrated = true; }
              return nx;
            });
            if (migrated) await db.set("orgs", migratedOrgs);
            setOrgs(migratedOrgs);
          }
        } catch { /* ignore */ }
      }
      setView("login");
    })();
  }, []);

  const loadOrgData = async (id) => {
    const d = await db.get(`org_${id}`);
    const safe = d || { emps: [], wishes: {}, scheds: {}, reqs: [] };
    if (!Array.isArray(safe.reqs)) safe.reqs = [];
    if (!Array.isArray(safe.emps)) safe.emps = [];
    if (!safe.wishes) safe.wishes = {};
    if (!safe.scheds) safe.scheds = {};
    if (!Array.isArray(safe.notifs)) safe.notifs = [];
    return safe;
  };

  useEffect(() => {
    if (!orgId) return;
    loadOrgData(orgId).then(setData);
  }, [orgId]);

  // Polling: alle 30s frische Daten holen (kein Realtime im Gateway-Modell).
  // Pausiert im Bearbeitungsmodus damit kein Draft überschrieben wird.
  useEffect(() => {
    if (!orgId || db.mode !== "supabase") return;
    const id = setInterval(() => {
      if (!editMode) loadOrgData(orgId).then(setData);
    }, 30000);
    return () => clearInterval(id);
  }, [orgId, editMode]);

  const saveOrgs = async o => { setOrgs(o); await db.set("orgs", o); };
  const updOrg = async (id, patch) => { await saveOrgs(orgs.map(o => o.id === id ? { ...o, ...patch } : o)); };
  const saveCfg = async c => { setCfg(c); await db.set("config", c); };
  const saveData = async d => { setData(d); await db.set(`org_${orgId}`, d); };
  const togDark = async () => { const d = !dark; setDark(d); await db.set("dark", d); };

  const org = orgs.find(o => o.id === orgId);
  const { emps, wishes, scheds, reqs } = data;
  const reqList = Array.isArray(reqs) ? reqs : [];
  const shiftDefs = org?.shifts || DEFAULT_SHIFTS;
  const weekStdHours = org?.weekStdHours || 40;
  const holidays = org?.holidays || [];
  const permsByRole = org?.perms || DEFAULT_PERMS;

  const T = dark
    ? { bg: "#0c0c0e", bg2: "#1a1a1d", bg3: "#070708", card: "#161618", bord: "#2a2a2e", bord2: "#3a3a40", tx: "#f4f4f1", tx2: "#9a9a93", inv: "#0c0c0e", invBg: "#f4f4f1", acc: "#8b87f5", accGrad: "#8b87f5", ok: "#10261c", okT: "#5fd9a0", er: "#2e1616", erT: "#f0888a", w: "#2b220e", wT: "#e8b14e", bl: "#181a33", blT: "#9aa0f7", pu: "#211a3a", puT: "#b9aef7" }
    : { bg: "#f0f0ed", bg2: "#e7e7e3", bg3: "#dcdcd6", card: "#ffffff", bord: "#deded8", bord2: "#cdcdc5", tx: "#1b1b19", tx2: "#6f6f68", inv: "#ffffff", invBg: "#1b1b19", acc: "#4f46e5", accGrad: "#4f46e5", ok: "#e3f4ea", okT: "#0b7048", er: "#fbe7e7", erT: "#bd3437", w: "#f7eed8", wT: "#8a5b13", bl: "#e7e8fa", blT: "#3a3aab", pu: "#ece6fc", puT: "#6238c4" };
  if (org?.accent) { T.acc = org.accent; T.accGrad = org.accent; }

  const orgPlan = PLANS[org?.plan || "pro"] || PLANS.pro;
  const orgStatus = org?.status || "active";
  const setOrgStatus = async (id, s) => { await saveOrgs(orgs.map(o => o.id === id ? { ...o, status: s } : o)); };
  const setOrgPlan = async (id, p) => { await saveOrgs(orgs.map(o => o.id === id ? { ...o, plan: p } : o)); };

  const getShiftInfo = key => {
    if (SH[key]) return { ...SH[key], label: SH[key].l };
    const def = shiftDefs.find(s => s.key === key);
    if (!def) return SH["-"];
    const col = SHIFT_COLORS[def.colorIdx || 0] || SHIFT_COLORS[0];
    return { ...col, label: def.label, start: def.start, end: def.end, l: def.label };
  };
  const shBg = k => { const i = getShiftInfo(k); return dark ? i.bgD : i.bg; };
  const shC = k => { const i = getShiftInfo(k); return dark ? i.cD : i.c; };
  const shX = k => getShiftInfo(k).x;
  const calcHours = row => { if (!row) return 0; const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s])); return row.reduce((sum, k) => { const d = SD[k]; return sum + (d ? hoursOf(d.start, d.end) : 0); }, 0); };
  const targetHours = (emp, days) => (weekStdHours * (emp.workPct || 100) / 100) * (days / 7);
  const fmtH = h => (Math.round(h * 10) / 10).toLocaleString("de-DE") + " h";

  const crd = { background: T.card, borderRadius: 14, border: `1px solid ${T.bord}`, padding: 18, boxShadow: dark ? "none" : "0 1px 2px rgba(20,20,20,.05),0 4px 12px rgba(20,20,20,.04)" };
  const inp = { padding: "10px 13px", borderRadius: 9, border: `1px solid ${T.bord2}`, fontSize: 14, outline: "none", background: T.bg, color: T.tx, width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11.5, color: T.tx2, display: "block", marginBottom: 5, marginTop: 12, fontWeight: 600, letterSpacing: .1 };
  const btn = (v = "p", sm) => ({ padding: sm ? "7px 12px" : "10px 17px", borderRadius: 9, fontWeight: 600, cursor: "pointer", fontSize: sm ? 12.5 : 14, letterSpacing: -.1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid", transition: "all .14s ease", background: v === "p" ? T.invBg : v === "ok" ? T.ok : v === "er" ? T.er : v === "w" ? T.w : v === "bl" ? T.bl : v === "pu" ? T.pu : T.card, color: v === "p" ? T.inv : v === "ok" ? T.okT : v === "er" ? T.erT : v === "w" ? T.wT : v === "bl" ? T.blT : v === "pu" ? T.puT : T.tx, borderColor: v === "p" ? "transparent" : v === "ok" ? T.okT + "33" : v === "er" ? T.erT + "33" : v === "w" ? T.wT + "33" : v === "bl" ? T.blT + "33" : v === "pu" ? T.puT + "33" : T.bord2, boxShadow: v === "p" && !dark ? "0 1px 2px rgba(20,20,20,.12)" : "none" });
  const tabBtn = a => ({ flex: 1, minWidth: 64, padding: "13px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: a ? 650 : 500, letterSpacing: -.1, whiteSpace: "nowrap", color: a ? T.acc : T.tx2, borderBottom: a ? `2px solid ${T.acc}` : "2px solid transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 });
  const ovl = { position: "fixed", inset: 0, zIndex: 9990, background: dark ? "rgba(0,0,0,.66)" : "rgba(28,28,26,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" };

  const initials = name => (name || "").trim().split(/\s+/).map(w => w[0] || "").slice(0, 2).join("").toUpperCase() || "·";
  const Logo = ({ size = 36, word = true, wordSize }) => <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: T.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: dark ? `0 0 0 1px ${T.acc}55` : `0 3px 10px ${T.acc}44` }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none"><rect x="8" y="11" width="17" height="4" rx="2" fill="#fff" /><rect x="11" y="21" width="17" height="4" rx="2" fill="#fff" opacity="0.7" /></svg>
    </div>
    {word && <div style={{ fontFamily: "'Schibsted Grotesk',sans-serif", fontWeight: 800, fontSize: wordSize || size * 0.52, letterSpacing: -.6, color: T.tx, lineHeight: 1 }}>ShiftSync</div>}
  </div>;
  const Avatar = ({ emp, size = 34 }) => { const role = ROLES[emp?.role || "staff"]; return <div title={role.l} style={{ width: size, height: size, borderRadius: size * 0.34, flexShrink: 0, background: role.col + (dark ? "33" : "1f"), color: role.col, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, letterSpacing: -.3, fontFamily: "'Schibsted Grotesk',sans-serif" }}>{initials(emp?.name)}</div>; };

  const can = p => { if (!me) return false; if (wasSuper) return true; if (me.role === "owner") return true; const rolePerms = permsByRole[me.role] || DEFAULT_PERMS[me.role] || {}; return !!rolePerms[p]; };
  const canManage = me && (wasSuper || me.role === "owner" || me.role === "director" || me.role === "manager");
  const isOwner = me?.role === "owner" || wasSuper;
  const seatLimit = orgPlan.maxEmps;
  const seatUsed = emps.length;
  const seatFull = seatUsed >= seatLimit;
  const canAuto = orgPlan.auto !== false;
  const trialDaysLeft = org?.trialEnds ? Math.ceil((org.trialEnds - Date.now()) / 864e5) : null;

  const allNotifs = Array.isArray(data.notifs) ? data.notifs : [];
  const myNotifs = me ? [...allNotifs].filter(n => n.uid === me.id).sort((a, b) => b.at - a.at) : [];
  const unreadCount = myNotifs.filter(n => !n.read).length;
  const buildNotifs = items => items.filter(it => it.uid && it.uid !== me?.id).map(it => ({ id: rid(), at: Date.now(), read: false, ...it }));
  const markAllRead = async () => { if (!me) return; await saveData({ ...data, notifs: allNotifs.map(n => n.uid === me.id ? { ...n, read: true } : n) }); };
  const markNotifRead = async id => { await saveData({ ...data, notifs: allNotifs.map(n => n.id === id ? { ...n, read: true } : n) }); };
  const clearMyNotifs = async () => { if (!me) return; await saveData({ ...data, notifs: allNotifs.filter(n => n.uid !== me.id) }); setShowNotifs(false); };
  const notifMeta = t => ({ decision_ok: ["check", T.ok, T.okT], decision_no: ["x", T.er, T.erT], newreq: ["inbox", T.bl, T.blT], swap: ["repeat", T.pu, T.puT], plan: ["calendar", T.bl, T.blT] }[t] || ["bell", T.bg2, T.tx2]);

  // ─── AUTH ───
  const doLogin = async () => {
    try {
      const r = await db.login(lOrg, lId, lPin);
      setLOrg(""); setLId(""); setLPin("");
      applySession(r);
    } catch (e) { flash("er", e.message || "Anmeldung fehlgeschlagen"); }
  };

  const doSetup = async () => {
    const ownerPin = wiz.pin.trim();
    const asSuper = isSuper;
    try {
      const r = await db.setup({ ...wiz, asSuper });
      setWiz({ coName: "", coSub: "Tankstelle · 24/7", weekStdHours: 40, name: "", lid: "", pin: "", plan: "free", email: "" });
      if (asSuper) {
        if (r.orgs) setOrgs(r.orgs); setView("super");
        flash("ok", `${r.org.name} angelegt · Betriebs-ID: ${r.org.code} · Login: ${r.emp.lid} / ${ownerPin}`);
      } else {
        applySession(r);
        flash("ok", `${r.org.name} eingerichtet · Betriebs-ID: ${r.org.code}`);
      }
    } catch (e) { flash("er", e.message || "Anlegen fehlgeschlagen"); }
  };
  const logout = () => { db.logout?.(); setMe(null); setOrgId(null); setIsSuper(false); setWasSuper(false); setData({ emps: [], wishes: {}, scheds: {}, reqs: [] }); setView("login"); };

  // ─── ADMIN ACTIONS ───
  const seedDemo = async () => { const free = seatLimit - seatUsed; if (free <= 0) { flash("er", `Sitzplatz-Limit erreicht (${seatLimit}) – Upgrade nötig.`); return; } const demo = [{ name: "Ben Schmidt", lid: "ben.schmidt", pin: "2222", pref: "any", role: "director", workPct: 100, inPlan: false }, { name: "Clara Weber", lid: "clara.weber", pin: "3333", pref: "any", role: "manager", workPct: 100, inPlan: true }, { name: "David Koch", lid: "david.koch", pin: "4444", pref: "any", role: "staff", workPct: 100, inPlan: true }, { name: "Eva Bauer", lid: "eva.bauer", pin: "5555", pref: "any", role: "staff", workPct: 75, inPlan: true }, { name: "Frank Huber", lid: "frank.huber", pin: "6666", pref: "FS", role: "staff", workPct: 50, inPlan: true }, { name: "Gabi Stern", lid: "gabi.stern", pin: "7777", pref: "noN", role: "staff", workPct: 100, inPlan: true }].slice(0, free).map(e => ({ ...e, id: rid(), notes: "" })); await saveData({ ...data, emps: [...emps, ...demo] }); flash("ok", `${demo.length} Demo-Mitarbeiter ✓${demo.length < 6 ? ` (Limit ${seatLimit})` : ""}`); };
  const addEmp = async () => { const pinT = nef.pin.trim(); if (!nef.name.trim() || !nef.lid.trim() || pinT.length < 4) { flash("er", "Name, ID, PIN (≥4)"); return; } if (seatFull) { flash("er", `Sitzplatz-Limit erreicht (${seatLimit}). Upgrade nötig.`); return; } const lid = nef.lid.trim().toLowerCase(); if (emps.some(e => e.lid === lid)) { flash("er", "Login-ID vergeben"); return; } const e = { id: rid(), ...nef, pin: pinT, name: nef.name.trim(), lid, workPct: Number(nef.workPct) || 100 }; await saveData({ ...data, emps: [...emps, e] }); setNef({ name: "", lid: "", pin: "", pref: "any", role: "staff", workPct: 100, inPlan: true }); flash("ok", `${e.name} angelegt · PIN ${e.pin}`); };
  const saveEf = async () => { if (!ef.name?.trim() || !ef.lid?.trim()) { flash("er", "Name und ID"); return; } const lid = ef.lid.trim().toLowerCase(); if (emps.some(e => e.id !== editE.id && e.lid === lid)) { flash("er", "ID vergeben"); return; } await saveData({ ...data, emps: emps.map(e => e.id === editE.id ? { ...e, ...ef, name: ef.name.trim(), lid, workPct: Number(ef.workPct) || 100 } : e) }); if (me?.id === editE.id) setMe(p => ({ ...p, ...ef })); setEditE(null); flash("ok", "Gespeichert ✓"); };
  const doRst = async () => { const pinT = rstP.trim(); if (pinT.length < 4) { flash("er", "≥4 Zeichen"); return; } await saveData({ ...data, emps: emps.map(e => e.id === rstE.id ? { ...e, pin: pinT } : e) }); flash("ok", `Neuer PIN: ${rstP}`); setRstE(null); setRstP(""); };
  const delEmp = async emp => { if (emp.id === me.id) { flash("er", "Dich selbst nicht löschen"); return; } if (emp.role === "owner") { flash("er", "Inhaber nicht löschbar"); return; } await saveData({ ...data, emps: emps.filter(e => e.id !== emp.id) }); flash("ok", `${emp.name} entfernt`); };
  const toggleInPlan = async emp => { const next = !(emp.inPlan !== false); await saveData({ ...data, emps: emps.map(e => e.id === emp.id ? { ...e, inPlan: next } : e) }); flash("ok", `${emp.name} ${next ? "wird im Dienstplan berücksichtigt" : "aus dem Dienstplan genommen"}`); };
  const switchToOrg = async (targetId, lid) => {
    try {
      const r = await db.switchOrg(targetId, lid);
      if (r.orgs) setOrgs(r.orgs);
      setOrgId(r.org.id); setData(r.data); setMe(r.emp); setShowOrgs(false); setATab("dash");
      flash("ok", `Gewechselt zu ${r.org.name}`);
    } catch (e) { flash("er", e.message || "Wechsel fehlgeschlagen"); }
  };
  const linkOrg = async () => {
    try {
      const r = await db.linkOrg(linkForm.code, linkForm.lid, linkForm.pin);
      if (r.orgs) setOrgs(r.orgs);
      setMe(p => ({ ...p, linkedOrgs: r.linkedOrgs }));
      setLinkForm({ code: "", lid: "", pin: "" });
      flash("ok", `${r.targetName} verknüpft`);
    } catch (e) { flash("er", e.message || "Verknüpfen fehlgeschlagen"); }
  };
  const unlinkOrg = async targetId => {
    try {
      const r = await db.unlinkOrg(targetId);
      if (r.orgs) setOrgs(r.orgs);
      setMe(p => ({ ...p, linkedOrgs: r.linkedOrgs }));
      flash("ok", "Verknüpfung entfernt");
    } catch (e) { flash("er", e.message || "Fehlgeschlagen"); }
  };

  const absMap = () => { const m = {}; reqList.filter(r => r.status === "ok").forEach(r => { if (!m[r.uid]) m[r.uid] = []; const { y, m0 } = pm(planMo); const dates = r.type === "vac" ? (r.dates || []) : r.type === "sick" ? (r.dates || (r.fromDate && r.toDate ? datesBetween(r.fromDate, r.toDate) : r.date ? [r.date] : [])) : []; dates.forEach(ds => { const d = new Date(ds); if (d.getFullYear() === y && d.getMonth() === m0) m[r.uid].push({ day: d.getDate(), type: r.type === "vac" ? "U" : "K" }); }); }); return m; };

  const createEmptyPlan = async () => { const { y, m0, days, lbl } = pm(planMo); const planEmps = emps.filter(e => e.inPlan !== false); if (!planEmps.length) { flash("er", "Keine Mitarbeiter im Plan"); return; } const absM = absMap(); const sc = {}; planEmps.forEach(e => { const row = Array(days).fill("-"); (absM[e.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) row[day - 1] = type; }); sc[e.id] = row; }); await saveData({ ...data, scheds: { ...scheds, [planMo]: sc } }); setDraft(JSON.parse(JSON.stringify(sc))); setPaint(shiftDefs[0]?.key || "-"); setEditMode(true); setATab("sched"); flash("ok", `Leerer Plan für ${lbl} angelegt · genehmigter Urlaub bereits eingetragen`); };

  const generate = async () => { if (!canAuto) { flash("er", "Automatische Planung ist ab Tarif Pro verfügbar"); return; } const planEmps = emps.filter(e => e.inPlan !== false); if (planEmps.length < 3) { flash("er", `Mind. 3 Mitarbeiter im Plan (aktuell: ${planEmps.length})`); return; } const { lbl: exLbl } = pm(planMo); if (scheds[planMo] && !confirm(`Für ${exLbl} existiert bereits ein Plan. Neu generieren und überschreiben?`)) return; setGenLoad(true); const { y, m0, lbl } = pm(planMo); const wm = {}; planEmps.forEach(e => { const arr = []; Object.entries(wishes).forEach(([k, v]) => { if (k.startsWith(planMo + "-") && k.endsWith(e.id) && v && Array.isArray(v.days)) v.days.forEach(d => arr.push(d)); }); wm[e.id] = arr; }); const absM = absMap(); const sc = algo(planEmps, wm, absM, y, m0, shiftDefs, weekStdHours); const dd = new Date(y, m0 + 1, 0).getDate(); let missing = 0; for (let d = 0; d < dd; d++) shiftDefs.forEach(s => { const c = planEmps.filter(e => (sc[e.id] || [])[d] === s.key).length; if (c < s.required) missing += s.required - c; }); await saveData({ ...data, scheds: { ...scheds, [planMo]: sc } }); setGenLoad(false); setEditMode(false); setDraft(null); setATab("sched"); missing > 0 ? flash("w", `Plan ${lbl} erstellt · ${missing} Schicht(en) unbesetzt – Stundenkontingente ausgeschöpft (rote Felder prüfen)`) : flash("ok", `Plan ${lbl} automatisch erstellt · ${planEmps.length} MA · Stundenkonten eingehalten`); };

  const paintKeys = () => [...shiftDefs.map(s => s.key), "U", "K", "-"];
  const paintCell = (id, d) => setDraft(p => { const row = p[id]; if (!row) return p; return { ...p, [id]: row.map((s, i) => i === d ? (paint || shiftDefs[0]?.key || "-") : s) }; });
  const moveShift = (fromId, fromDay, toId, toDay) => { if (fromId === toId && fromDay === toDay) { setDragSh(null); return; } setDraft(p => { const key = p[fromId]?.[fromDay]; if (!key || !shiftDefs.some(s => s.key === key)) return p; const np = {}; Object.keys(p).forEach(id => np[id] = [...p[id]]); np[fromId][fromDay] = "-"; if (np[toId]) np[toId][toDay] = key; return np; }); setDragSh(null); };
  const publishDraft = async () => { const { lbl } = pm(planMo); const planEmps = emps.filter(e => e.inPlan !== false); const viol = draft ? arbzgCheck(draft, planEmps, shiftDefs) : []; const crit = viol.filter(v => v.sev === "er"); if (crit.length && !confirm(`Achtung: ${crit.length} kritische ArbZG-Verstöße (Ruhezeit/Schichtlänge).\n\n${crit.slice(0, 4).map(v => `• ${v.name}, ${v.day + 1}.: ${v.msg}`).join("\n")}${crit.length > 4 ? "\n…" : ""}\n\nTrotzdem veröffentlichen?`)) return; const nt = buildNotifs(planEmps.map(e => ({ uid: e.id, type: "plan", text: `Neuer Dienstplan für ${lbl} ist online` }))); await saveData({ ...data, scheds: { ...scheds, [planMo]: draft }, notifs: [...allNotifs, ...nt] }); setEditMode(false); setDraft(null); flash("ok", "Veröffentlicht ✓ · Team benachrichtigt"); };

  const clockData = data.clock && typeof data.clock === "object" ? data.clock : {};
  const todayKey = isoDate(new Date());
  const myStamp = me ? clockData[todayKey]?.[me.id] : null;
  const doClock = async () => { const day = { ...(clockData[todayKey] || {}) }; const cur = day[me.id]; const isOut = !!(cur && cur.in && !cur.out); if (isOut) { day[me.id] = { ...cur, out: Date.now() }; } else { day[me.id] = { in: Date.now() }; } try { await saveData({ ...data, clock: { ...clockData, [todayKey]: day } }); flash("ok", isOut ? "Ausgestempelt ✓" : "Eingestempelt ✓"); } catch(e) { flash("er", "Stempeluhr: Speichern fehlgeschlagen — " + (e?.message || "Verbindungsfehler")); } };
  const istHoursMonth = (empId, moKey) => { let h = 0; Object.entries(clockData).forEach(([dk, day]) => { if (dk.startsWith(moKey) && day[empId]?.in && day[empId]?.out) h += (day[empId].out - day[empId].in) / 36e5; }); return h; };

  const exportPayroll = () => { const { y, m0, days, lbl } = pm(planMo); const sc = scheds[planMo] || {}; const abs = absMap(); const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s])); const rows = [["Personalnr", "Name", "Rolle", "Stellenumfang %", "Soll-Std", "Plan-Std", "Ist-Std (gestempelt)", "Urlaubstage", "Kranktage"]]; emps.filter(e => e.inPlan !== false).forEach(e => { const row = [...(sc[e.id] || Array(days).fill("-"))]; (abs[e.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) row[day - 1] = type; }); const planH = row.reduce((s, k) => { const d = SD[k]; return s + (d ? hoursOf(d.start, d.end) : 0); }, 0); const soll = (weekStdHours * (e.workPct || 100) / 100) * (days / 7); const ist = istHoursMonth(e.id, planMo); rows.push([e.lid, e.name, ROLES[e.role || "staff"].l, e.workPct || 100, soll.toFixed(1), planH.toFixed(1), ist.toFixed(1), row.filter(x => x === "U").length, row.filter(x => x === "K").length]); }); const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n"); const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Lohnexport_${planMo}.csv`; a.click(); flash("ok", `Lohn-Export ${lbl} erstellt`); };

  const market = Array.isArray(data.market) ? data.market : [];
  const offerShift = async (moKey, dayIdx, shKey) => { if (market.some(m => m.status === "open" && m.empId === me.id && m.mo === moKey && m.day === dayIdx)) { flash("er", "Bereits angeboten"); return; } const off = { id: rid(), mo: moKey, day: dayIdx, key: shKey, empId: me.id, empName: me.name, status: "open", at: Date.now() }; const mgrs = emps.filter(e => ["owner", "director", "manager"].includes(e.role)).map(m => ({ uid: m.id, type: "swap", text: `${me.name} bietet Schicht ${shKey} am ${dayIdx + 1}.${Number(moKey.slice(5, 7))}. in der Börse an` })); await saveData({ ...data, market: [...market, off], notifs: [...allNotifs, ...buildNotifs(mgrs)] }); flash("ok", "Schicht in die Börse gestellt"); };
  const withdrawOffer = async id => { await saveData({ ...data, market: market.filter(m => m.id !== id) }); flash("ok", "Angebot zurückgezogen"); };
  const takeShift = async off => { const sc = scheds[off.mo]; if (!sc || !sc[off.empId] || sc[off.empId][off.day] !== off.key) { flash("er", "Schicht existiert nicht mehr"); return; } if ((sc[me.id] || [])[off.day] && (sc[me.id] || [])[off.day] !== "-") { flash("er", "Du bist an dem Tag bereits eingeplant"); return; } const test = {}; Object.keys(sc).forEach(id => test[id] = [...sc[id]]); if (!test[me.id]) test[me.id] = Array(sc[off.empId].length).fill("-"); test[off.empId][off.day] = "-"; test[me.id][off.day] = off.key; const viol = arbzgCheck({ [me.id]: test[me.id] }, [me], shiftDefs).filter(v => v.sev === "er" && Math.abs(v.day - off.day) <= 1); if (viol.length) { flash("er", `Übernahme nicht möglich: ${viol[0].msg}`); return; } const nt = buildNotifs([{ uid: off.empId, type: "swap", text: `${me.name} hat deine Schicht ${off.key} am ${off.day + 1}. übernommen` }, ...emps.filter(e => ["owner", "director", "manager"].includes(e.role)).map(m => ({ uid: m.id, type: "swap", text: `Börse: ${off.key} am ${off.day + 1}. ging von ${off.empName} an ${me.name}` }))]); await saveData({ ...data, scheds: { ...scheds, [off.mo]: test }, market: market.map(m => m.id === off.id ? { ...m, status: "taken", takerId: me.id, takerName: me.name, takenAt: Date.now() } : m), notifs: [...allNotifs, ...nt] }); flash("ok", `Schicht übernommen ✓ (${off.key} am ${off.day + 1}.)`); };

  const handleReq = async (id, status, note) => { const req = reqList.find(r => r.id === id); const tL = { sick: "Krankmeldung", vac: "Urlaubsantrag", swap: "Schichttausch" }[req?.type] || "Anfrage"; const nt = buildNotifs(req ? [{ uid: req.uid, type: status === "ok" ? "decision_ok" : "decision_no", text: `${tL} ${status === "ok" ? "genehmigt ✓" : "abgelehnt"}${note ? ` · „${note}"` : ""}` }] : []); await saveData({ ...data, reqs: reqList.map(r => r.id === id ? { ...r, status, decidedAt: Date.now(), decidedBy: me.id, decisionNote: note || "" } : r), notifs: [...allNotifs, ...nt] }); setEditReq(null); setDecNote(""); flash("ok", status === "ok" ? "Genehmigt ✓" : "Abgelehnt"); };
  const saveOrgEdits = async () => { await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, ...orgEd } : o)); setOrgEd(null); flash("ok", "Betrieb gespeichert ✓"); };
  const setAccent = async c => { await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, accent: c } : o)); flash("ok", "Akzentfarbe übernommen"); };
  const setTimeclock = async v => { await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, timeclock: v } : o)); flash("ok", "Stempeluhr-Einstellung gespeichert ✓"); };
  const saveShift = async () => { const s = editShift; if (!s.label.trim() || !s.key.trim()) { flash("er", "Bezeichnung und Kürzel nötig"); return; } const newShifts = s.idx === undefined ? [...shiftDefs, s] : shiftDefs.map((x, i) => i === s.idx ? s : x); await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, shifts: newShifts } : o)); setEditShift(null); flash("ok", "Schichtmodell gespeichert ✓"); };
  const delShift = async idx => { const newShifts = shiftDefs.filter((_, i) => i !== idx); await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, shifts: newShifts } : o)); flash("ok", "Schichtmodell entfernt"); };
  const addHoliday = async () => { if (!holidayDate || !holidayName.trim()) { flash("er", "Datum und Name nötig"); return; } const newH = [...holidays, { date: holidayDate, name: holidayName.trim() }]; await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, holidays: newH } : o)); setHolidayDate(""); setHolidayName(""); flash("ok", "Sperrtag hinzugefügt ✓"); };
  const delHoliday = async idx => { const newH = holidays.filter((_, i) => i !== idx); await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, holidays: newH } : o)); flash("ok", "Sperrtag entfernt"); };
  const setPerm = async (role, perm, val) => { const newPerms = { ...(permsByRole), [role]: { ...(permsByRole[role] || {}), [perm]: val } }; await saveOrgs(orgs.map(o => o.id === orgId ? { ...o, perms: newPerms } : o)); };
  const printPlan = () => { const { y, m0, days, lbl: plbl } = pm(planMo); const sc = scheds[planMo]; if (!sc) { flash("er", "Kein Plan zum Drucken"); return; } const abs = absMap(); const planEmps2 = emps.filter(e => e.inPlan !== false); const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s])); const w = window.open("", "_blank"); if (!w) { flash("er", "Popup-Blocker aktiv? Bitte erlauben."); return; } const rows = planEmps2.map(emp => { const row = [...(sc[emp.id] || Array(days).fill("-"))]; (abs[emp.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) row[day - 1] = type; }); const tot = row.filter(s => SD[s]).length; return { emp, row, tot }; }); const colorFor = k => { if (k === "U") return "#fef3c7"; if (k === "K") return "#fee2e2"; if (k === "-") return "#f8fafc"; const def = SD[k]; if (!def) return "#fff"; const c = SHIFT_COLORS[def.colorIdx || 0]; return c.bg; }; const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dienstplan ${plbl}</title><style>@page{size:A4 landscape;margin:1cm;}body{font-family:Arial,sans-serif;margin:0;padding:14px;color:#0f172a;}h1{font-size:18px;margin:0 0 4px;}.sub{color:#64748b;font-size:11px;margin:0 0 14px;}table{border-collapse:collapse;width:100%;font-size:9px;}th{background:#0f172a;color:#fff;padding:5px 4px;text-align:center;border:1px solid #1e293b;}th.name{text-align:left;padding-left:8px;min-width:120px;}td{border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-weight:700;}td.name{text-align:left;padding:4px 8px;font-weight:600;}td.we{background:#f1f5f9;}.sum{font-weight:800;background:#f8fafc;}.legend{margin-top:12px;font-size:10px;color:#64748b;display:flex;gap:14px;flex-wrap:wrap;}.legend span{display:inline-flex;align-items:center;gap:4px;}.swatch{display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid #cbd5e1;}.foot{margin-top:14px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;}@media print{button{display:none;}}.printbtn{position:fixed;top:10px;right:10px;padding:10px 18px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;}</style></head><body><button class="printbtn" onclick="window.print()">Drucken</button><h1>Dienstplan ${plbl} — ${org.name}</h1><p class="sub">Betriebs-ID: ${org.code} · Erstellt: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p><table><thead><tr><th class="name">Mitarbeiter</th>${Array.from({ length: days }, (_, i) => { const dow = new Date(y, m0, i + 1).getDay(); const dn = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dow]; return `<th>${dn}<br>${i + 1}</th>`; }).join("")}<th>Σ</th></tr></thead><tbody>${rows.map(({ emp, row, tot }) => { const role = ROLES[emp.role || "staff"]; return `<tr><td class="name">${role.ic} ${emp.name} <span style="font-size:8px;color:#94a3b8;font-weight:400">${emp.workPct || 100}%</span></td>${row.map((sh, i) => { const dow = new Date(y, m0, i + 1).getDay(); const we = dow === 0 || dow === 6; const bg = colorFor(sh); return `<td class="${we ? "we" : ""}" style="background:${bg}">${sh === "-" ? "" : sh}</td>`; }).join("")}<td class="sum">${tot}</td></tr>`; }).join("")}</tbody></table><div class="legend">${shiftDefs.map(s => `<span><span class="swatch" style="background:${SHIFT_COLORS[s.colorIdx || 0].bg}"></span> ${s.key} = ${s.label} ${s.start}–${s.end}</span>`).join("")}<span><span class="swatch" style="background:#fef3c7"></span> U = Urlaub</span><span><span class="swatch" style="background:#fee2e2"></span> K = Krank</span></div><div class="foot"><span>ShiftSync Pro · ${org.name}</span><span>Seite 1 von 1</span></div><script>setTimeout(()=>window.print(),500);</script></body></html>`; w.document.write(html); w.document.close(); };
  const startCheckout = async plan => {
    try {
      flash("ok", "Checkout wird vorbereitet…");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          org_id: orgId, plan,
          success_url: window.location.origin,
          cancel_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else flash("er", data.error || "Checkout fehlgeschlagen");
    } catch { flash("er", "Checkout fehlgeschlagen"); }
  };

  const exportCSV = () => { const { y, m0, days, lbl: plbl } = pm(planMo); const sc = scheds[planMo]; if (!sc) { flash("er", "Kein Plan zum Exportieren"); return; } const abs = absMap(); const planEmps2 = emps.filter(e => e.inPlan !== false); const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s])); let csv = "Mitarbeiter;Rolle;Stelle %;" + Array.from({ length: days }, (_, i) => `${i + 1}.`).join(";") + ";Arbeitstage\n"; planEmps2.forEach(emp => { const row = [...(sc[emp.id] || Array(days).fill("-"))]; (abs[emp.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) row[day - 1] = type; }); const tot = row.filter(s => SD[s]).length; csv += `${emp.name};${ROLES[emp.role || "staff"].l};${emp.workPct || 100};${row.map(s => s === "-" ? "" : s).join(";")};${tot}\n`; }); const a = document.createElement("a"); a.href = `data:text/csv;charset=utf-8,﻿${encodeURIComponent(csv)}`; a.download = `Dienstplan_${plbl.replace(" ", "_")}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); flash("ok", "CSV exportiert ✓"); };

  // ─── EMP ACTIONS ───
  const saveWishes = async () => { const key = `${wishMonth}-${me.id}`; await saveData({ ...data, wishes: { ...wishes, [key]: { days: wsel, note: wishNote, at: Date.now() } } }); flash("ok", "Wunschfrei-Tage gespeichert ✓"); };
  const togWish = d => { if (wsel.includes(d)) setWsel(wsel.filter(x => x !== d)); else if (wsel.length < 3) setWsel([...wsel, d]); else flash("er", "Max. 3 Tage"); };
  const loadWishes = mo => { const key = `${mo}-${me.id}`; const w = wishes[key]; if (w && typeof w === "object" && Array.isArray(w.days)) { setWsel(w.days); setWishNote(w.note || ""); } else if (Array.isArray(w)) { setWsel(w); setWishNote(""); } else { setWsel([]); setWishNote(""); } };
  const savePref = async p => { await saveData({ ...data, emps: emps.map(e => e.id === me.id ? { ...e, pref: p } : e) }); setMe(x => ({ ...x, pref: p })); flash("ok", "Gespeichert ✓"); };
  const doChPin = async () => {
    if (pinCh.nw.length < 4) { flash("er", "≥4 Zeichen"); return; }
    if (pinCh.nw !== pinCh.cf) { flash("er", "PINs ungleich"); return; }
    try {
      await db.chpin(pinCh.cur, pinCh.nw);
      if (db.mode !== "supabase") {
        setMe(p => ({ ...p, pin: pinCh.nw }));
        setData(d => ({ ...d, emps: (d.emps || []).map(e => e.id === me.id ? { ...e, pin: pinCh.nw } : e) }));
      }
      setPinCh({ cur: "", nw: "", cf: "" });
      flash("ok", "PIN geändert ✓");
    } catch (e) { flash("er", e.message || "PIN-Änderung fehlgeschlagen"); }
  };
  const cancelRq = async (reqId) => { await saveData({ ...data, reqs: reqList.map(r => r.id === reqId ? { ...r, status: "cancelled" } : r) }); flash("ok", "Anfrage zurückgezogen"); };
  const revokeVac = async (reqId) => {
    if (!confirm("Genehmigten Urlaub wirklich stornieren? Die Führungskraft wird informiert und muss den Plan ggf. anpassen.")) return;
    const mgrs = emps.filter(e => ["owner", "director", "manager"].includes(e.role));
    const nt = buildNotifs(mgrs.map(m => ({ uid: m.id, type: "newreq", text: `${me.name} hat genehmigten Urlaub storniert — Dienstplan prüfen` })));
    await saveData({ ...data, reqs: reqList.map(r => r.id === reqId ? { ...r, status: "cancelled" } : r), notifs: [...allNotifs, ...nt] });
    flash("ok", "Stornierung gemeldet — Führungskraft wird benachrichtigt");
  };
  const submitRq = async () => { const r = { id: rid(), type: rqForm.type, uid: me.id, status: "pending", at: Date.now(), note: rqForm.note }; if (rqForm.type === "sick") { if (!rqForm.fromDate) { flash("er", "Datum"); return; } r.fromDate = rqForm.fromDate; r.toDate = rqForm.toDate || rqForm.fromDate; r.dates = datesBetween(r.fromDate, r.toDate); } else if (rqForm.type === "vac") { if (!rqForm.dates.length) { flash("er", "Tage wählen"); return; } r.dates = rqForm.dates; } else if (rqForm.type === "swap") { if (!rqForm.fromDate || !rqForm.toId || !rqForm.toDate) { flash("er", "Alle Felder"); return; } r.date = rqForm.fromDate; r.toId = rqForm.toId; r.toDate = rqForm.toDate; } const tL2 = { sick: "Krankmeldung", vac: "Urlaubsantrag", swap: "Schichttausch" }[r.type]; const mgrs = emps.filter(e => e.role === "owner" || e.role === "director" || e.role === "manager").map(m => ({ uid: m.id, type: "newreq", text: `Neue ${tL2}-Anfrage von ${me.name}` })); const swapN = r.type === "swap" && r.toId ? [{ uid: r.toId, type: "swap", text: `${me.name} möchte mit dir tauschen: ${r.date} ↔ ${r.toDate}` }] : []; const nt = buildNotifs([...mgrs, ...swapN]); await saveData({ ...data, reqs: [...reqList, r], notifs: [...allNotifs, ...nt] }); setRqForm({ type: "vac", dates: [], note: "", toId: "", toDate: "", fromDate: "", vacMonth: "" }); flash("ok", "Anfrage gesendet ✓"); setRqTab("sent"); };

  const today = new Date(), cm = tms(), nm = nms();
  const { y: cy, m0: cm0 } = pm(cm); const { y: ny, m0: nm0, days: nmD } = pm(nm);
  const pendCount = reqList.filter(r => r.status === "pending").length;

  const Header = (title, sub, right) => <div style={{ padding: isMobile ? "10px 13px" : "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${T.bord}`, background: T.card, position: "sticky", top: 0, zIndex: 10 }}><div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontSize: 9, color: T.tx2, letterSpacing: .8, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div><div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 16, color: T.tx }}>{title}</div></div><div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>{right}</div></div>;
  const TabBar = (tabs, active, onCh) => <div style={{ display: "flex", background: T.card, borderBottom: `1px solid ${T.bord}`, overflowX: "auto" }}>{tabs.map(([k, l, ic]) => <button key={k} style={tabBtn(active === k)} onClick={() => onCh(k)}>{ic && <Icon n={ic} s={15} />}{l}</button>)}</div>;

  const Tst = msg && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "11px 20px", borderRadius: 12, fontWeight: 600, fontSize: 13, maxWidth: 340, textAlign: "center", border: "1px solid", background: msg.type === "ok" ? T.ok : T.er, color: msg.type === "ok" ? T.okT : T.erT, borderColor: (msg.type === "ok" ? T.okT : T.erT) + "40", boxShadow: "0 8px 24px rgba(0,0,0,.15)" }}>{msg.text}</div>;
  const DarkBtn = <button onClick={togDark} style={{ ...btn("s", true), padding: "7px 10px" }} title="Hell/Dunkel">{dark ? <Icon n="sun" /> : <Icon n="moon" />}</button>;

  const notifMeta2 = t => ({ decision_ok: ["check", T.ok, T.okT], decision_no: ["x", T.er, T.erT], newreq: ["inbox", T.bl, T.blT], swap: ["repeat", T.pu, T.puT], plan: ["calendar", T.bl, T.blT] }[t] || ["bell", T.bg2, T.tx2]);
  const NotifBell = me && <button onClick={() => setShowNotifs(true)} style={{ ...btn("s", true), padding: "7px 10px", position: "relative" }} title="Benachrichtigungen"><Icon n="bell" />{unreadCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${T.card}` }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>;
  const NotifPanel = showNotifs && me && <div style={ovl} onClick={() => setShowNotifs(false)}>
    <div style={{ ...crd, width: "100%", maxWidth: 420, maxHeight: "82vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 16px", borderBottom: `1px solid ${T.bord}` }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}><Icon n="bell" s={17} />Benachrichtigungen</h3>
        {unreadCount > 0 && <span style={{ fontSize: 11, background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>{unreadCount} neu</span>}
        <button style={{ ...btn("s", true), padding: "5px 9px", marginLeft: "auto" }} onClick={() => setShowNotifs(false)}><Icon n="x" s={15} /></button>
      </div>
      <div style={{ padding: "10px 16px", display: "flex", gap: 8, borderBottom: `1px solid ${T.bord}`, flexWrap: "wrap" }}>
        <button style={{ ...btn("s", true), opacity: unreadCount ? 1 : .5 }} onClick={markAllRead} disabled={!unreadCount}><Icon n="check" s={14} />Alle gelesen</button>
        <button style={{ ...btn("s", true), opacity: myNotifs.length ? 1 : .5 }} onClick={clearMyNotifs} disabled={!myNotifs.length}><Icon n="trash" s={14} />Leeren</button>
      </div>
      <div style={{ overflowY: "auto", padding: "10px 16px 16px" }}>
        {!myNotifs.length && <p style={{ color: T.tx2, textAlign: "center", padding: "30px 0", margin: 0, fontSize: 13 }}>Keine Benachrichtigungen.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {myNotifs.map(n => { const [ic, bg, col] = notifMeta2(n.type); return (<div key={n.id} onClick={() => !n.read && markNotifRead(n.id)} style={{ display: "flex", gap: 11, padding: "11px 12px", background: n.read ? T.bg2 : bg, borderRadius: 11, cursor: n.read ? "default" : "pointer", border: `1px solid ${n.read ? T.bord : col + "33"}` }}><div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: n.read ? T.card : T.card + "", color: col, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n={ic} s={16} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: n.read ? T.tx : col }}>{n.text}</div><div style={{ fontSize: 10, color: T.tx2, marginTop: 2 }}>{relTime(n.at)}</div></div>{!n.read && <div style={{ width: 9, height: 9, borderRadius: 5, background: "#ef4444", flexShrink: 0, marginTop: 3 }} />}</div>); })}
        </div>
      </div>
    </div>
  </div>;

  const ctx = {
    // State
    dark, orgs, orgId, data, view, me, isSuper, wasSuper, aTab, eTab, msg,
    planView, planDate, empPlanView, filterEmp, filterShift, reqFilter,
    lOrg, lId, lPin, wiz, showOrgs, linkForm, editE, ef, rstE, rstP,
    orgEd, editShift, showHoliday, holidayDate, holidayName, editReq, decNote,
    nef, dragSh, showNotifs, planMo, genLoad, editMode, draft, paint,
    wishMonth, wsel, wishNote, rqForm, rqTab, pinCh,
    // Setters
    setDark, setOrgs, setOrgId, setData, setView, setMe, setIsSuper, setWasSuper,
    setATab, setETab, setPlanView, setPlanDate, setEmpPlanView, setFilterEmp,
    setFilterShift, setReqFilter, setLOrg, setLId, setLPin, setWiz, setShowOrgs,
    setLinkForm, setEditE, setEf, setRstE, setRstP, setOrgEd, setEditShift,
    setShowHoliday, setHolidayDate, setHolidayName, setEditReq, setDecNote,
    setNef, setDragSh, setShowNotifs, setPlanMo, setGenLoad, setEditMode,
    setDraft, setPaint, setWishMonth, setWsel, setWishNote, setRqForm, setRqTab, setPinCh,
    // Computed
    org, emps, wishes, scheds, reqs: reqList, shiftDefs, weekStdHours, holidays,
    permsByRole, orgPlan, orgStatus, seatLimit, seatUsed, seatFull, canAuto, trialDaysLeft,
    allNotifs, myNotifs, unreadCount, today, cm, nm, cy, cm0, ny, nm0, nmD, pendCount,
    market, clockData, myStamp, isMobile,
    // Actions
    flash, saveOrgs, updOrg, saveCfg, saveData, togDark, logout, doLogin, doSetup,
    refreshData: () => orgId && loadOrgData(orgId).then(d => { setData(d); flash("ok", "Aktualisiert ✓"); }),
    seedDemo, addEmp, saveEf, doRst, delEmp, toggleInPlan, switchToOrg, linkOrg, unlinkOrg,
    absMap, createEmptyPlan, generate, paintKeys, paintCell, moveShift, publishDraft,
    doClock, istHoursMonth, exportPayroll, offerShift, withdrawOffer, takeShift,
    handleReq, saveOrgEdits, setAccent, setTimeclock, saveShift, delShift, addHoliday, delHoliday,
    setPerm, printPlan, exportCSV, saveWishes, togWish, loadWishes, savePref, doChPin, submitRq, cancelRq, revokeVac,
    buildNotifs, markAllRead, markNotifRead, clearMyNotifs,
    setOrgStatus, setOrgPlan, startCheckout,
    // Style helpers
    T, crd, inp, lbl, btn, tabBtn, ovl,
    // UI helpers
    getShiftInfo, shBg, shC, shX, calcHours, targetHours, fmtH,
    can, canManage, isOwner, initials,
    // Shared UI
    Logo, Avatar, Tst, DarkBtn, NotifBell, NotifPanel, Header, TabBar,
    // Re-exported constants
    ROLES, PLANS, STATUS, PERMS, DEFAULT_PERMS, SHIFT_COLORS, SH, ACCENTS, MF, DW, PR,
    // Lib functions
    hoursOf, relTime, doICS, pm, nms, tms, rid, isoDate,
    arbzgCheck,
    db,
  };

  return (
    <AppCtx.Provider value={ctx}>
      {view === "loading" && <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.tx2 }}>Lädt…</div>}
      {view === "super" && isSuper && <SuperConsoleView />}
      {view === "setup" && <SetupView />}
      {view === "login" && <LoginView />}
      {view === "admin" && me && org && <AdminView />}
      {view === "emp" && me && org && <EmpView />}
      {!["loading", "super", "setup", "login", "admin", "emp"].includes(view) && <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.tx2 }}>…</div>}
    </AppCtx.Provider>
  );
}
