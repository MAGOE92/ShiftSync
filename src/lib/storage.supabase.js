// Supabase Storage Adapter
// Gleiche get/set/delete-Signatur wie storage.local.js.
// Mappt die flachen Keys (orgs, org_{id}, dark, config) auf die normalisierten Tabellen.

import { supabase } from "./supabase.js";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const isoDay = d => d.toISOString().slice(0, 10);

// Konvertiert einen DB-Org-Row in das Format, das die App erwartet.
function dbOrgToApp(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sub: row.sub,
    weekStdHours: row.week_std_hours,
    shifts: row.shifts || [],
    holidays: row.holidays || [],
    perms: row.perms || {},
    status: row.status,
    plan: row.plan,
    trialEnds: row.trial_ends ? new Date(row.trial_ends).getTime() : null,
    accent: row.accent,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Konvertiert App-Org in DB-Format (für UPSERT)
function appOrgToDb(o) {
  return {
    id: o.id,
    code: o.code,
    name: o.name,
    sub: o.sub || 'Tankstelle · 24/7',
    week_std_hours: o.weekStdHours || 40,
    shifts: o.shifts || [],
    holidays: o.holidays || [],
    perms: o.perms || {},
    status: o.status || 'trial',
    plan: o.plan || 'trial',
    trial_ends: o.trialEnds ? new Date(o.trialEnds).toISOString() : null,
    accent: o.accent || '#4f46e5',
  };
}

// Konvertiert DB-Employee in App-Format
function dbEmpToApp(row) {
  return {
    id: row.id,
    name: row.name,
    lid: row.lid,
    pin: row.pin_hash,          // App arbeitet intern mit "pin" — hash bleibt opaque für UI-Vergleich
    role: row.role,
    workPct: row.work_pct,
    pref: row.pref,
    inPlan: row.in_plan,
    notes: row.notes || '',
    linkedOrgs: row.linked_orgs || [],
  };
}

// ─── Haupt-Adapter ────────────────────────────────────────────────────────────

const db = {

  get: async key => {
    // ── Dark-Mode & Config: localStorage ──────────────────────────
    if (key === 'dark' || key === 'config') {
      try { return JSON.parse(localStorage.getItem(`ss_${key}`) ?? 'null'); } catch { return null; }
    }

    // ── orgs: alle Betriebe ───────────────────────────────────────
    if (key === 'orgs') {
      const { data, error } = await supabase.from('orgs').select('*').order('created_at');
      if (error) { console.error('storage.get(orgs):', error); return null; }
      return data.map(dbOrgToApp);
    }

    // ── org_{id}: Betriebsdaten ───────────────────────────────────
    if (key.startsWith('org_')) {
      const orgId = key.slice(4);

      const [empsR, schedsR, reqsR, notifsR, clockR, marketR, wishesR] = await Promise.all([
        supabase.from('employees').select('*').eq('org_id', orgId).order('created_at'),
        supabase.from('schedules').select('*').eq('org_id', orgId),
        supabase.from('requests').select('*').eq('org_id', orgId).order('created_at'),
        supabase.from('notifications').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('clock_entries').select('*').eq('org_id', orgId),
        supabase.from('market_offers').select('*').eq('org_id', orgId).order('created_at'),
        supabase.from('wishes').select('*').eq('org_id', orgId),
      ]);

      const emps = (empsR.data || []).map(dbEmpToApp);

      // schedules: { 'YYYY-MM': { empId: [slots] } }
      const scheds = {};
      (schedsR.data || []).forEach(r => { scheds[r.month] = r.data; });

      // requests: flache Liste mit uid statt emp_id
      const reqs = (reqsR.data || []).map(r => ({
        id: r.id,
        type: r.type,
        uid: r.emp_id,
        status: r.status,
        at: new Date(r.created_at).getTime(),
        decidedAt: r.decided_at ? new Date(r.decided_at).getTime() : undefined,
        decidedBy: r.decided_by,
        decisionNote: r.decision_note || '',
        ...r.payload,
      }));

      // notifs
      const notifs = (notifsR.data || []).map(n => ({
        id: n.id,
        uid: n.emp_id,
        type: n.type,
        text: n.text,
        read: n.read,
        at: new Date(n.created_at).getTime(),
      }));

      // clock: { 'YYYY-MM-DD': { empId: { in: ms, out: ms } } }
      const clock = {};
      (clockR.data || []).forEach(c => {
        const day = isoDay(new Date(c.day));
        if (!clock[day]) clock[day] = {};
        clock[day][c.emp_id] = {
          in: c.clock_in ? new Date(c.clock_in).getTime() : undefined,
          out: c.clock_out ? new Date(c.clock_out).getTime() : undefined,
        };
      });

      // market
      const market = (marketR.data || []).map(m => ({
        id: m.id,
        mo: m.month,
        day: m.day,
        key: m.shift_key,
        empId: m.emp_id,
        empName: (emps.find(e => e.id === m.emp_id) || {}).name || '',
        status: m.status,
        takerId: m.taker_id,
        takerName: (emps.find(e => e.id === m.taker_id) || {}).name || '',
        takenAt: m.taken_at ? new Date(m.taken_at).getTime() : undefined,
        at: new Date(m.created_at).getTime(),
      }));

      // wishes: { 'YYYY-MM-empId': { days: [], note: '' } }
      const wishes = {};
      (wishesR.data || []).forEach(w => {
        wishes[`${w.month}-${w.emp_id}`] = { days: w.days || [], note: w.note || '' };
      });

      return { emps, scheds, reqs, notifs, clock, market, wishes };
    }

    return null;
  },

  set: async (key, value) => {
    // ── Dark-Mode & Config: localStorage ──────────────────────────
    if (key === 'dark' || key === 'config') {
      if (value === null) localStorage.removeItem(`ss_${key}`);
      else localStorage.setItem(`ss_${key}`, JSON.stringify(value));
      return;
    }

    // ── orgs: Betriebe upserten ───────────────────────────────────
    if (key === 'orgs') {
      if (!value || !value.length) return;
      const rows = value.map(appOrgToDb);
      const { error } = await supabase.from('orgs').upsert(rows, { onConflict: 'id' });
      if (error) console.error('storage.set(orgs):', error);
      return;
    }

    // ── org_{id}: Betriebsdaten zerlegen und in Tabellen schreiben ─
    if (key.startsWith('org_')) {
      const orgId = key.slice(4);
      if (!value) return;

      const { emps = [], scheds = {}, reqs = [], notifs = [], clock = {}, market = [], wishes = {} } = value;

      // employees upserten (pin als hash behandeln — bereits bcrypt oder Klartext aus Migration)
      if (emps.length) {
        const empRows = emps.map(e => ({
          id: e.id,
          org_id: orgId,
          name: e.name,
          lid: e.lid,
          pin_hash: e.pin,       // Supabase Edge Function hasht beim Anlegen/Ändern
          role: e.role || 'staff',
          work_pct: e.workPct || 100,
          pref: e.pref || 'any',
          in_plan: e.inPlan !== false,
          notes: e.notes || '',
          linked_orgs: e.linkedOrgs || [],
        }));
        const { error } = await supabase.from('employees').upsert(empRows, { onConflict: 'id' });
        if (error) console.error('storage.set employees:', error);
      }

      // schedules upserten
      const schedRows = Object.entries(scheds).map(([month, data]) => ({
        org_id: orgId, month, data,
      }));
      if (schedRows.length) {
        const { error } = await supabase.from('schedules').upsert(schedRows, { onConflict: 'org_id,month' });
        if (error) console.error('storage.set schedules:', error);
      }

      // requests: nur neue einfügen (bestehende nicht überschreiben)
      if (reqs.length) {
        const reqRows = reqs.map(r => ({
          id: r.id,
          org_id: orgId,
          emp_id: r.uid,
          type: r.type,
          status: r.status || 'pending',
          decided_by: r.decidedBy || null,
          decided_at: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
          decision_note: r.decisionNote || '',
          payload: {
            dates: r.dates,
            fromDate: r.fromDate,
            toDate: r.toDate,
            toId: r.toId,
            date: r.date,
            note: r.note,
          },
        }));
        const { error } = await supabase.from('requests').upsert(reqRows, { onConflict: 'id' });
        if (error) console.error('storage.set requests:', error);
      }

      // notifications upserten
      if (notifs.length) {
        const notifRows = notifs.map(n => ({
          id: n.id,
          org_id: orgId,
          emp_id: n.uid,
          type: n.type,
          text: n.text,
          read: n.read || false,
        }));
        const { error } = await supabase.from('notifications').upsert(notifRows, { onConflict: 'id' });
        if (error) console.error('storage.set notifications:', error);
      }

      // clock_entries
      const clockRows = [];
      Object.entries(clock).forEach(([dayStr, byEmp]) => {
        Object.entries(byEmp).forEach(([empId, stamp]) => {
          if (stamp?.in || stamp?.out) {
            clockRows.push({
              org_id: orgId,
              emp_id: empId,
              day: dayStr,
              clock_in: stamp.in ? new Date(stamp.in).toISOString() : null,
              clock_out: stamp.out ? new Date(stamp.out).toISOString() : null,
            });
          }
        });
      });
      if (clockRows.length) {
        const { error } = await supabase.from('clock_entries').upsert(clockRows, { onConflict: 'org_id,emp_id,day' });
        if (error) console.error('storage.set clock_entries:', error);
      }

      // market_offers
      if (market.length) {
        const marketRows = market.map(m => ({
          id: m.id,
          org_id: orgId,
          emp_id: m.empId,
          month: m.mo,
          day: m.day,
          shift_key: m.key,
          status: m.status || 'open',
          taker_id: m.takerId || null,
          taken_at: m.takenAt ? new Date(m.takenAt).toISOString() : null,
        }));
        const { error } = await supabase.from('market_offers').upsert(marketRows, { onConflict: 'id' });
        if (error) console.error('storage.set market_offers:', error);
      }

      // wishes
      const wishRows = Object.entries(wishes).map(([k, v]) => {
        const parts = k.split('-');
        const empId = parts[parts.length - 1];
        const month = parts.slice(0, 2).join('-');
        const days = Array.isArray(v) ? v : (v?.days || []);
        const note = typeof v === 'object' ? (v?.note || '') : '';
        return { org_id: orgId, emp_id: empId, month, days, note };
      });
      if (wishRows.length) {
        const { error } = await supabase.from('wishes').upsert(wishRows, { onConflict: 'org_id,emp_id,month' });
        if (error) console.error('storage.set wishes:', error);
      }

      return;
    }
  },

  delete: async key => {
    if (key === 'dark' || key === 'config') {
      localStorage.removeItem(`ss_${key}`);
    }
  },

  // Realtime-Subscription für Live-Updates
  subscribe: (orgId, { onNotif, onSchedule, onMarket } = {}) => {
    const channel = supabase.channel(`org-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `org_id=eq.${orgId}` },
        payload => onNotif?.(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `org_id=eq.${orgId}` },
        payload => onSchedule?.(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_offers', filter: `org_id=eq.${orgId}` },
        payload => onMarket?.(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

export default db;
