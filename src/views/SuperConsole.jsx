import { useApp } from "../App.jsx";
import { Icon } from "../theme/icons.jsx";

export default function SuperConsoleView() {
  const {
    T, crd, inp, lbl, btn,
    orgs, orgId, setOrgId, setData, setMe, setIsSuper, setWasSuper, setView, setATab,
    updOrg, saveOrgs, db, flash, logout,
    PLANS, STATUS,
    Header, DarkBtn, Tst,
  } = useApp();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      {Tst}
      {Header("Super-Admin · Anbieter-Konsole", "SHIFTSYNC PRO", <>{DarkBtn}<button style={btn("s", true)} onClick={logout}>Logout</button></>)}
      <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ ...crd, marginBottom: 14, background: T.pu, borderColor: T.puT + "40" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, color: T.puT }}>Anbieter-Bereich</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.puT }}>Kunden-Betriebe anlegen, Tarife verwalten, offline nehmen/reaktivieren, für Support einloggen.</p>
        </div>
        <div style={{ ...crd, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Kunden-Betriebe ({orgs.length})</h3>
            <button style={btn("p")} onClick={() => setView("setup")}><Icon n="plus" s={15} />Neuen Kunden anlegen</button>
          </div>
          {!orgs.length && <p style={{ color: T.tx2, textAlign: "center", padding: "28px 0", margin: 0, fontSize: 13 }}>Noch keine Kunden.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {orgs.map(o => {
              const st = o.status || "active";
              const pl = PLANS[o.plan] || PLANS.pro;
              const sd = STATUS[st] || STATUS.active;
              return (
                <div key={o.id} style={{ padding: "13px 14px", background: T.bg2, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: st === "archived" ? .6 : 1 }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>{o.name}<span style={{ fontSize: 9.5, fontWeight: 700, background: sd.col + "22", color: sd.col, borderRadius: 20, padding: "2px 8px" }}>{sd.l}</span></div>
                    <div style={{ fontSize: 11, color: T.tx2, marginTop: 2 }}>ID: <strong style={{ fontFamily: "ui-monospace,monospace", letterSpacing: 1, color: T.acc }}>{o.code}</strong> · {pl.l} · {pl.price}</div>
                  </div>
                  <select value={o.plan && PLANS[o.plan] ? o.plan : "pro"} onChange={e => updOrg(o.id, { plan: e.target.value, status: e.target.value === "trial" ? "trial" : (st === "trial" ? "active" : st) })} style={{ ...inp, width: "auto", padding: "6px 9px", fontSize: 12 }}>
                    {Object.entries(PLANS).sort((a, b) => a[1].order - b[1].order).map(([k, p]) => <option key={k} value={k}>{p.l}</option>)}
                  </select>
                  {st !== "archived"
                    ? <button style={btn("w", true)} onClick={() => updOrg(o.id, { status: "archived" })} title="Offline nehmen"><Icon n="lock" s={14} />Offline</button>
                    : <button style={btn("ok", true)} onClick={() => updOrg(o.id, { status: "active" })} title="Reaktivieren"><Icon n="check" s={14} />Reaktivieren</button>}
                  <button style={btn("bl", true)} onClick={async () => {
                    try {
                      const d = await db.get(`org_${o.id}`);
                      const safe = d || { emps: [], wishes: {}, scheds: {}, reqs: [] };
                      if (!Array.isArray(safe.reqs)) safe.reqs = [];
                      const owner = (safe.emps || []).find(e => e.role === "owner") || (safe.emps || [])[0];
                      if (!owner) { flash("er", `${o.name} hat noch keinen Account`); return; }
                      setOrgId(o.id); setData(safe); setMe(owner); setIsSuper(false); setWasSuper(true); setView("admin"); setATab("dash");
                    } catch (e) { flash("er", e.message || "Betrieb konnte nicht geladen werden"); }
                  }}><Icon n="logout" s={14} />Support</button>
                  <button style={{ ...btn("er", true), padding: "7px 9px" }} onClick={async () => {
                    if (!confirm(`${o.name} und ALLE Daten endgültig löschen?`)) return;
                    await saveOrgs(orgs.filter(x => x.id !== o.id));
                    await db.set(`org_${o.id}`, null);
                    flash("ok", `${o.name} gelöscht`);
                  }} title="Endgültig löschen"><Icon n="trash" s={14} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
