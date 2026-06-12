import { useApp } from "../../App.jsx";
import { Icon } from "../../theme/icons.jsx";

export default function EmpView() {
  const {
    T, crd, inp, lbl, btn,
    org, orgId, me, wasSuper, canManage,
    emps, wishes, scheds, reqs: reqList, shiftDefs, holidays,
    eTab, setETab, empPlanView, setEmpPlanView,
    wishMonth, setWishMonth, wsel, wishNote, setWishNote,
    rqForm, setRqForm, rqTab, setRqTab, pinCh, setPinCh,
    myStamp, today, cm, nm, cy, cm0, ny, nm0, nmD,
    market,
    MF, DW, PR, ROLES,
    getShiftInfo, shBg, shC, shX, doICS,
    setIsSuper, setWasSuper, setOrgId, setMe, setView, setATab,
    flash, logout, doClock, offerShift, withdrawOffer, takeShift,
    saveWishes, togWish, loadWishes, savePref, doChPin, submitRq,
    pm, nms,
    Tst, DarkBtn, NotifBell, NotifPanel, Header, TabBar, Avatar,
  } = useApp();

  const myRqs = reqList.filter(r => r.uid === me.id);
  const myPlanCur = scheds[cm]?.[me.id] || null;
  const myPlanNxt = scheds[nm]?.[me.id] || null;
  const upcoming = [];
  [[myPlanCur, cy, cm0], [myPlanNxt, ny, nm0]].forEach(([sc, yy, mm0]) => {
    if (!sc) return;
    sc.forEach((sh, i) => {
      if (shiftDefs.some(s => s.key === sh)) {
        const d = new Date(yy, mm0, i + 1);
        if (d >= today) upcoming.push({ d, sh, day: i + 1, mo: mm0 });
      }
    });
  });
  upcoming.sort((a, b) => a.d - b.d);

  const MiniCal = (sc, y, m0) => {
    if (!sc) return <p style={{ color: T.tx2, fontSize: 13, textAlign: "center", padding: "24px 0", margin: 0 }}>Noch kein Plan veröffentlicht.</p>;
    const ts = today.toDateString();
    const sd = new Date(y, m0, 1).getDay();
    return (<>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button style={btn("bl", true)} onClick={() => doICS(sc, me.name, y, m0, shiftDefs)}>In Kalender</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 10 }}>
        {DW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.tx2, fontWeight: 600, padding: "3px 0" }}>{d}</div>)}
        {Array.from({ length: sd }, (_, i) => <div key={`s${i}`} />)}
        {sc.map((sh, i) => {
          const iT = new Date(y, m0, i + 1).toDateString() === ts;
          return (<div key={i} style={{ aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: shBg(sh), border: iT ? `2px solid ${shX(sh)}` : "1px solid transparent", boxSizing: "border-box" }}>
            <div style={{ fontSize: 8, color: T.tx2 }}>{i + 1}</div>
            <div style={{ fontWeight: 800, fontSize: 11, color: shC(sh) }}>{sh === "-" ? "" : sh}</div>
          </div>);
        })}
      </div>
    </>);
  };

  const empWeek = () => {
    const t = today, s = new Date(t);
    s.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
  };

  const open = market.filter(m => m.status === "open");
  const myOffers = open.filter(m => m.empId === me.id);
  const others = open.filter(m => m.empId !== me.id);
  const myUpcoming = upcoming.filter(s => s.d > today).slice(0, 10);
  const dLbl = m => `${m.day + 1}.${Number(m.mo.toString().slice(5, 7))}.`;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      {Tst}
      {NotifPanel}
      {Header(
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><Avatar emp={me} size={30} />{me.name}</span>,
        `${org.name.toUpperCase()} · ${org.code}`,
        <>{DarkBtn}{NotifBell}
          {wasSuper && <button style={{ ...btn("pu", true), padding: "7px 10px" }} onClick={() => { setIsSuper(true); setWasSuper(false); setOrgId(null); setMe(null); setView("super"); }} title="Anbieter-Konsole"><Icon n="shield" /></button>}
          {canManage && <button style={{ ...btn("bl", true), padding: "7px 10px" }} onClick={() => { setView("admin"); setATab("dash"); }} title="Verwaltung"><Icon n="lock" /></button>}
          <button style={{ ...btn("s", true), padding: "7px 10px" }} onClick={logout} title="Abmelden"><Icon n="logout" /></button>
        </>
      )}
      {TabBar([["home", "Start", "home"], ["plan", "Plan", "calendar"], ["reqs", "Anfragen", "inbox"], ["profile", "Profil", "user"]], eTab, setETab)}

      <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>

        {eTab === "home" && <div>
          <div style={{ ...crd, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 14 }}><Icon n="clock" s={16} />Stempeluhr</div>
              <div style={{ fontSize: 12, color: T.tx2, marginTop: 3 }}>
                {myStamp?.in && !myStamp?.out
                  ? <>Eingestempelt seit <strong style={{ color: T.okT }}>{new Date(myStamp.in).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</strong> Uhr</>
                  : myStamp?.out
                    ? <>Heute erfasst: <strong>{((myStamp.out - myStamp.in) / 36e5).toFixed(1).replace(".", ",")} h</strong> ({new Date(myStamp.in).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–{new Date(myStamp.out).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})</>
                    : "Noch nicht eingestempelt."}
              </div>
            </div>
            {(!myStamp || myStamp.out)
              ? <button style={btn("p")} onClick={doClock} disabled={!!myStamp?.out} title={myStamp?.out ? "Heute bereits ausgestempelt" : ""}><Icon n="clock" s={15} />{myStamp?.out ? "Erfasst" : "Einstempeln"}</button>
              : <button style={btn("er")} onClick={doClock}><Icon n="clock" s={15} />Ausstempeln</button>}
          </div>
          <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Nächste Schichten</h3>
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bord2}` }}>
                {[["list", "Liste"], ["week", "Woche"], ["month", "Monat"]].map(([k, l]) => <button key={k} onClick={() => setEmpPlanView(k)} style={{ padding: "5px 10px", border: "none", background: empPlanView === k ? T.invBg : T.bg, color: empPlanView === k ? T.inv : T.tx, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{l}</button>)}
              </div>
            </div>
            {empPlanView === "list" && (!upcoming.length
              ? <p style={{ color: T.tx2, fontSize: 13, margin: 0 }}>Noch kein Plan.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.slice(0, 7).map((s, i) => {
                  const isT = s.d.toDateString() === today.toDateString();
                  const info = getShiftInfo(s.sh);
                  return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: shBg(s.sh), borderRadius: 14, padding: "12px 14px", border: isT ? `2px solid ${shX(s.sh)}` : "1px solid transparent" }}>
                    <div style={{ background: shX(s.sh), color: "#fff", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{s.sh}</div>
                    <div><div style={{ fontWeight: 700, color: shC(s.sh), fontSize: 14 }}>{info.label} · {info.start}–{info.end}</div><div style={{ fontSize: 12, color: T.tx2 }}>{isT && <strong style={{ color: shX(s.sh) }}>Heute · </strong>}{DW[s.d.getDay()]}, {s.day}. {MF[s.mo]}</div></div>
                  </div>);
                })}
              </div>)}
            {empPlanView === "week" && <div style={{ marginTop: 8 }}>
              {empWeek().map((d, i) => {
                const ms = d.getMonth() === cm0 ? myPlanCur : d.getMonth() === nm0 ? myPlanNxt : null;
                const sh = ms ? ms[d.getDate() - 1] : "-";
                const info = getShiftInfo(sh);
                const isT = d.toDateString() === today.toDateString();
                return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: shBg(sh), borderRadius: 10, padding: "9px 12px", marginBottom: 5, border: isT ? `2px solid ${shX(sh)}` : "1px solid transparent" }}>
                  <div style={{ minWidth: 50, fontSize: 11, fontWeight: 600, color: T.tx2 }}>{DW[d.getDay()]} {d.getDate()}.</div>
                  <div style={{ flex: 1, fontWeight: 700, color: shC(sh), fontSize: 13 }}>{sh === "-" ? "Frei" : info.label}{info.start && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>{info.start}–{info.end}</span>}</div>
                </div>);
              })}
            </div>}
            {empPlanView === "month" && MiniCal(myPlanCur, cy, cm0)}
          </div>
        </div>}

        {eTab === "plan" && <>
          <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><Icon n="repeat" s={16} /><h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Schichtbörse</h3>{others.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, background: T.bl, color: T.blT, borderRadius: 20, padding: "2px 8px" }}>{others.length} offen</span>}</div>
            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.tx2 }}>Schicht abgeben oder von Kollegen übernehmen — Ruhezeiten werden automatisch geprüft, Leitung wird informiert.</p>
            {others.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
              {others.map(o => <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: shBg(o.key), borderRadius: 11 }}>
                <div style={{ background: shX(o.key), color: "#fff", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{o.key}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 12.5, color: shC(o.key) }}>{getShiftInfo(o.key).label} am {o.day + 1}.{Number(o.mo.slice(5, 7))}.</div><div style={{ fontSize: 11, color: T.tx2 }}>von {o.empName}</div></div>
                <button style={btn("p", true)} onClick={() => takeShift(o)}>Übernehmen</button>
              </div>)}
            </div>}
            {myOffers.length > 0 && <div style={{ marginBottom: 12 }}>
              {myOffers.map(o => <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", background: T.bg2, borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, flex: 1 }}>Du bietest <strong>{o.key}</strong> am {o.day + 1}.{Number(o.mo.slice(5, 7))}. an</span>
                <button style={btn("s", true)} onClick={() => withdrawOffer(o.id)}>Zurückziehen</button>
              </div>)}
            </div>}
            {myUpcoming.length > 0
              ? <details><summary style={{ fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: T.acc }}>Eigene Schicht abgeben</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
                  {myUpcoming.map((s, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", background: T.bg2, borderRadius: 10 }}>
                    <span style={{ fontSize: 12, flex: 1 }}><strong>{s.sh}</strong> · {DW[s.d.getDay()]}, {s.day}. {MF[s.mo]}</span>
                    <button style={btn("w", true)} onClick={() => offerShift(s.mo === cm0 ? cm : nm, s.day - 1, s.sh)}>Anbieten</button>
                  </div>)}
                </div>
              </details>
              : !others.length && !myOffers.length && <p style={{ margin: 0, fontSize: 12, color: T.tx2 }}>Keine offenen Angebote und keine kommenden Schichten.</p>}
          </div>
          <div style={{ ...crd, marginBottom: 12 }}><h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>{MF[cm0]} {cy}</h3>{MiniCal(myPlanCur, cy, cm0)}</div>
          <div style={crd}><h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>{MF[nm0]} {ny}</h3>{MiniCal(myPlanNxt, ny, nm0)}</div>
        </>}

        {eTab === "reqs" && <div>
          <div style={{ display: "flex", marginBottom: 12, background: T.bg2, borderRadius: 12, padding: 4, gap: 4 }}>
            {[["new", "Neue"], ["wish", "Wunschfrei"], ["sent", "Verlauf"]].map(([k, l]) => <button key={k} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: rqTab === k ? 700 : 500, background: rqTab === k ? T.invBg : "transparent", color: rqTab === k ? T.inv : T.tx2 }} onClick={() => setRqTab(k)}>{l}</button>)}
          </div>

          {rqTab === "new" && <div style={crd}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Anfrage stellen</h3>
            <label style={lbl}>Art</label><select style={inp} value={rqForm.type} onChange={e => setRqForm(p => ({ ...p, type: e.target.value }))}><option value="vac">Urlaubsantrag</option><option value="sick">Krankmeldung</option><option value="swap">Schichttausch</option></select>
            {rqForm.type === "sick" && <><label style={lbl}>Von</label><input style={inp} type="date" value={rqForm.fromDate} onChange={e => setRqForm(p => ({ ...p, fromDate: e.target.value }))} /><label style={lbl}>Bis (optional)</label><input style={inp} type="date" value={rqForm.toDate} onChange={e => setRqForm(p => ({ ...p, toDate: e.target.value }))} /></>}
            {rqForm.type === "vac" && <>
              <label style={lbl}>Urlaubstage ({rqForm.dates.length})</label>
              <p style={{ fontSize: 10, color: T.tx2, margin: "0 0 4px" }}>Wähle einen oder mehrere Tage. Sperrtage des Betriebs sind ausgeschlossen.</p>
              {(() => {
                const vacM = pm(nms());
                return <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginTop: 4 }}>
                  {DW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.tx2, padding: "2px 0" }}>{d}</div>)}
                  {Array.from({ length: new Date(vacM.y, vacM.m0, 1).getDay() }, (_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: vacM.days }, (_, i) => {
                    const d = i + 1, ds = `${vacM.y}-${String(vacM.m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const sel = rqForm.dates.includes(ds);
                    const blocked = holidays.some(h => h.date === ds);
                    return (<button key={d} disabled={blocked} onClick={() => setRqForm(p => ({ ...p, dates: sel ? p.dates.filter(x => x !== ds) : [...p.dates, ds] }))} style={{ aspectRatio: "1", borderRadius: 7, border: "none", cursor: blocked ? "not-allowed" : "pointer", fontSize: 11, fontWeight: sel ? 700 : 400, background: blocked ? T.er : sel ? T.invBg : T.bg2, color: blocked ? T.erT : sel ? T.inv : T.tx, opacity: blocked ? .5 : 1 }}>{d}</button>);
                  })}
                </div>;
              })()}
            </>}
            {rqForm.type === "swap" && <><label style={lbl}>Mein Tag</label><input style={inp} type="date" value={rqForm.fromDate} onChange={e => setRqForm(p => ({ ...p, fromDate: e.target.value }))} /><label style={lbl}>Mit wem</label><select style={inp} value={rqForm.toId} onChange={e => setRqForm(p => ({ ...p, toId: e.target.value }))}><option value="">– Kollege –</option>{emps.filter(e => e.id !== me.id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><label style={lbl}>Deren Tag</label><input style={inp} type="date" value={rqForm.toDate} onChange={e => setRqForm(p => ({ ...p, toDate: e.target.value }))} /></>}
            <label style={lbl}>Begründung / Notiz</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} placeholder="Hilft der Führungskraft bei der Entscheidung" value={rqForm.note} onChange={e => setRqForm(p => ({ ...p, note: e.target.value }))} />
            <button style={{ ...btn("p"), marginTop: 12, width: "100%" }} onClick={submitRq}>Absenden</button>
          </div>}

          {rqTab === "wish" && <div style={crd}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Wunschfrei</h3>
              <input type="month" value={wishMonth} onChange={e => { setWishMonth(e.target.value); loadWishes(e.target.value); }} style={{ ...inp, width: "auto", fontSize: 12, padding: "5px 9px" }} />
            </div>
            <p style={{ margin: "0 0 12px", color: T.tx2, fontSize: 12 }}>Bis zu 3 Tage ({wsel.length}/3). Sperrtage sind ausgeschlossen.</p>
            {(() => {
              const { y, m0, days: wd } = pm(wishMonth);
              return <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 10 }}>
                {DW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.tx2, padding: "2px 0" }}>{d}</div>)}
                {Array.from({ length: new Date(y, m0, 1).getDay() }, (_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: wd }, (_, i) => {
                  const d = i + 1, sel = wsel.includes(d);
                  const ds = `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const blocked = holidays.some(h => h.date === ds);
                  return (<button key={d} disabled={blocked} onClick={() => togWish(d)} style={{ aspectRatio: "1", borderRadius: 7, border: "none", cursor: blocked ? "not-allowed" : "pointer", fontWeight: sel ? 700 : 400, fontSize: 11, background: blocked ? T.er : sel ? T.invBg : T.bg2, color: blocked ? T.erT : sel ? T.inv : T.tx, opacity: blocked ? .5 : 1 }}>{d}</button>);
                })}
              </div>;
            })()}
            <label style={lbl}>Begründung (hilft KI & Führungskraft)</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} placeholder="z. B. Arzttermin, Familienfeier..." value={wishNote} onChange={e => setWishNote(e.target.value)} />
            <button style={{ ...btn("p"), width: "100%", marginTop: 12 }} onClick={saveWishes}>Wunschfrei speichern</button>
          </div>}

          {rqTab === "sent" && <div>
            <div style={{ ...crd, marginBottom: 12 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Wunschfrei-Verlauf</h3>
              {(() => {
                const myWishes = Object.entries(wishes).filter(([k]) => k.endsWith(`-${me.id}`)).map(([k, v]) => ({ key: k, month: k.replace(`-${me.id}`, ""), data: v })).filter(w => w.data && (Array.isArray(w.data) ? w.data.length : w.data.days?.length));
                return !myWishes.length
                  ? <p style={{ color: T.tx2, fontSize: 12, margin: 0 }}>Noch keine gespeichert.</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {myWishes.map(w => {
                      const days = Array.isArray(w.data) ? w.data : (w.data.days || []);
                      const note = w.data.note || "";
                      const { m0, y } = pm(w.month);
                      return (<div key={w.key} style={{ padding: "8px 12px", background: T.bg2, borderRadius: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{MF[m0]} {y}</div>
                        <div style={{ fontSize: 11, color: T.tx2 }}>Tage: {days.sort((a, b) => a - b).join(", ")}{note && ` · "${note}"`}</div>
                      </div>);
                    })}
                  </div>;
              })()}
            </div>
            <div style={crd}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Anfragen-Verlauf</h3>
              {!myRqs.length && <p style={{ color: T.tx2, textAlign: "center", padding: "16px 0", margin: 0, fontSize: 13 }}>Keine Anfragen.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[...myRqs].reverse().map(r => {
                  const sL = { pending: [T.w, T.wT, "⏳ Offen"], ok: [T.ok, T.okT, "✓ Genehmigt"], no: [T.er, T.erT, "✗ Abgelehnt"] };
                  const [bg, col, l] = sL[r.status] || sL.pending;
                  return (<div key={r.id} style={{ padding: "10px 13px", background: bg, borderRadius: 11 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: col }}>{{ sick: "Krankmeldung", vac: "Urlaub", swap: "Tausch" }[r.type]}</div>
                    <div style={{ fontSize: 12, color: col, opacity: .8 }}>{r.fromDate || r.dates?.slice(0, 3).join(", ") || r.date}{r.note && ` · "${r.note}"`}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: col, marginTop: 2 }}>{l}</div>
                    {r.decisionNote && <div style={{ fontSize: 11, color: col, marginTop: 4, fontStyle: "italic" }}>Antwort: {r.decisionNote}</div>}
                  </div>);
                })}
              </div>
            </div>
          </div>}
        </div>}

        {eTab === "profile" && <div>
          <div style={{ ...crd, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 13, alignItems: "center", padding: 13, background: T.bg2, borderRadius: 13, marginBottom: 13 }}>
              <Avatar emp={me} size={52} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{me.name}</div>
                <div style={{ fontSize: 12, color: T.tx2 }}>ID: {me.lid} · {me.workPct || 100}%-Stelle</div>
                <div style={{ fontSize: 12, color: ROLES[me.role || "staff"].col, fontWeight: 700 }}>{ROLES[me.role || "staff"].l}</div>
              </div>
            </div>
            <label style={lbl}>Bevorzugte Schicht</label>
            <select style={inp} value={me.pref || "any"} onChange={e => savePref(e.target.value)}>
              {PR.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
              {shiftDefs.map(s => <option key={s.key} value={s.key}>Nur {s.label}</option>)}
            </select>
          </div>
          <div style={crd}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>PIN ändern</h3>
            {[["Aktuell", "cur"], ["Neu (≥4)", "nw"], ["Bestätigen", "cf"]].map(([l, k]) => <div key={k}><label style={lbl}>{l}</label><input style={{ ...inp, letterSpacing: 6, fontWeight: 700, textAlign: "center" }} type="password" placeholder="••••" value={pinCh[k]} onChange={e => setPinCh(p => ({ ...p, [k]: e.target.value }))} /></div>)}
            <button style={{ ...btn("p"), marginTop: 14, width: "100%" }} onClick={doChPin}>Speichern</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
