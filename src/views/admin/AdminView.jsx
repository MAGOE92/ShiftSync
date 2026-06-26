import { useApp } from "../../App.jsx";
import { Icon } from "../../theme/icons.jsx";
import { useState } from "react";

export default function AdminView() {
  const {
    T, crd, inp, lbl, btn, tabBtn, ovl,
    org, orgs, orgId, me, wasSuper, isSuper,
    emps, wishes, scheds, reqs, shiftDefs, weekStdHours, holidays, permsByRole,
    aTab, setATab, planMo, setPlanMo, planView, setPlanView, planDate, setPlanDate,
    filterEmp, setFilterEmp, filterShift, setFilterShift, reqFilter, setReqFilter,
    editMode, setEditMode, draft, setDraft, paint, setPaint, dragSh, setDragSh,
    editE, setEditE, ef, setEf, rstE, setRstE, rstP, setRstP,
    orgEd, setOrgEd, editShift, setEditShift, editReq, setEditReq, decNote, setDecNote,
    nef, setNef, showOrgs, setShowOrgs, linkForm, setLinkForm,
    holidayDate, setHolidayDate, holidayName, setHolidayName,
    genLoad, pendCount, today, cm, nm, cy, cm0, market,
    orgPlan, orgStatus, seatLimit, seatUsed, seatFull, trialDaysLeft, canAuto,
    can, canManage, isOwner,
    ROLES, PLANS, STATUS, PERMS, DEFAULT_PERMS, SHIFT_COLORS, ACCENTS, MF, DW, PR,
    T: theme, hoursOf, pm, nms,
    getShiftInfo, shBg, shC, shX, calcHours, targetHours, fmtH,
    flash, clockData,
    seedDemo, addEmp, saveEf, patchEmp, doRst, delEmp, toggleInPlan, switchToOrg, linkOrg, unlinkOrg,
    absMap, createEmptyPlan, generate, paintKeys, paintCell, moveShift, publishDraft,
    refreshData, exportPayroll, handleReq, saveOrgEdits, setAccent, setTimeclock, saveShift, delShift,
    addHoliday, delHoliday, setPerm, printPlan, exportCSV,
    setOrgStatus, setOrgPlan, setIsSuper, setWasSuper, setOrgId, setData, setMe, setView,
    startCheckout, logout,
    Logo, Avatar, Tst, DarkBtn, NotifBell, NotifPanel, Header, TabBar,
    isMobile,
    arbzgCheck,
  } = useApp();

  const [hrEmp, setHrEmp] = useState(null);
  const [hrTab, setHrTab] = useState("overview");
  const [hrEf, setHrEf] = useState({});

  const adjMonth = (ym, delta) => { const { y, m0 } = pm(ym); const d = new Date(y, m0 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const MonthNav = ({ value, onChange }) => {
    const { y, m0 } = pm(value);
    return (
      <div style={{ display: "flex", alignItems: "center", background: T.bg2, borderRadius: 10, overflow: "hidden", height: 38 }}>
        <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0 14px", color: T.tx, fontSize: 18, fontWeight: 700, height: "100%" }} onClick={() => onChange(adjMonth(value, -1))}>‹</button>
        <div style={{ fontWeight: 700, fontSize: 13, color: T.tx, whiteSpace: "nowrap", padding: "0 4px" }}>{MF[m0]} {y}</div>
        <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0 14px", color: T.tx, fontSize: 18, fontWeight: 700, height: "100%" }} onClick={() => onChange(adjMonth(value, 1))}>›</button>
      </div>
    );
  };

  const { y, m0, days, lbl: plbl } = pm(planMo);
  const baseSc = editMode ? draft : (scheds[planMo] || null);
  const abs = absMap();
  const curSc = baseSc ? (() => { const c = {}; Object.keys(baseSc).forEach(id => { c[id] = [...baseSc[id]]; (abs[id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) c[id][day - 1] = type; }); }); return c; })() : null;
  const todTeam = scheds[cm] ? emps.map(e => ({ e, sh: scheds[cm][e.id]?.[today.getDate() - 1] || "-" })).filter(x => x.sh !== "-") : [];
  const isShift = k => shiftDefs.some(s => s.key === k);
  const cov = curSc ? Array.from({ length: days }, (_, d) => { const o = {}; shiftDefs.forEach(s => { o[s.key] = emps.filter(e => (curSc[e.id] || [])[d] === s.key).length; }); return o; }) : [];
  const gaps = cov.filter(c => shiftDefs.some(s => c[s.key] < s.required)).length;
  const gapDays = curSc ? (() => { const r = []; for (let d = 0; d < days; d++) { const gs = shiftDefs.filter(s => (cov[d]?.[s.key] || 0) < s.required); if (gs.length) { const dt = new Date(y, m0, d + 1); r.push({ d, dow: DW[dt.getDay()], gs: gs.map(s => ({ key: s.key, label: s.label, has: cov[d]?.[s.key] || 0, need: s.required })) }); } } return r; })() : [];
  const planEmps = emps.filter(e => e.inPlan !== false);
  const nonPlanEmps = emps.filter(e => e.inPlan === false);
  const arbzg = curSc ? arbzgCheck(curSc, planEmps, shiftDefs) : [];
  const arbzgSet = new Set(arbzg.map(i => i.empId + ":" + i.day));
  const arbzgErr = arbzg.filter(i => i.sev === "er").length;
  const filteredEmps = filterEmp === "all" ? planEmps : planEmps.filter(e => e.id === filterEmp);
  const filteredNonPlanEmps = filterEmp === "all" ? nonPlanEmps : nonPlanEmps.filter(e => e.id === filterEmp);
  const pdate = new Date(planDate);
  const viewDays = planView === "day" ? [pdate] : planView === "week" ? (() => { const s = new Date(pdate); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; }); })() : [];
  const filteredReqs = reqFilter === "all" ? reqs : reqs.filter(r => r.status === reqFilter);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      {Tst}
      {NotifPanel}

      {showOrgs && <div style={ovl} onClick={() => setShowOrgs(false)}><div style={{ ...crd, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{wasSuper ? "Kunde wechseln" : "Meine Betriebe"}</h3><button style={{ ...btn("s", true), padding: "5px 9px" }} onClick={() => setShowOrgs(false)}><Icon n="x" s={15} /></button></div>
        {wasSuper
          ? orgs.map(o => <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: o.id === orgId ? T.bl : T.bg2, borderRadius: 10, marginBottom: 6 }}><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{o.name}</div><div style={{ fontSize: 11, color: T.tx2 }}>ID: {o.code}</div></div>{o.id === orgId ? <span style={{ fontSize: 11, color: T.blT, fontWeight: 700 }}>aktiv</span> : <button style={btn("s", true)} onClick={() => switchToOrg(o.id)}>öffnen</button>}</div>)
          : <>
            {[{ id: orgId, code: org.code, name: org.name, lid: me.lid, cur: true }, ...(me.linkedOrgs || []).map(l => { const o = orgs.find(x => x.id === l.id); return o ? { ...l, code: o.code, name: o.name } : l; }).filter(l => orgs.some(x => x.id === l.id))].map(l => <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: l.id === orgId ? T.bl : T.bg2, borderRadius: 10, marginBottom: 6 }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{l.name}</div><div style={{ fontSize: 11, color: T.tx2 }}>ID: {l.code}</div></div>{l.id === orgId ? <span style={{ fontSize: 11, color: T.blT, fontWeight: 700 }}>aktiv</span> : <><button style={btn("s", true)} onClick={() => switchToOrg(l.id, l.lid)}>öffnen</button><button style={{ ...btn("er", true), padding: "7px 9px" }} onClick={() => unlinkOrg(l.id)} title="Verknüpfung lösen"><Icon n="x" s={14} /></button></>}</div>)}
            <div style={{ borderTop: `1px solid ${T.bord}`, marginTop: 12, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Weiteren Betrieb verknüpfen</div>
              <p style={{ fontSize: 11, color: T.tx2, margin: "0 0 10px" }}>Nur eigene Betriebe: Gib Betriebs-ID und deinen Login dort ein.</p>
              <input style={{ ...inp, fontFamily: "ui-monospace,monospace", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }} placeholder="Betriebs-ID" value={linkForm.code} onChange={e => setLinkForm(p => ({ ...p, code: e.target.value }))} />
              <input style={{ ...inp, marginBottom: 8 }} placeholder="Login-ID dort" value={linkForm.lid} onChange={e => setLinkForm(p => ({ ...p, lid: e.target.value }))} />
              <input style={{ ...inp, marginBottom: 10 }} type="password" placeholder="PIN dort" value={linkForm.pin} onChange={e => setLinkForm(p => ({ ...p, pin: e.target.value }))} />
              <button style={{ ...btn("p"), width: "100%" }} onClick={linkOrg}><Icon n="plus" s={15} />Verknüpfen</button>
            </div>
          </>}
      </div></div>}

      {editE && (() => {
        const DOW_ORDER = [1,2,3,4,5,6,0];
        const DOW_LABELS = ["Mo","Di","Mi","Do","Fr","Sa","So"];
        const allShiftKeys = shiftDefs.map(s => s.key);
        const isAvail = (dow, sh) => { if (!ef.avail || !ef.avail[String(dow)]) return true; return ef.avail[String(dow)].includes(sh); };
        const toggleAvail = (dow, sh) => setEf(p => {
          const cur = { ...(p.avail || {}) };
          const key = String(dow);
          const curArr = cur[key] ? [...cur[key]] : [...allShiftKeys];
          const next = curArr.includes(sh) ? curArr.filter(x => x !== sh) : [...curArr, sh];
          if (next.length >= allShiftKeys.length) { delete cur[key]; } else { cur[key] = next; }
          const hasAny = Object.keys(cur).some(k => cur[k] && cur[k].length < allShiftKeys.length);
          return { ...p, avail: hasAny ? cur : null };
        });
        const resetAvail = () => setEf(p => ({ ...p, avail: null }));
        const hasRestrictions = !!(ef.avail && Object.keys(ef.avail).some(k => ef.avail[k]?.length < allShiftKeys.length));
        return (
          <div style={ovl}><div style={{ ...crd, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{editE.name}</h3>
              <button style={{ ...btn("s", true), padding: "4px 9px" }} onClick={() => setEditE(null)}><Icon n="x" s={15} /></button>
            </div>
            <label style={lbl}>Name</label><input style={inp} value={ef.name || ""} onChange={e => setEf(p => ({ ...p, name: e.target.value }))} />
            <label style={lbl}>Login-ID</label><input style={inp} value={ef.lid || ""} onChange={e => setEf(p => ({ ...p, lid: e.target.value }))} />
            <label style={lbl}>Schichtpräferenz</label>
            <select style={inp} value={ef.pref || "any"} onChange={e => setEf(p => ({ ...p, pref: e.target.value }))}>{PR.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}{shiftDefs.map(s => <option key={s.key} value={s.key}>Nur {s.label}</option>)}</select>
            <label style={lbl}>Stellenumfang (%)</label>
            <input type="number" min="10" max="100" step="5" style={inp} value={ef.workPct || 100} onChange={e => setEf(p => ({ ...p, workPct: e.target.value }))} />
            <p style={{ fontSize: 10, color: T.tx2, margin: "3px 0 8px" }}>z. B. 100 = Vollzeit ({weekStdHours}h), 50 = halbe Stelle ({weekStdHours / 2}h)</p>
            <label style={lbl}>Max. Arbeitstage pro Woche</label>
            <select style={inp} value={ef.maxDaysPerWeek || ""} onChange={e => setEf(p => ({ ...p, maxDaysPerWeek: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">Keine Einschränkung</option>
              {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} Tage / Woche</option>)}
            </select>
            {ef.maxDaysPerWeek
              ? <p style={{ fontSize: 10, color: T.wT, margin: "3px 0 0", background: T.w, borderRadius: 6, padding: "4px 8px" }}>
                  Entspricht ca. {Math.round(ef.maxDaysPerWeek / 5 * (ef.workPct || 100))}% Auslastung/Woche — Stellenumfang oben ggf. anpassen (aktuell {ef.workPct || 100}%).
                </p>
              : <p style={{ fontSize: 10, color: T.tx2, margin: "3px 0 0" }}>z. B. 3 für Teilzeit-Mitarbeiter die nur bestimmte Wochentage arbeiten.</p>}

            {/* Verfügbarkeitsmatrix */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 6 }}>
              <label style={{ ...lbl, margin: 0 }}>Verfügbarkeit nach Wochentag</label>
              {hasRestrictions && <button style={{ ...btn("s", true), fontSize: 10, padding: "3px 8px" }} onClick={resetAvail}>Alles freigeben</button>}
            </div>
            <p style={{ fontSize: 10, color: T.tx2, margin: "0 0 8px" }}>
              {hasRestrictions ? "Graue Felder = nicht verfügbar. Antippen zum Umschalten." : "Aktuell alle Schichten an allen Tagen möglich. Antippen um einzuschränken."}
            </p>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `80px repeat(7, 1fr)`, gap: 3, minWidth: 340 }}>
                <div style={{ fontSize: 10, color: T.tx2 }} />
                {DOW_LABELS.map(l => <div key={l} style={{ fontSize: 10, fontWeight: 700, color: T.tx2, textAlign: "center", padding: "2px 0" }}>{l}</div>)}
                {shiftDefs.map(s => (
                  <>{/* shift row */}
                    <div key={s.key + "lbl"} style={{ fontSize: 11, fontWeight: 600, color: T.tx, display: "flex", alignItems: "center", paddingRight: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                    {DOW_ORDER.map(dow => {
                      const ok = isAvail(dow, s.key);
                      return (
                        <button key={dow} onClick={() => toggleAvail(dow, s.key)}
                          style={{ padding: "5px 2px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, textAlign: "center", background: ok ? shBg(s.key) : T.bg3, color: ok ? shC(s.key) : T.tx2, opacity: ok ? 1 : 0.5 }}>
                          {ok ? s.key : "–"}
                        </button>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            <label style={{ ...lbl, marginTop: 14 }}>Rolle</label>
            <select style={inp} value={ef.role || "staff"} onChange={e => setEf(p => ({ ...p, role: e.target.value }))} disabled={editE.role === "owner" && !isOwner}>
              <option value="staff">Mitarbeiter</option><option value="manager">Shopleiter</option><option value="director">Geschäftsführer</option>
              {(isOwner || editE.role === "owner") && <option value="owner">Inhaber</option>}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "9px 12px", background: T.bg2, borderRadius: 10 }}>
              <input type="checkbox" id="editInPlan" checked={ef.inPlan !== false} onChange={e => setEf(p => ({ ...p, inPlan: e.target.checked }))} />
              <label htmlFor="editInPlan" style={{ fontSize: 12, cursor: "pointer", flex: 1 }}>Bei Dienstplan-Erstellung berücksichtigen</label>
            </div>
            <p style={{ fontSize: 10, color: T.tx2, margin: "4px 0 0" }}>Inhaber & Geschäftsführer üblicherweise deaktiviert, da nicht im Schichtbetrieb.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button style={{ ...btn("s"), flex: 1 }} onClick={() => setEditE(null)}>Abbrechen</button><button style={{ ...btn("p"), flex: 2 }} onClick={saveEf}>Speichern</button></div>
          </div></div>
        );
      })()}

      {rstE && <div style={ovl}><div style={{ ...crd, width: "100%", maxWidth: 360 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>PIN: {rstE.name}</h3><button style={{ ...btn("s", true), padding: "4px 9px" }} onClick={() => { setRstE(null); setRstP(""); }}><Icon n="x" s={15} /></button></div><label style={lbl}>Neuer PIN (≥4)</label><input style={{ ...inp, fontSize: 24, letterSpacing: 10, textAlign: "center", fontWeight: 700 }} value={rstP} onChange={e => setRstP(e.target.value)} /><div style={{ display: "flex", gap: 8, marginTop: 16 }}><button style={{ ...btn("s"), flex: 1 }} onClick={() => { setRstE(null); setRstP(""); }}>Abbrechen</button><button style={{ ...btn("p"), flex: 2 }} onClick={doRst}>Setzen</button></div></div></div>}

      {editShift && <div style={ovl}><div style={{ ...crd, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{editShift.idx === undefined ? "Neues Schichtmodell" : "Schichtmodell"}</h3><button style={{ ...btn("s", true), padding: "4px 9px" }} onClick={() => setEditShift(null)}><Icon n="x" s={15} /></button></div>
        <label style={lbl}>Bezeichnung</label><input style={inp} placeholder="z. B. Früh" value={editShift.label} onChange={e => setEditShift(p => ({ ...p, label: e.target.value }))} />
        <label style={lbl}>Kürzel (1 Buchstabe)</label><input style={inp} maxLength={2} placeholder="z. B. F" value={editShift.key} onChange={e => setEditShift(p => ({ ...p, key: e.target.value.toUpperCase() }))} />
        <label style={lbl}>Beginn</label><input style={inp} type="time" value={editShift.start} onChange={e => setEditShift(p => ({ ...p, start: e.target.value }))} />
        <label style={lbl}>Ende</label><input style={inp} type="time" value={editShift.end} onChange={e => setEditShift(p => ({ ...p, end: e.target.value }))} />
        <p style={{ fontSize: 10, color: T.tx2, margin: "3px 0 0" }}>Dauer: {hoursOf(editShift.start, editShift.end)} Stunden</p>
        <label style={lbl}>Mitarbeiter pro Schicht</label><input style={inp} type="number" min="1" max="20" value={editShift.required} onChange={e => setEditShift(p => ({ ...p, required: Number(e.target.value) || 1 }))} />
        <label style={lbl}>Farbe</label><div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>{SHIFT_COLORS.map((c, i) => <button key={i} onClick={() => setEditShift(p => ({ ...p, colorIdx: i }))} style={{ width: 34, height: 34, borderRadius: 8, border: editShift.colorIdx === i ? `3px solid ${T.tx}` : `1px solid ${T.bord2}`, background: c.bg, cursor: "pointer" }} />)}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button style={{ ...btn("s"), flex: 1 }} onClick={() => setEditShift(null)}>Abbrechen</button><button style={{ ...btn("p"), flex: 2 }} onClick={saveShift}>Speichern</button></div>
      </div></div>}

      {editReq && <div style={ovl}><div style={{ ...crd, width: "100%", maxWidth: 400 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Entscheidung mit Notiz</h3><button style={{ ...btn("s", true), padding: "4px 9px" }} onClick={() => { setEditReq(null); setDecNote(""); }}><Icon n="x" s={15} /></button></div>
        <p style={{ fontSize: 12, color: T.tx2, margin: "0 0 8px" }}>Anfrage von <strong>{emps.find(e => e.id === editReq.req.uid)?.name}</strong></p>
        <label style={lbl}>Notiz (optional, für den Mitarbeiter sichtbar)</label>
        <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={decNote} onChange={e => setDecNote(e.target.value)} placeholder="z. B. Vertretung gefunden, dieses Mal nicht möglich, ..." />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button style={{ ...btn("er"), flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => handleReq(editReq.req.id, "no", decNote)}><Icon n="x" s={15} />Ablehnen</button><button style={{ ...btn("ok"), flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => handleReq(editReq.req.id, "ok", decNote)}><Icon n="check" s={15} />Genehmigen</button></div>
      </div></div>}

      {hrEmp && (() => {
        const thisYear = today.getFullYear();
        const yearStr = String(thisYear);

        // Resturlaub
        const annualVac = Number(hrEmp.vacDays || 24);
        const vacCarry = Number(hrEmp.vacCarry || 0);
        const usedVac = reqs.filter(r => r.uid === hrEmp.id && r.status === "ok" && r.type === "vac" && r.dates?.some(d => d.startsWith(yearStr))).reduce((s, r) => s + (r.dates?.filter(d => d.startsWith(yearStr)).length || 0), 0);
        const vacLeft = annualVac + vacCarry - usedVac;

        // Kranktage dieses Jahr
        const sickDays = reqs.filter(r => r.uid === hrEmp.id && (r.status === "ok" || r.status === "pending") && r.type === "sick" && (r.dates?.some(d => d.startsWith(yearStr)) || (r.fromDate || "").startsWith(yearStr))).reduce((s, r) => s + (r.dates?.filter(d => d.startsWith(yearStr)).length || 1), 0);

        // Überstunden: pro Monat soll vs ist
        const monthKeys = Object.keys(scheds).sort();
        const overtimeRows = monthKeys.map(ym => {
          const { y, m0, days: dInM } = pm(ym);
          const row = scheds[ym]?.[hrEmp.id] || [];
          const ist = calcHours(row);
          const soll = targetHours(hrEmp, dInM);
          return { ym, label: `${MF[m0]} ${y}`, ist, soll, diff: ist - soll };
        }).filter(r => r.ist > 0 || r.soll > 0);
        const totalOT = overtimeRows.reduce((s, r) => s + r.diff, 0);

        // Stempeluhr-Stunden gesamt (alle clock-Daten für diesen MA)
        let clockTotal = 0;
        Object.entries(clockData).forEach(([, empMap]) => {
          const entry = empMap?.[hrEmp.id];
          if (entry?.in && entry?.out) {
            const diff = (new Date(entry.out) - new Date(entry.in)) / 3600000;
            if (diff > 0 && diff < 16) clockTotal += diff;
          }
        });

        const saveHr = async () => {
          await patchEmp(hrEmp.id, hrEf);
          setHrEmp(p => ({ ...p, ...hrEf }));
          flash("ok", "Stammdaten gespeichert ✓");
        };

        const kpi = (label, value, color, sub) => (
          <div style={{ padding: "12px 14px", background: T.bg2, borderRadius: 12 }}>
            <div style={{ fontSize: 10.5, color: T.tx2, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: color || T.tx, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 10, color: T.tx2, marginTop: 4 }}>{sub}</div>}
          </div>
        );

        return (
          <div style={ovl} onClick={() => setHrEmp(null)}>
            <div style={{ ...crd, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Avatar emp={hrEmp} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{hrEmp.name}</div>
                  <div style={{ fontSize: 11, color: T.tx2 }}>{ROLES[hrEmp.role || "staff"]?.l} · {hrEmp.lid} · {hrEmp.workPct || 100}%</div>
                  {hrEmp.startDate && <div style={{ fontSize: 11, color: T.tx2 }}>seit {new Date(hrEmp.startDate + "T12:00:00").toLocaleDateString("de-DE")}</div>}
                </div>
                <button style={{ ...btn("s", true), padding: "5px 9px" }} onClick={() => setHrEmp(null)}><Icon n="x" s={15} /></button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 14, background: T.bg2, borderRadius: 10, padding: 4 }}>
                {[["overview", "Übersicht"], ["stamm", "Stammdaten"], ["history", "Verlauf"]].map(([k, l]) => (
                  <button key={k} onClick={() => setHrTab(k)} style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 8, background: hrTab === k ? T.card : "transparent", color: hrTab === k ? T.tx : T.tx2, fontWeight: hrTab === k ? 700 : 400, fontSize: 12, cursor: "pointer" }}>{l}</button>
                ))}
              </div>

              {hrTab === "overview" && <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {kpi("Resturlaub " + thisYear, vacLeft < 0 ? vacLeft : "+" + vacLeft + " Tage", vacLeft < 0 ? T.erT : vacLeft <= 5 ? T.wT : T.okT, `${usedVac} von ${annualVac + vacCarry} Tagen genutzt${vacCarry ? ` (inkl. ${vacCarry} Übertrag)` : ""}`)}
                  {kpi("Kranktage " + thisYear, sickDays + " Tage", sickDays >= 10 ? T.erT : sickDays >= 5 ? T.wT : T.tx, "genehmigte Krankmeldungen")}
                  {kpi("Überstunden-Saldo", (totalOT >= 0 ? "+" : "") + fmtH(totalOT), totalOT > 10 ? T.okT : totalOT < -5 ? T.erT : T.tx, "kumuliert über alle Monate")}
                  {clockTotal > 0 && kpi("Stempeluhr gesamt", fmtH(clockTotal), T.tx, "erfasste Arbeitszeit")}
                </div>
                <div style={{ ...crd, padding: "10px 12px", marginBottom: 0, background: T.bg2, border: "none" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Monatsübersicht Stunden</div>
                  {!overtimeRows.length && <p style={{ fontSize: 12, color: T.tx2, margin: 0 }}>Noch keine Plandaten.</p>}
                  {overtimeRows.map(r => (
                    <div key={r.ym} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.bord}` }}>
                      <span style={{ fontSize: 12, color: T.tx2, width: 80 }}>{r.label}</span>
                      <span style={{ fontSize: 12, flex: 1 }}>{fmtH(r.ist)} <span style={{ color: T.tx2 }}>/ {fmtH(r.soll)} Soll</span></span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.diff > 0 ? T.okT : r.diff < -1 ? T.erT : T.tx2 }}>{r.diff >= 0 ? "+" : ""}{fmtH(r.diff)}</span>
                    </div>
                  ))}
                </div>
              </>}

              {hrTab === "stamm" && <>
                <label style={lbl}>Eintrittsdatum</label>
                <input style={inp} type="date" value={hrEf.startDate ?? (hrEmp.startDate || "")} onChange={e => setHrEf(p => ({ ...p, startDate: e.target.value }))} />
                <label style={lbl}>Jahresurlaubsanspruch (Tage)</label>
                <input style={inp} type="number" min="0" max="40" value={hrEf.vacDays ?? (hrEmp.vacDays || 24)} onChange={e => setHrEf(p => ({ ...p, vacDays: Number(e.target.value) }))} />
                <p style={{ fontSize: 10, color: T.tx2, margin: "-6px 0 8px" }}>Gesetzliches Minimum: 20 Tage (5-Tage-Woche).</p>
                <label style={lbl}>Urlaubsübertrag aus Vorjahr (Tage)</label>
                <input style={inp} type="number" min="0" max="60" value={hrEf.vacCarry ?? (hrEmp.vacCarry || 0)} onChange={e => setHrEf(p => ({ ...p, vacCarry: Number(e.target.value) }))} />
                <label style={lbl}>HR-Notizen (nur intern, für Mitarbeiter nicht sichtbar)</label>
                <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={hrEf.hrNotes ?? (hrEmp.hrNotes || "")} onChange={e => setHrEf(p => ({ ...p, hrNotes: e.target.value }))} placeholder="z. B. Gespräch am 15.3., befristeter Vertrag bis..." />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button style={{ ...btn("s"), flex: 1 }} onClick={() => { setHrEf({}); setHrEmp(null); }}>Schließen</button>
                  <button style={{ ...btn("p"), flex: 2 }} onClick={saveHr}>Speichern</button>
                </div>
              </>}

              {hrTab === "history" && <>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Anfragen-Verlauf</div>
                {reqs.filter(r => r.uid === hrEmp.id).length === 0 && <p style={{ fontSize: 12, color: T.tx2 }}>Keine Anfragen vorhanden.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...reqs.filter(r => r.uid === hrEmp.id)].reverse().map(r => {
                    const tL = { sick: "Krankmeldung", vac: "Urlaub", swap: "Tausch" };
                    const sL = { pending: [T.w, T.wT, "Offen"], ok: [T.ok, T.okT, "Genehmigt"], no: [T.er, T.erT, "Abgelehnt"], cancelled: [T.bg2, T.tx2, "Zurückgezogen"] };
                    const [bg, col, sl] = sL[r.status] || sL.pending;
                    return (
                      <div key={r.id} style={{ padding: "9px 11px", background: T.bg2, borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{tL[r.type] || r.type}</div>
                          <div style={{ fontSize: 11, color: T.tx2, marginTop: 2 }}>
                            {r.type === "vac" && `${r.dates?.length || 0} Tage${r.dates?.length ? ": " + r.dates[0] + (r.dates.length > 1 ? " …" : "") : ""}`}
                            {r.type === "sick" && (r.fromDate || r.date || "")}
                            {r.type === "swap" && `${r.date} ↔ ${r.toDate}`}
                          </div>
                          {r.decisionNote && <div style={{ fontSize: 10, color: T.tx2, marginTop: 2, fontStyle: "italic" }}>"{r.decisionNote}"</div>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: bg, color: col, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{sl}</span>
                      </div>
                    );
                  })}
                </div>
              </>}
            </div>
          </div>
        );
      })()}

      {Header(<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><Avatar emp={me} size={30} />{me.name}</span>, `${org.name.toUpperCase()} · ${org.code}${wasSuper ? " · SUPPORT-MODUS" : ""}`, <>{DarkBtn}{NotifBell}{wasSuper && <button style={btn("pu", true)} onClick={() => { setIsSuper(true); setWasSuper(false); setOrgId(null); setMe(null); setView("super"); }}><Icon n="shield" s={14} />Konsole</button>}{(wasSuper || me.role === "owner") && <button style={{ ...btn("s", true), padding: "7px 10px" }} onClick={() => setShowOrgs(true)} title={wasSuper ? "Kunde wechseln" : "Betrieb wechseln"}><Icon n="building" /></button>}<button style={btn("bl", true)} onClick={() => { setView("emp"); }} title="Mitarbeiter-Ansicht"><Icon n="user" /></button><button style={{ ...btn("s", true), padding: "7px 10px" }} onClick={logout} title="Abmelden"><Icon n="logout" /></button></>)}
      {TabBar([["dash", "Übersicht", "chart"], ["staff", "Team", "users"], ["reqs", `Anfragen${pendCount ? " (" + pendCount + ")" : ""}`, "inbox"], ["sched", "Planer", "calendar"], ...((isOwner || can("manageOrg") || can("manageShifts")) ? [["settings", "Betrieb", "settings"]] : [])], aTab, setATab)}

      <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
        {wasSuper && <div style={{ ...crd, marginBottom: 14, background: T.pu, borderColor: T.puT + "40", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20 }}></div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.puT }}>Anbieter-Support-Modus aktiv</div>
            <div style={{ fontSize: 11, color: T.puT, opacity: .85 }}>Du arbeitest im Auftrag des Kunden. Alle Berechtigungen sind freigeschaltet.</div>
          </div>
          <button style={btn("pu", true)} onClick={() => { setIsSuper(true); setWasSuper(false); setOrgId(null); setMe(null); setView("super"); }}><Icon n="shield" s={14} />Zur Konsole</button>
        </div>}

        {aTab === "dash" && (() => {
          // Dashboard immer aktueller Monat — unabhängig vom Planer-Monat
          const { y: dy, m0: dm0, days: ddays, lbl: dlbl } = pm(cm);
          const dashBase = scheds[cm] || null;
          const dSc = dashBase ? (() => { const c = {}; Object.keys(dashBase).forEach(id => { c[id] = [...dashBase[id]]; (abs[id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= ddays) c[id][day - 1] = type; }); }); return c; })() : null;
          const dCov = dSc ? Array.from({ length: ddays }, (_, d) => { const o = {}; shiftDefs.forEach(s => { o[s.key] = planEmps.filter(e => (dSc[e.id] || [])[d] === s.key).length; }); return o; }) : [];
          const dGaps = dCov.filter(c => shiftDefs.some(s => c[s.key] < s.required)).length;
          const dGapDays = dSc ? (() => { const r = []; for (let d = 0; d < ddays; d++) { const gs = shiftDefs.filter(s => (dCov[d]?.[s.key] || 0) < s.required); if (gs.length) { const dt = new Date(dy, dm0, d + 1); r.push({ d, dow: DW[dt.getDay()], gs: gs.map(s => ({ key: s.key, label: s.label, has: dCov[d]?.[s.key] || 0, need: s.required })) }); } } return r; })() : [];
          const dCovPct = (() => { if (!dSc) return 0; const req = ddays * shiftDefs.reduce((s, d) => s + d.required, 0); let filled = 0; for (let d = 0; d < ddays; d++) shiftDefs.forEach(s => { filled += Math.min(dCov[d]?.[s.key] || 0, s.required); }); return req ? Math.round(filled / req * 100) : 0; })();
          const dUtil = dSc && planEmps.length ? Math.round(planEmps.map(e => { const so = targetHours(e, ddays); return so > 0 ? calcHours(dSc[e.id] || []) / so : 1; }).reduce((a, b) => a + b, 0) / planEmps.length * 100) : 0;
          const dHours = dSc ? planEmps.reduce((s, e) => s + calcHours(dSc[e.id] || []), 0) : 0;
          return <div>
          {orgStatus !== "active" && <div style={{ ...crd, marginBottom: 14, background: orgStatus === "trial" ? T.bl : T.w, borderColor: (orgStatus === "trial" ? T.blT : T.wT) + "40" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
              <Icon n={orgStatus === "trial" ? "clock" : "alert"} s={20} style={{ color: orgStatus === "trial" ? T.blT : T.wT }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: orgStatus === "trial" ? T.blT : T.wT }}>{orgStatus === "trial" ? `Testphase · Tarif ${orgPlan.l}` : orgStatus === "archived" ? "Dieser Betrieb ist offline" : "Betrieb gesperrt"}</div>
                <div style={{ fontSize: 12, color: orgStatus === "trial" ? T.blT : T.wT, marginTop: 1 }}>{orgStatus === "trial" ? (trialDaysLeft != null ? `Noch ${Math.max(0, trialDaysLeft)} Tage – danach ist ein bezahlter Tarif nötig.` : "Alle Funktionen freigeschaltet.") : "Bitte den Anbieter kontaktieren, um zu reaktivieren."}</div>
              </div>
            </div>
          </div>}
          {emps.length <= 1 && <div style={{ ...crd, marginBottom: 14, background: T.bl, borderColor: T.blT + "40" }}><h3 style={{ margin: "0 0 8px", fontSize: 14, color: T.blT }}>Startklar · Betriebs-ID: <span style={{ fontFamily: "ui-monospace,monospace" }}>{org.code}</span></h3><p style={{ margin: "0 0 12px", fontSize: 13, color: T.blT }}>Mit dieser Betriebs-ID melden sich deine Mitarbeiter an.</p><button style={btn("p")} onClick={seedDemo}>Demo-Team laden</button></div>}
          {/* ── HEUTE (Hero) ─────────────────────────────── */}
          <div style={{ ...crd, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Heute · {DW[today.getDay()]} {today.getDate()}. {MF[today.getMonth()]}</h3>
              <button style={btn("s", true)} onClick={() => setATab("sched")}><Icon n="calendar" s={13} />Planer</button>
            </div>
            {!todTeam.length
              ? <div style={{ padding: "14px 0 2px", color: T.tx2, fontSize: 13 }}>Kein Dienstplan für heute hinterlegt.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {shiftDefs.map(def => {
                    const w = todTeam.filter(x => x.sh === def.key);
                    const ok = w.length >= def.required;
                    return (
                      <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: ok ? shBg(def.key) : T.er, borderRadius: 11, flexWrap: "wrap" }}>
                        <span style={{ background: shX(def.key), color: "#fff", borderRadius: 6, padding: "3px 8px", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{def.key}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ok ? shC(def.key) : T.erT, minWidth: 110 }}>{def.label} {def.start}–{def.end}</span>
                        {w.length === 0
                          ? <span style={{ fontSize: 12, color: T.erT, fontWeight: 700, marginLeft: "auto" }}>unbesetzt</span>
                          : <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
                              {w.map(x => <span key={x.e.id} style={{ fontSize: 11, background: T.card, padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>{x.e.name}</span>)}
                              {!ok && <span style={{ fontSize: 11, color: T.erT, fontWeight: 700 }}>+{def.required - w.length} fehlt</span>}
                            </div>}
                      </div>
                    );
                  })}
                </div>}
          </div>

          {/* ── DIENSTPLAN-HEALTH ─────────────────────────── */}
          <div style={{ ...crd, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Dienstplan</h3>
                <span style={{ fontSize: 11, color: T.tx2 }}>{dlbl}</span>
              </div>
              <button style={btn("s", true)} onClick={() => { setPlanMo(cm); setATab("sched"); }}><Icon n="calendar" s={13} />Im Planer bearbeiten</button>
            </div>
            {!dSc
              ? <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
                  <span style={{ fontSize: 13, color: T.tx2 }}>Noch kein Plan für {dlbl} erstellt.</span>
                  <button style={btn("p", true)} onClick={() => { setPlanMo(cm); setATab("sched"); }}><Icon n="sparkle" s={14} />Jetzt planen</button>
                </div>
              : <>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: dGaps > 0 ? 10 : 0 }}>
                    <div style={{ padding: "12px 14px", background: dCovPct >= 95 ? T.ok : dCovPct >= 80 ? T.w : T.er, borderRadius: 12 }}>
                      <div style={{ fontSize: 10, color: dCovPct >= 95 ? T.okT : dCovPct >= 80 ? T.wT : T.erT, fontWeight: 600, marginBottom: 5, opacity: 0.8 }}>Abdeckung</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: dCovPct >= 95 ? T.okT : dCovPct >= 80 ? T.wT : T.erT, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{dCovPct}%</div>
                    </div>
                    <div style={{ padding: "12px 14px", background: dGaps ? T.er : T.ok, borderRadius: 12 }}>
                      <div style={{ fontSize: 10, color: dGaps ? T.erT : T.okT, fontWeight: 600, marginBottom: 5, opacity: 0.8 }}>Tage mit Lücken</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: dGaps ? T.erT : T.okT, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{dGaps}</div>
                    </div>
                    <div style={{ padding: "12px 14px", background: T.bg2, borderRadius: 12 }}>
                      <div style={{ fontSize: 10, color: T.tx2, fontWeight: 600, marginBottom: 5, opacity: 0.8 }}>Stunden / Auslastung</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.tx, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{Math.round(dHours)} h</div>
                      <div style={{ fontSize: 11, color: Math.abs(dUtil - 100) <= 10 ? T.okT : T.wT, fontWeight: 700, marginTop: 3 }}>Ø {dUtil}% Auslastung</div>
                    </div>
                  </div>
                  {dGaps > 0 && <div style={{ padding: "10px 12px", background: T.er, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: dGapDays.length ? 8 : 0 }}>
                      <Icon n="alert" s={14} style={{ color: T.erT, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.erT, flex: 1 }}>{dGaps} Tag{dGaps > 1 ? "e" : ""} unterbesetzt</span>
                      <button style={{ ...btn("er", true), padding: "3px 9px", fontSize: 11 }} onClick={() => { setPlanMo(cm); setATab("sched"); }}><Icon n="pencil" s={12} />Beheben</button>
                    </div>
                    {dGapDays.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {dGapDays.slice(0, 8).map(({ d, dow, gs }) => (
                        <div key={d} style={{ fontSize: 11, color: T.erT, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, minWidth: 52 }}>{dow} {d + 1}.</span>
                          {gs.map(g => <span key={g.key} style={{ background: "rgba(0,0,0,0.1)", borderRadius: 5, padding: "1px 7px", fontWeight: 600 }}>{g.label} {g.has}/{g.need}</span>)}
                        </div>
                      ))}
                      {dGapDays.length > 8 && <div style={{ fontSize: 10, color: T.erT, opacity: 0.7, marginTop: 1 }}>+{dGapDays.length - 8} weitere Tage</div>}
                    </div>}
                  </div>}
                </>}
          </div>

          {/* ── TEAM-AUSLASTUNG ───────────────────────────── */}
          {dSc && (() => {
            const rows = planEmps.map(e => {
              const ist = calcHours(dSc[e.id] || []);
              const soll = targetHours(e, ddays);
              const pct = soll > 0 ? Math.round(ist / soll * 100) : 0;
              const shifts = (dSc[e.id] || []).filter(x => shiftDefs.some(s => s.key === x)).length;
              return { e, ist, soll, pct, shifts };
            }).sort((a, b) => a.pct - b.pct);
            if (!rows.length) return null;
            const under = rows.filter(r => r.pct < 80).length;
            return (
              <div style={{ ...crd, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Team-Auslastung</h3>
                  <span style={{ fontSize: 11, color: T.tx2 }}>{dlbl}</span>
                  {under > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: T.erT, marginLeft: "auto" }}>{under} unter 80 %</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
                  {rows.map(({ e, ist, soll, pct, shifts }) => {
                    const col = pct === 0 ? T.tx2 : pct < 80 ? T.erT : pct > 110 ? T.wT : T.okT;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar emp={e} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
                            <span style={{ color: T.tx2, whiteSpace: "nowrap", fontSize: 11 }}>{fmtH(ist)} / {fmtH(soll)} · {shifts} Schichten</span>
                          </div>
                          <div style={{ height: 6, background: T.bg3, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: col, borderRadius: 4 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: col, fontFamily: "'Schibsted Grotesk',sans-serif", minWidth: 42, textAlign: "right" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── SCHNELL-AKTIONEN ──────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: pendCount ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 4 }}>
            {pendCount > 0 && <button onClick={() => setATab("reqs")} style={{ ...crd, textAlign: "left", padding: "13px 15px", cursor: "pointer", background: T.w, borderColor: T.wT + "40", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: T.wT + "20", color: T.wT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon n="inbox" s={17} /></div>
              <div><div style={{ fontSize: 18, fontWeight: 800, color: T.wT, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{pendCount}</div><div style={{ fontSize: 11, color: T.wT, marginTop: 3 }}>Offene Anfragen</div></div>
            </button>}
            <button onClick={() => setATab("staff")} style={{ ...crd, textAlign: "left", padding: "13px 15px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: T.acc + "14", color: T.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon n="users" s={17} /></div>
              <div><div style={{ fontSize: 18, fontWeight: 800, color: T.tx, fontFamily: "'Schibsted Grotesk',sans-serif", lineHeight: 1 }}>{emps.length}</div><div style={{ fontSize: 11, color: T.tx2, marginTop: 3 }}>Mitarbeiter im Team</div></div>
            </button>
          </div>
        </div>; })()}

        {aTab === "staff" && <div>
          {can("manageStaff") && <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Mitarbeiter anlegen</h3>{emps.length <= 1 && <button style={btn("bl", true)} onClick={seedDemo}>Demo</button>}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              <div><label style={lbl}>Name</label><input style={inp} value={nef.name} onChange={e => setNef(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label style={lbl}>Login-ID</label><input style={inp} value={nef.lid} onChange={e => setNef(p => ({ ...p, lid: e.target.value }))} /></div>
              <div><label style={lbl}>PIN (≥4)</label><input style={inp} value={nef.pin} onChange={e => setNef(p => ({ ...p, pin: e.target.value }))} /></div>
              <div><label style={lbl}>Rolle</label><select style={inp} value={nef.role} onChange={e => { const r = e.target.value; setNef(p => ({ ...p, role: r, inPlan: r === "staff" || r === "manager" })); }}><option value="staff">Mitarbeiter</option><option value="manager">Shopleiter</option>{isOwner && <option value="director">Geschäftsführer</option>}</select></div>
              <div><label style={lbl}>Stellen-%</label><input style={inp} type="number" min="10" max="100" step="5" value={nef.workPct} onChange={e => setNef(p => ({ ...p, workPct: e.target.value }))} /></div>
              <div><label style={lbl}>Präferenz</label><select style={inp} value={nef.pref} onChange={e => setNef(p => ({ ...p, pref: e.target.value }))}>{PR.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}{shiftDefs.map(s => <option key={s.key} value={s.key}>Nur {s.label}</option>)}</select></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "9px 12px", background: T.bg2, borderRadius: 10 }}>
              <input type="checkbox" id="newInPlan" checked={nef.inPlan !== false} onChange={e => setNef(p => ({ ...p, inPlan: e.target.checked }))} />
              <label htmlFor="newInPlan" style={{ fontSize: 12, cursor: "pointer", flex: 1 }}>Bei Dienstplan-Erstellung berücksichtigen</label>
            </div>
            <button style={{ ...btn("p"), marginTop: 14 }} onClick={addEmp}>Anlegen</button>
          </div>}
          <div style={crd}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Team ({emps.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {emps.map(emp => { const role = ROLES[emp.role || "staff"]; const inP = emp.inPlan !== false; return (<div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: T.bg2, borderRadius: 12, flexWrap: "wrap" }}><Avatar emp={emp} size={38} /><div style={{ flex: 1, minWidth: 90 }}><div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{emp.name}{emp.id === me.id && <span style={{ fontSize: 9, color: T.tx2 }}>(du)</span>}<span style={{ fontSize: 9.5, background: role.col + "1f", color: role.col, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>{role.l}</span><span style={{ fontSize: 10, color: T.tx2 }}>{emp.workPct || 100}%</span><span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4, background: inP ? T.ok : T.bg3, color: inP ? T.okT : T.tx2 }}><Icon n="calendar" s={11} />{inP ? "im Plan" : "nicht im Plan"}</span></div><div style={{ fontSize: 12, color: T.tx2, marginTop: 1 }}>{emp.lid}</div></div><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}><button style={{ ...btn("s", true), padding: "7px 9px" }} onClick={() => { setHrEmp(emp); setHrTab("overview"); setHrEf({}); }} title="Mitarbeiterakte"><Icon n="clipboard" s={14} /></button>{can("manageStaff") && <><button style={{ ...btn(inP ? "bl" : "s", true), padding: "7px 9px" }} onClick={() => toggleInPlan(emp)} title={inP ? "Aus Dienstplan nehmen" : "In Dienstplan aufnehmen"}><Icon n="calendar" s={14} /></button><button style={btn("s", true)} onClick={() => { setEditE(emp); setEf({ name: emp.name, lid: emp.lid, pref: emp.pref, role: emp.role || "staff", workPct: emp.workPct || 100, inPlan: emp.inPlan !== false, avail: emp.avail || null, maxDaysPerWeek: emp.maxDaysPerWeek || null }); }}><Icon n="pencil" s={14} /></button>{can("resetPins") && <button style={btn("w", true)} onClick={() => setRstE(emp)}><Icon n="key" s={14} /></button>}{emp.role !== "owner" && <button style={btn("er", true)} onClick={() => delEmp(emp)}><Icon n="trash" s={14} /></button>}</>}</div></div>); })}
            </div>
          </div>
        </div>}

        {aTab === "reqs" && <div>
          <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[["pending", "clock", "Offen", reqs.filter(r => r.status === "pending").length], ["ok", "check", "Genehmigt", reqs.filter(r => r.status === "ok").length], ["no", "x", "Abgelehnt", reqs.filter(r => r.status === "no").length], ["all", "list", "Alle", null]].map(([k, ic, l, n]) => <button key={k} style={{ ...btn(reqFilter === k ? "p" : "s", true), display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => setReqFilter(k)}><Icon n={ic} s={13} />{l}{n != null ? ` (${n})` : ""}</button>)}
              <button style={{ ...btn("s", true), marginLeft: "auto" }} onClick={refreshData} title="Neu laden"><Icon n="repeat" s={14} /></button>
            </div>
          </div>
          <div style={crd}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{reqFilter === "pending" ? "Offene Anfragen" : reqFilter === "ok" ? "Genehmigt" : reqFilter === "no" ? "Abgelehnt" : "Archiv"}</h3>
            {!filteredReqs.length && <p style={{ color: T.tx2, textAlign: "center", padding: "24px 0", margin: 0, fontSize: 13 }}>Keine Einträge.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[...filteredReqs].reverse().map(r => { const emp = emps.find(e => e.id === r.uid); const tL = { sick: "Krankmeldung", vac: "Urlaubsantrag", swap: "Schichttausch" }; const sL = { pending: [T.w, T.wT, "clock", "Offen"], ok: [T.ok, T.okT, "check", "Genehmigt"], no: [T.er, T.erT, "x", "Abgelehnt"], cancelled: [T.bg3, T.tx2, "x", "Zurückgezogen"] }; const [bg, col, ic, sl] = sL[r.status] || sL.pending; const fmtD = ds => { if (!ds) return ""; const d = new Date(ds + "T12:00:00"); return `${d.getDate()}. ${MF[d.getMonth()]}`; }; const sorted = r.dates ? [...r.dates].sort() : []; const canDec = (r.type === "vac" && can("approveVac")) || (r.type === "sick" && can("approveSick")) || (r.type === "swap" && can("approveSwap")); let whenStr = ""; if (r.type === "sick") whenStr = r.fromDate && r.toDate && r.fromDate !== r.toDate ? `${fmtD(r.fromDate)} bis ${fmtD(r.toDate)} (${r.dates?.length || ""} Tage)` : fmtD(r.fromDate || r.date); else if (r.type === "vac") whenStr = sorted.length ? `${sorted.length} Tage${sorted.length > 1 ? `: ${fmtD(sorted[0])} bis ${fmtD(sorted[sorted.length - 1])}` : `: ${fmtD(sorted[0])}`}` : ""; else if (r.type === "swap") whenStr = `${fmtD(r.fromDate || r.date)} tauschen mit ${emps.find(e => e.id === r.toId)?.name || "?"} am ${fmtD(r.toDate)}`; return (
                <div key={r.id} style={{ padding: "12px 14px", background: T.bg2, borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{emp?.name || "?"}</span>
                    <span style={{ fontSize: 11, color: T.tx2, background: T.bg3, borderRadius: 20, padding: "2px 8px" }}>{tL[r.type]}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, color: col, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, marginLeft: "auto" }}><Icon n={ic} s={11} />{sl}</span>
                  </div>
                  {whenStr && <div style={{ fontSize: 12, color: T.tx, fontWeight: 500, marginBottom: 4 }}>{whenStr}</div>}
                  {r.note && <div style={{ fontSize: 11, color: T.tx2, marginBottom: 6, fontStyle: "italic" }}>"{r.note}"</div>}
                  {r.decisionNote && <div style={{ fontSize: 11, padding: "5px 9px", background: T.bg, borderRadius: 8, marginBottom: 6, color: T.tx2 }}>Antwort: {r.decisionNote}</div>}
                  {r.status === "pending" && canDec && <div style={{ display: "flex", gap: 7, marginTop: 8 }}><button style={{ ...btn("ok", true), display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => { setEditReq({ req: r }); setDecNote(""); }}><Icon n="check" s={13} />Genehmigen</button><button style={{ ...btn("er", true), display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => handleReq(r.id, "no", "")}><Icon n="x" s={13} />Ablehnen</button></div>}
                  {r.status === "pending" && !canDec && <div style={{ fontSize: 11, color: T.tx2, fontStyle: "italic", marginTop: 4 }}>Keine Berechtigung zum Entscheiden.</div>}
                </div>
              ); })}
            </div>
          </div>
        </div>}

        {aTab === "sched" && <div>
          <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <MonthNav value={planMo} onChange={v => { setPlanMo(v); setEditMode(false); setDraft(null); }} />
              <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.bord2}` }}>{[["day", "Tag"], ["week", "Woche"], ["month", "Monat"]].map(([k, l]) => <button key={k} onClick={() => setPlanView(k)} style={{ padding: "9px 14px", border: "none", background: planView === k ? T.invBg : T.bg, color: planView === k ? T.inv : T.tx, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{l}</button>)}</div>
              {planView !== "month" && <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} style={{ ...inp, width: "auto" }} />}
              {can("createPlan") && <button style={{ ...btn(genLoad ? "s" : "p"), minWidth: 170 }} onClick={generate} disabled={genLoad}>{genLoad ? "Rechne…" : <><Icon n="sparkle" s={15} />Automatisch erstellen</>}</button>}
              {can("createPlan") && !baseSc && <button style={btn("bl")} onClick={createEmptyPlan}><Icon n="pencil" s={15} />Leer & selbst erstellen</button>}
              {baseSc && !editMode && can("createPlan") && <button style={btn("w")} onClick={() => { const d = JSON.parse(JSON.stringify(scheds[planMo])); nonPlanEmps.forEach(e => { if (!d[e.id]) d[e.id] = Array(days).fill("-"); }); setDraft(d); setPaint(shiftDefs[0]?.key || "-"); setEditMode(true); }}><Icon n="pencil" s={15} />Bearbeiten</button>}
              {editMode && <><button style={btn("ok")} onClick={publishDraft}><Icon n="check" s={15} />Veröffentlichen</button><button style={btn("s")} onClick={() => { setEditMode(false); setDraft(null); }}>Abbrechen</button></>}
              {baseSc && !editMode && <><button style={btn("s")} onClick={printPlan}><Icon n="printer" s={15} />Drucken</button><button style={btn("s")} onClick={exportCSV}><Icon n="download" s={15} />CSV</button>{orgPlan.exportF && <button style={btn("bl")} onClick={exportPayroll}><Icon n="download" s={15} />Lohn-Export</button>}</>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: T.tx2, fontWeight: 600 }}></span>
              <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ ...inp, width: "auto", padding: "6px 10px", fontSize: 12 }}><option value="all">Alle</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={{ ...inp, width: "auto", padding: "6px 10px", fontSize: 12 }}><option value="all">Alle Schichten</option>{shiftDefs.map(s => <option key={s.key} value={s.key}>Nur {s.label}</option>)}<option value="U">Nur Urlaub</option><option value="K">Nur Krank</option></select>
            </div>
            {curSc && !editMode && gaps > 0 && <div style={{ marginTop: 10, padding: "8px 13px", background: T.er, borderRadius: 10, fontSize: 12, color: T.erT, fontWeight: 600 }}>{gaps} Tag(e) unterbesetzt.</div>}
            {editMode && <div style={{ marginTop: 10, padding: "10px 13px", background: T.bg2, borderRadius: 10 }}><div style={{ fontSize: 12, color: T.tx2, marginBottom: 7, fontWeight: 600 }}>Pinsel <span style={{ fontWeight: 400 }}>· antippen zum Malen · Schicht gedrückt halten und ziehen, um sie zu verschieben</span></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{paintKeys().map(k => <button key={k} onClick={() => setPaint(k)} style={{ padding: "6px 14px", borderRadius: 8, border: paint === k ? `2px solid ${shX(k)}` : `1px solid ${T.bord2}`, background: shBg(k), color: shC(k), fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{getShiftInfo(k).label}</button>)}</div></div>}
            {curSc && <div style={{ marginTop: 10, padding: "11px 13px", background: arbzg.length ? (arbzgErr ? T.er : T.w) : T.ok, borderRadius: 10, border: `1px solid ${(arbzg.length ? (arbzgErr ? T.erT : T.wT) : T.okT)}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 12.5, color: arbzg.length ? (arbzgErr ? T.erT : T.wT) : T.okT }}><Icon n={arbzg.length ? "alert" : "shield"} s={15} />Compliance-Wächter (ArbZG): {arbzg.length ? `${arbzg.length} Hinweis${arbzg.length > 1 ? "e" : ""}${arbzgErr ? ` · davon ${arbzgErr} kritisch` : ""}` : "keine Verstöße erkannt"}</div>
              {arbzg.length > 0 && <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 4 }}>{arbzg.slice(0, 6).map((i, ix) => <div key={ix} style={{ fontSize: 11.5, color: i.sev === "er" ? T.erT : T.wT }}>• {i.name}, {i.day + 1}. — {i.msg}</div>)}{arbzg.length > 6 && <div style={{ fontSize: 11, color: T.tx2 }}>… und {arbzg.length - 6} weitere</div>}</div>}
            </div>}
          </div>

          {!curSc && <div style={{ ...crd, textAlign: "center", padding: 44 }}><div style={{ fontSize: 32 }}></div><p style={{ color: T.tx2, margin: "10px 0 0", fontSize: 13 }}>Kein Plan für {plbl}.</p></div>}

          {curSc && planView === "day" && <div style={crd}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>{DW[pdate.getDay()]}, {pdate.getDate()}. {MF[pdate.getMonth()]} {pdate.getFullYear()}</h3>
            {pdate.getMonth() !== m0 || pdate.getFullYear() !== y ? <p style={{ color: T.tx2, fontSize: 12, margin: 0 }}>Tag außerhalb des Planungsmonats.</p> : (() => { const dayIdx = pdate.getDate() - 1; return (<><div>{[...shiftDefs.map(s => s.key), "U", "K"].map(sh => { if (filterShift !== "all" && filterShift !== sh) return null; const ppl = filteredEmps.filter(e => (curSc[e.id] || [])[dayIdx] === sh); const info = getShiftInfo(sh); if (!ppl.length && !isShift(sh)) return null; const phPpl = filteredNonPlanEmps.filter(e => (curSc[e.id] || [])[dayIdx] === sh); if (!ppl.length && !phPpl.length) { return (<div key={sh} style={{ padding: "10px 13px", background: T.er, borderRadius: 10, marginBottom: 6, fontSize: 12, color: T.erT, fontWeight: 600 }}>{info.label} unbesetzt!</div>); } return (<div key={sh} style={{ padding: "12px 14px", background: shBg(sh), borderRadius: 12, marginBottom: 8 }}><div style={{ fontWeight: 700, color: shC(sh), fontSize: 13, marginBottom: 8 }}>{info.label} {info.start && `${info.start}–${info.end}`}{ppl.length < (shiftDefs.find(s=>s.key===sh)?.required||0) && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }}>({ppl.length}/{shiftDefs.find(s=>s.key===sh)?.required} besetzt)</span>}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{ppl.map(e => <div key={e.id} style={{ padding: "5px 12px", background: T.card, borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{e.name}</div>)}{phPpl.map(e => <div key={e.id} style={{ padding: "5px 12px", background: T.card, borderRadius: 20, fontSize: 12, fontWeight: 600, color: T.tx2, border: `1px dashed ${T.bord2}` }}>{e.name} <span style={{ fontSize: 9, opacity: 0.7 }}>Platzh.</span></div>)}</div></div>); })}</div></>); })()}
          </div>}

          {curSc && planView === "week" && <div style={{ ...crd, overflowX: "auto" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Woche ab {viewDays[0]?.toLocaleDateString("de-DE")}</h3>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}><thead><tr><th style={{ padding: "8px 10px", background: T.invBg, color: T.inv, textAlign: "left", minWidth: 120 }}>Mitarbeiter</th>{viewDays.map(d => <th key={d.toISOString()} style={{ padding: "8px", background: T.invBg, color: T.inv, minWidth: 90, textAlign: "center" }}>{DW[d.getDay()]}<br /><span style={{ fontSize: 10, opacity: .7 }}>{d.getDate()}.{d.getMonth() + 1}</span></th>)}</tr></thead><tbody>
              {filteredEmps.map((emp, ri) => { const bg = ri % 2 ? T.bg2 : T.card; return (<tr key={emp.id}><td style={{ padding: "7px 10px", fontWeight: 600, background: bg, borderRight: `1px solid ${T.bord}`, fontSize: 12 }}>{emp.name}</td>{viewDays.map(d => { const inM = d.getMonth() === m0 && d.getFullYear() === y; const dayIdx = inM ? d.getDate() - 1 : null; const sh = inM ? (curSc[emp.id] || [])[dayIdx] : "-"; const dim = filterShift !== "all" && filterShift !== sh; const info = getShiftInfo(sh); const isAbs = sh === "U" || sh === "K"; const grabbable = editMode && isShift(sh) && dayIdx != null; const dragging = dragSh && dragSh.empId === emp.id && dragSh.day === dayIdx; return (<td key={d.toISOString()} style={{ padding: "3px", background: bg, textAlign: "center", opacity: dim ? .3 : 1 }}><div draggable={grabbable} onDragStart={grabbable ? e => { setDragSh({ empId: emp.id, day: dayIdx, key: sh }); e.dataTransfer.effectAllowed = "move"; } : undefined} onDragEnd={() => setDragSh(null)} onDragOver={editMode && dayIdx != null ? e => e.preventDefault() : undefined} onDrop={editMode && dayIdx != null ? e => { e.preventDefault(); if (!dragSh) return; if (isAbs) { flash("er", "Urlaub/Krank lässt sich nicht überschreiben"); setDragSh(null); return; } moveShift(dragSh.empId, dragSh.day, emp.id, dayIdx); } : undefined} onClick={editMode && dayIdx != null ? () => paintCell(emp.id, dayIdx) : undefined} style={{ padding: "7px 6px", borderRadius: 7, background: shBg(sh), color: shC(sh), fontSize: 11, fontWeight: 700, cursor: editMode && dayIdx != null ? (grabbable ? "grab" : "pointer") : "default", opacity: dragging ? .35 : 1, outline: editMode && dragSh && !dragging && !isAbs && dayIdx != null ? `1px dashed ${T.acc}` : "none" }}>{sh === "-" ? "–" : sh}{info.start && <div style={{ fontSize: 8, fontWeight: 400, marginTop: 2 }}>{info.start}–{info.end}</div>}</div></td>); })}</tr>); })}
            </tbody></table>
          </div>}

          {curSc && planView === "month" && <div style={{ ...crd, overflowX: "auto" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{plbl}</h3><div style={{ display: "flex", gap: 7, marginLeft: "auto", flexWrap: "wrap" }}>{[...shiftDefs.map(s => s.key), "U", "K"].map(k => <span key={k} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, color: T.tx2 }}><span style={{ background: shX(k), color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700, fontSize: 9 }}>{k}</span>{getShiftInfo(k).label}</span>)}</div></div>
            <table style={{ borderCollapse: "collapse", fontSize: 10 }}><thead><tr><th style={{ padding: "7px 11px", background: T.invBg, color: T.inv, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 130, whiteSpace: "nowrap", borderRadius: "7px 0 0 0" }}>Team</th>{Array.from({ length: days }, (_, i) => { const dow = new Date(y, m0, i + 1).getDay(), we = dow === 0 || dow === 6; return (<th key={i} style={{ padding: "3px 0", background: we ? T.acc : T.invBg, color: T.inv, minWidth: 22, textAlign: "center" }}><div style={{ fontSize: 7, opacity: .7 }}>{DW[dow]}</div><div style={{ fontSize: 9 }}>{i + 1}</div></th>); })}<th style={{ padding: "7px", background: T.invBg, color: T.inv, textAlign: "center" }}>Σ</th></tr></thead>
              <tbody>
                {filteredEmps.map((emp, ri) => { const row = curSc[emp.id] || Array(days).fill("-"), tot = row.filter(s => isShift(s)).length, bg = ri % 2 ? T.bg2 : T.card; return (
                  <tr key={emp.id}><td style={{ padding: "4px 11px", fontWeight: 600, position: "sticky", left: 0, background: bg, borderRight: `1px solid ${T.bord}`, fontSize: 11, whiteSpace: "nowrap", color: T.tx }}>{emp.name} <span style={{ fontSize: 9, color: T.tx2, fontWeight: 400 }}>{emp.workPct || 100}%</span></td>{row.map((sh, d) => { const dim2 = filterShift !== "all" && filterShift !== sh; const dragging = dragSh && dragSh.empId === emp.id && dragSh.day === d; const isAbs = sh === "U" || sh === "K"; const grabbable = editMode && isShift(sh); return (<td key={d} style={{ padding: "1px", textAlign: "center", background: bg, opacity: dim2 ? .2 : 1 }}><div draggable={grabbable} onDragStart={grabbable ? e => { setDragSh({ empId: emp.id, day: d, key: sh }); e.dataTransfer.effectAllowed = "move"; } : undefined} onDragEnd={() => setDragSh(null)} onDragOver={editMode ? e => e.preventDefault() : undefined} onDrop={editMode ? e => { e.preventDefault(); if (!dragSh) return; if (isAbs) { flash("er", "Tag mit Urlaub/Krank lässt sich nicht überschreiben"); setDragSh(null); return; } moveShift(dragSh.empId, dragSh.day, emp.id, d); } : undefined} onClick={editMode ? () => paintCell(emp.id, d) : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: shBg(sh), color: shC(sh), borderRadius: 5, width: 20, height: 18, fontWeight: 700, fontSize: 9, cursor: editMode ? (grabbable ? "grab" : "pointer") : "default", opacity: dragging ? .35 : 1, outline: arbzgSet.has(emp.id + ":" + d) ? `2px solid ${T.erT}` : (editMode && dragSh && !dragging && !isAbs ? `1px dashed ${T.acc}` : "none") }}>{sh === "-" ? "" : sh}</div></td>); })}<td style={{ padding: "4px 7px", textAlign: "center", fontWeight: 700, background: bg, fontSize: 11, color: T.tx }}>{tot}</td></tr>
                ); })}
                {filteredNonPlanEmps.length > 0 && <tr><td colSpan={days + 2} style={{ padding: "5px 11px", background: T.bg3, borderTop: `1px solid ${T.bord}`, fontSize: 9, fontWeight: 700, color: T.tx2, letterSpacing: .5, position: "sticky", left: 0 }}>PLATZHALTER · nicht im Auto-Plan</td></tr>}
                {filteredNonPlanEmps.map((emp, ri) => { const row = (editMode ? draft : curSc)?.[emp.id] || Array(days).fill("-"); const tot = row.filter(s => isShift(s)).length; const bg = T.bg3; return (
                  <tr key={emp.id} style={{ opacity: 0.7 }}><td style={{ padding: "4px 11px", fontWeight: 600, position: "sticky", left: 0, background: bg, borderRight: `1px solid ${T.bord}`, fontSize: 11, whiteSpace: "nowrap", color: T.tx2 }}>{emp.name} <span style={{ fontSize: 8, background: T.bg2, color: T.tx2, borderRadius: 6, padding: "1px 5px", fontWeight: 600, marginLeft: 3 }}>Platzhalter</span></td>{row.map((sh, d) => { const dim2 = filterShift !== "all" && filterShift !== sh; const dragging = dragSh && dragSh.empId === emp.id && dragSh.day === d; const isAbs = sh === "U" || sh === "K"; const grabbable = editMode && isShift(sh); return (<td key={d} style={{ padding: "1px", textAlign: "center", background: bg, opacity: dim2 ? .2 : 1 }}><div draggable={grabbable} onDragStart={grabbable ? e => { setDragSh({ empId: emp.id, day: d, key: sh }); e.dataTransfer.effectAllowed = "move"; } : undefined} onDragEnd={() => setDragSh(null)} onDragOver={editMode ? e => e.preventDefault() : undefined} onDrop={editMode ? e => { e.preventDefault(); if (!dragSh) return; if (isAbs) { flash("er", "Tag mit Urlaub/Krank lässt sich nicht überschreiben"); setDragSh(null); return; } moveShift(dragSh.empId, dragSh.day, emp.id, d); } : undefined} onClick={editMode && draft?.[emp.id] ? () => paintCell(emp.id, d) : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: shBg(sh), color: shC(sh), borderRadius: 5, width: 20, height: 18, fontWeight: 700, fontSize: 9, cursor: editMode && draft?.[emp.id] ? (grabbable ? "grab" : "pointer") : "default", opacity: dragging ? .35 : 1, outline: editMode && dragSh && !dragging && !isAbs && draft?.[emp.id] ? `1px dashed ${T.acc}` : "none" }}>{sh === "-" ? "" : sh}</div></td>); })}<td style={{ padding: "4px 7px", textAlign: "center", fontWeight: 700, background: bg, fontSize: 11, color: T.tx2 }}>{tot > 0 ? tot : "–"}</td></tr>
                ); })}
                {shiftDefs.map((def, ri) => (
                  <tr key={def.key} style={{ borderTop: `1px solid ${T.bord}` }}><td style={{ padding: "3px 11px", fontSize: 9, fontWeight: 700, color: shC(def.key), position: "sticky", left: 0, background: T.bg2, borderRight: `1px solid ${T.bord}` }}>{def.key}·Soll{def.required}</td>{Array.from({ length: days }, (_, d) => { const c = cov[d]?.[def.key] || 0; return (<td key={d} style={{ padding: "1px", textAlign: "center", background: T.bg2 }}><div style={{ display: "inline-block", background: c >= def.required ? T.ok : T.er, color: c >= def.required ? T.okT : T.erT, borderRadius: 4, width: 20, lineHeight: "15px", fontWeight: 700, fontSize: 9 }}>{c}</div></td>); })}<td style={{ background: T.bg2 }} /></tr>
                ))}
              </tbody>
            </table>
          </div>}

          {curSc && <div style={{ ...crd, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Stundenkonto · {plbl}</h3>
              <span style={{ fontSize: 11, color: T.tx2 }}>Ist (geplante Schichtstunden) vs. Soll ({weekStdHours} h/Woche, anteilig)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredEmps.map(emp => {
                const row = curSc[emp.id] || Array(days).fill("-");
                const ist = calcHours(row), soll = targetHours(emp, days), delta = ist - soll;
                const tol = Math.max(4, soll * 0.05);
                const st = Math.abs(delta) <= tol ? "ok" : delta < 0 ? "under" : "over";
                const [sBg, sTx] = { ok: [T.ok, T.okT], under: [T.w, T.wT], over: [T.bl, T.blT] }[st];
                const pct = soll > 0 ? Math.min(ist / soll, 1.3) / 1.3 * 100 : 0;
                const sollMark = 1 / 1.3 * 100;
                const uD = row.filter(s => s === "U").length, kD = row.filter(s => s === "K").length;
                return (<div key={emp.id} style={{ padding: "10px 12px", background: T.bg2, borderRadius: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</span>
                    <span style={{ fontSize: 10, color: T.tx2 }}>{emp.workPct || 100}%</span>
                    {uD > 0 && <span style={{ fontSize: 10, background: shBg("U"), color: shC("U"), borderRadius: 20, padding: "1px 7px", fontWeight: 600 }}>{uD}× U</span>}
                    {kD > 0 && <span style={{ fontSize: 10, background: shBg("K"), color: shC("K"), borderRadius: 20, padding: "1px 7px", fontWeight: 600 }}>{kD}× K</span>}
                    <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700 }}>{fmtH(ist)} <span style={{ color: T.tx2, fontWeight: 400 }}>/ {fmtH(soll)}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: sBg, color: sTx, borderRadius: 20, padding: "2px 10px", minWidth: 54, textAlign: "center" }}>{delta >= 0 ? "+" : "−"}{fmtH(Math.abs(delta))}</span>
                  </div>
                  <div style={{ height: 7, background: T.bg3, borderRadius: 5, position: "relative", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: sTx, borderRadius: 5, transition: "width .3s" }} />
                    <div style={{ position: "absolute", left: `${sollMark}%`, top: -1, bottom: -1, width: 2, background: T.tx2, opacity: .45 }} />
                  </div>
                </div>);
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: T.tx2 }}>Die Markierung kennzeichnet das Soll (100%). Urlaub und Krank zählen nicht als geleistete Stunden. <span style={{ color: T.wT }}>Gelb</span> = unter Soll · <span style={{ color: T.okT }}>Grün</span> = im Soll · <span style={{ color: T.blT }}>Blau</span> = über Soll (Mehrstunden).</div>
          </div>}
        </div>}

        {aTab === "settings" && <div>
          {!isOwner && !can("manageOrg") && !can("manageShifts") && <div style={{ ...crd, textAlign: "center", padding: 32 }}><div style={{ color: T.tx2, display: "flex", justifyContent: "center" }}><Icon n="lock" s={26} /></div><p style={{ color: T.tx2, margin: "10px 0 0", fontSize: 13 }}>Du hast keine Berechtigung für Betriebseinstellungen.</p><p style={{ color: T.tx2, margin: "4px 0 0", fontSize: 11 }}>Nur Inhaber und Berechtigte können hier Änderungen vornehmen.</p></div>}

          {(isOwner || can("manageOrg")) && <div style={{ ...crd, marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Betriebsdaten</h3>
            <label style={lbl}>Name</label><input style={inp} value={orgEd?.name ?? org.name} onChange={e => setOrgEd(p => ({ ...(p || { name: org.name, sub: org.sub, weekStdHours: org.weekStdHours || 40 }), name: e.target.value }))} />
            <label style={lbl}>Untertitel</label><input style={inp} value={orgEd?.sub ?? org.sub} onChange={e => setOrgEd(p => ({ ...(p || { name: org.name, sub: org.sub, weekStdHours: org.weekStdHours || 40 }), sub: e.target.value }))} />
            <label style={lbl}>Standard-Wochenstunden (Vollzeit)</label><input style={inp} type="number" min="20" max="48" value={orgEd?.weekStdHours ?? weekStdHours} onChange={e => setOrgEd(p => ({ ...(p || { name: org.name, sub: org.sub, weekStdHours: org.weekStdHours || 40 }), weekStdHours: Number(e.target.value) || 40 }))} />
            <div style={{ marginTop: 12, padding: "11px 13px", background: T.bg2, borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Verfügbarkeit — Wer darf sie hinterlegen?</div>
              {[["adminOnly", "Nur Admins / Shopleiter (Standard)"], ["empSelf", "Mitarbeiter hinterlegen selbst im Profil"]].map(([v, l]) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, cursor: "pointer", fontSize: 12 }}>
                  <input type="radio" name="availMode" value={v}
                    checked={(orgEd?.availMode ?? org.availMode ?? "adminOnly") === v}
                    onChange={() => setOrgEd(p => ({ ...(p || { name: org.name, sub: org.sub, weekStdHours: org.weekStdHours || 40 }), availMode: v }))} />
                  {l}
                </label>
              ))}
              <p style={{ fontSize: 10, color: T.tx2, margin: "6px 0 0" }}>Im Modus "Mitarbeiter selbst" erscheint die Verfügbarkeits-Matrix im Profil-Tab jedes Mitarbeiters und wird vom Auto-Planer übernommen.</p>
            </div>
            {orgEd && <button style={{ ...btn("p"), marginTop: 14 }} onClick={saveOrgEdits}><Icon n="check" s={15} />Speichern</button>}
            <label style={lbl}>Akzentfarbe</label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 2 }}>
              {ACCENTS.map(c => { const active = (org.accent || "#4f46e5") === c; return <button key={c} onClick={() => setAccent(c)} title={c} style={{ width: 32, height: 32, borderRadius: 9, background: c, cursor: "pointer", border: active ? `2.5px solid ${T.tx}` : `1px solid ${T.bord2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{active && <Icon n="check" s={15} style={{ color: "#fff" }} />}</button>; })}
            </div>
            <div style={{ marginTop: 14, padding: "11px 13px", background: T.bg2, borderRadius: 10, fontSize: 12, color: T.tx2, display: "flex", alignItems: "center", gap: 8 }}><Icon n="building" s={15} /><span>Betriebs-ID für Logins: <strong style={{ fontFamily: "ui-monospace,monospace", color: T.acc, letterSpacing: 1.5 }}>{org.code}</strong></span></div>
          </div>}

          {(isOwner || can("manageOrg")) && <div style={{ ...crd, marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Zeiterfassung</h3>
            <label style={lbl}>Stempeluhr für Mitarbeiter</label>
            <select style={inp} value={org.timeclock ?? 'self'} onChange={e => setTimeclock(e.target.value)}>
              <option value="self">Aktiviert — Mitarbeiter können stempeln</option>
              <option value="off">Deaktiviert — Stempeluhr wird nicht angezeigt</option>
            </select>
            <p style={{ fontSize: 11, color: T.tx2, margin: "4px 0 0" }}>Manche Betriebe benötigen keine Zeiterfassung. Die Einstellung wirkt sofort.</p>
          </div>}

          {isOwner && <div style={{ ...crd, marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700 }}>Abo & Betrieb</h3>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: T.tx2 }}>Tarif und Status werden vom Anbieter verwaltet.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 130, padding: "12px 13px", background: T.bg2, borderRadius: 12 }}><div style={{ fontSize: 11, color: T.tx2, marginBottom: 5 }}>Aktueller Tarif</div><div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Schibsted Grotesk',sans-serif" }}>{orgPlan.l}</div><div style={{ fontSize: 11, color: T.tx2, marginTop: 2 }}>{orgPlan.price}</div></div>
              <div style={{ flex: 1, minWidth: 130, padding: "12px 13px", background: T.bg2, borderRadius: 12 }}><div style={{ fontSize: 11, color: T.tx2, marginBottom: 5 }}>Status</div><div style={{ fontSize: 16, fontWeight: 800, color: (STATUS[orgStatus] || STATUS.active).col, fontFamily: "'Schibsted Grotesk',sans-serif" }}>{(STATUS[orgStatus] || STATUS.active).l}</div>{orgStatus === "trial" && trialDaysLeft != null && <div style={{ fontSize: 11, color: T.tx2, marginTop: 2 }}>noch {Math.max(0, trialDaysLeft)} Tage</div>}</div>
            </div>
            <div style={{ fontSize: 11, color: T.tx2, marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>Sitzplätze (Mitarbeiter)</span><span style={{ fontWeight: 700, color: seatFull ? T.erT : T.tx }}>{seatUsed} / {seatLimit === Infinity ? "∞" : seatLimit}</span></div>
            <div style={{ height: 7, background: T.bg3, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${seatLimit === Infinity ? Math.min(seatUsed, 50) / 50 * 100 : Math.min(seatUsed / seatLimit * 100, 100)}%`, background: seatFull ? T.erT : T.acc, borderRadius: 5 }} /></div>
            {seatFull && <p style={{ fontSize: 11, color: T.erT, margin: "6px 0 0" }}>Limit erreicht – für mehr Mitarbeiter ein Upgrade durchführen.</p>}
            {orgPlan.order < 40 && (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_ENABLED) === "true" && <div style={{ borderTop: `1px solid ${T.bord}`, marginTop: 16, paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Tarif upgraden</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(PLANS).filter(([k, p]) => p.order > orgPlan.order && k !== "free" && k !== "trial").map(([k, p]) => (
                  <button key={k} style={{ ...btn("p", true), flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 14px" }} onClick={() => startCheckout(k)}>
                    <span style={{ fontWeight: 800 }}>{p.l}</span>
                    <span style={{ fontSize: 10, fontWeight: 400, opacity: .8 }}>{p.price}</span>
                  </button>
                ))}
              </div>
            </div>}
            <div style={{ borderTop: `1px solid ${T.bord}`, marginTop: 16, paddingTop: 14 }}>
              {orgStatus !== "archived"
                ? <button style={btn("w")} onClick={async () => { if (!confirm("Betrieb offline nehmen? Mitarbeiter können sich dann nicht mehr anmelden.")) return; await setOrgStatus(orgId, "archived"); flash("ok", "Betrieb offline genommen"); }}><Icon n="lock" s={15} />Betrieb offline nehmen</button>
                : <button style={btn("ok")} onClick={async () => { await setOrgStatus(orgId, "active"); flash("ok", "Betrieb wieder aktiv"); }}><Icon n="check" s={15} />Betrieb reaktivieren</button>}
              <p style={{ fontSize: 10.5, color: T.tx2, margin: "8px 0 0" }}>Offline = pausiert: Daten bleiben erhalten, nur die Anmeldung ist gesperrt.</p>
            </div>
          </div>}

          {(isOwner || can("manageShifts")) && <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><Icon n="clock" s={16} />Schichtmodelle ({shiftDefs.length})</h3><button style={btn("p", true)} onClick={() => setEditShift({ label: "", key: "", start: "06:00", end: "14:00", required: 1, colorIdx: shiftDefs.length % SHIFT_COLORS.length })}><Icon n="plus" s={14} />Neue Schicht</button></div>
            {!shiftDefs.length && <p style={{ color: T.tx2, fontSize: 13, textAlign: "center", padding: "16px 0", margin: 0 }}>Noch keine Schichten definiert.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {shiftDefs.map((s, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: T.bg2, borderRadius: 12, flexWrap: "wrap" }}>
                <div style={{ padding: "4px 10px", background: shBg(s.key), color: shC(s.key), borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{s.key}</div>
                <div style={{ flex: 1, minWidth: 120 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</div><div style={{ fontSize: 11, color: T.tx2 }}>{s.start}–{s.end} · {hoursOf(s.start, s.end)}h · Min. {s.required} MA</div></div>
                <button style={btn("s", true)} onClick={() => setEditShift({ ...s, idx: i })}></button>
                <button style={btn("er", true)} onClick={() => delShift(i)}></button>
              </div>)}
            </div>
          </div>}

          {(isOwner || can("manageOrg")) && <div style={{ ...crd, marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Wunschfrei-Sperrtage</h3>
            <p style={{ fontSize: 12, color: T.tx2, margin: "0 0 12px" }}>An diesen Tagen können Mitarbeiter keine Wunschfrei beantragen.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} style={{ ...inp, width: "auto" }} />
              <input placeholder="Bezeichnung" value={holidayName} onChange={e => setHolidayName(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} />
              <button style={btn("p", true)} onClick={addHoliday}>+ Hinzufügen</button>
            </div>
            {!holidays.length ? <p style={{ color: T.tx2, fontSize: 12, margin: 0 }}>Keine Sperrtage definiert.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{holidays.map((h, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.bg2, borderRadius: 10 }}><span style={{ fontWeight: 600, fontSize: 12, minWidth: 90 }}>{h.date}</span><span style={{ flex: 1, fontSize: 12 }}>{h.name}</span><button style={btn("er", true)} onClick={() => delHoliday(i)}></button></div>)}</div>}
          </div>}

          {isOwner && <div style={crd}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Berechtigungen pro Rolle</h3>
            <p style={{ fontSize: 12, color: T.tx2, margin: "0 0 12px" }}>Lege fest, welche Rolle welche Aktion ausführen darf. Inhaber kann immer alles.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead><tr><th style={{ padding: "8px 10px", textAlign: "left", background: T.bg2 }}>Berechtigung</th>{["director", "manager", "staff"].map(r => <th key={r} style={{ padding: "8px", background: T.bg2, textAlign: "center" }}>{ROLES[r].l}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(PERMS).map(([k, l]) => <tr key={k} style={{ borderTop: `1px solid ${T.bord}` }}><td style={{ padding: "8px 10px" }}>{l}</td>{["director", "manager", "staff"].map(r => <td key={r} style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" checked={!!(permsByRole[r] || DEFAULT_PERMS[r])[k]} onChange={e => setPerm(r, k, e.target.checked)} /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
          </div>}
        </div>}
      </div>
    </div>
  );
}
