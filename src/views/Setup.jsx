import { useApp } from "../App.jsx";
import { Icon } from "../theme/icons.jsx";

export default function SetupView() {
  const {
    T, crd, inp, lbl, btn,
    wiz, setWiz, doSetup, setView, isSuper, PLANS,
    Logo, Tst, DarkBtn,
  } = useApp();

  // Echte Tarife (ohne "trial") für die Anbieter-Auswahl
  const planChoices = Object.entries(PLANS)
    .filter(([k]) => k !== "trial")
    .sort((a, b) => a[1].order - b[1].order);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, color: T.tx }}>
      {Tst}
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Logo size={44} />
        </div>
        <div style={crd}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>{isSuper ? "Neuen Kundenbetrieb anlegen" : "Betrieb einrichten"}</h2>
          <p style={{ margin: "0 0 18px", fontSize: 12, color: T.tx2 }}>{isSuper ? "Wird sofort aktiv freigeschaltet — Tarif unten wählbar, keine Testphase." : "14 Tage kostenlos testen — keine Kreditkarte nötig."}</p>

          <label style={lbl}>Name des Betriebs</label>
          <input style={inp} placeholder="Euro Rastpark" value={wiz.coName} onChange={e => setWiz(p => ({ ...p, coName: e.target.value }))} />

          <label style={lbl}>Typ / Untertitel</label>
          <input style={inp} placeholder="Tankstelle · 24/7" value={wiz.coSub} onChange={e => setWiz(p => ({ ...p, coSub: e.target.value }))} />

          <label style={lbl}>Wochenstunden Vollzeit</label>
          <input style={inp} type="number" min="20" max="48" value={wiz.weekStdHours} onChange={e => setWiz(p => ({ ...p, weekStdHours: Number(e.target.value) || 40 }))} />

          {isSuper && <>
            <label style={lbl}>Tarif</label>
            <select style={inp} value={wiz.plan || "free"} onChange={e => setWiz(p => ({ ...p, plan: e.target.value }))}>
              {planChoices.map(([k, p]) => <option key={k} value={k}>{p.l} — {p.price}</option>)}
            </select>
          </>}

          <div style={{ borderTop: `1px solid ${T.bord}`, margin: "16px 0 0", paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Inhaber-Account</div>
            <p style={{ fontSize: 11, color: T.tx2, margin: "0 0 10px" }}>Dein persönlicher Login für diesen Betrieb.</p>
          </div>
          <label style={lbl}>Name</label>
          <input style={inp} placeholder="Max Mustermann" value={wiz.name} onChange={e => setWiz(p => ({ ...p, name: e.target.value }))} />
          {!isSuper && <>
            <label style={lbl}>E-Mail-Adresse <span style={{ color: T.er, fontWeight: 400 }}>*</span></label>
            <input style={inp} type="email" placeholder="chef@meinbetrieb.de" value={wiz.email} onChange={e => setWiz(p => ({ ...p, email: e.target.value }))} autoComplete="email" />
            <p style={{ fontSize: 11, color: T.tx2, margin: "-6px 0 10px" }}>Du erhältst deine Betriebs-ID und Zugangsdaten per E-Mail.</p>
          </>}
          <label style={lbl}>Login-ID</label>
          <input style={inp} placeholder="max" value={wiz.lid} onChange={e => setWiz(p => ({ ...p, lid: e.target.value }))} />
          <label style={lbl}>PIN (mind. 4 Stellen)</label>
          <input style={{ ...inp, letterSpacing: 6, fontWeight: 700, textAlign: "center" }} type="password" placeholder="••••" value={wiz.pin} onChange={e => setWiz(p => ({ ...p, pin: e.target.value }))} />

          <button style={{ ...btn("p"), width: "100%", marginTop: 18 }} onClick={doSetup}>
            <Icon n={isSuper ? "plus" : "sparkle"} s={15} />{isSuper ? "Kundenbetrieb anlegen" : "14 Tage kostenlos starten"}
          </button>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center" }}>
          <button style={btn("s", true)} onClick={() => setView("login")}>Zurück zum Login</button>
          {DarkBtn}
        </div>
      </div>
    </div>
  );
}
