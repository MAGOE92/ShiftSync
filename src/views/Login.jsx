import { useApp } from "../App.jsx";
import { Icon } from "../theme/icons.jsx";

export default function LoginView() {
  const {
    T, crd, inp, lbl, btn, ovl,
    lOrg, lId, lPin, setLOrg, setLId, setLPin,
    lMode, setLMode, lEmail, setLEmail, lChoose, setLChoose, doLoginEmail,
    doLogin, setView, orgs,
    Logo, Tst, DarkBtn,
    isMobile,
  } = useApp();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, color: T.tx }}>
      {Tst}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo size={48} />
          <p style={{ color: T.tx2, fontSize: 13, marginTop: 10, marginBottom: 0 }}>Dienstplanung für 24/7-Betriebe</p>
        </div>
        <div style={crd}>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800 }}>Anmelden</h2>

          {/* Betriebs-Auswahl: dieselbe Person hat in mehreren Betrieben eine Karte */}
          {lChoose ? <>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.tx2 }}>Du arbeitest in mehreren Betrieben. Wo möchtest du dich anmelden?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {lChoose.map(o => (
                <button key={o.id} onClick={() => doLoginEmail(o.id)} style={{ ...btn("s"), width: "100%", justifyContent: "flex-start", textAlign: "left", padding: "11px 13px" }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{o.name}</span>
                    <span style={{ fontSize: 11, color: T.tx2, fontFamily: "ui-monospace,monospace" }}>{o.code}</span>
                  </span>
                </button>
              ))}
            </div>
            <button style={{ ...btn("s"), width: "100%", marginTop: 12, justifyContent: "center" }} onClick={() => setLChoose(null)}>Zurück</button>
          </> : <>
            {/* Umschalter: E-Mail (ohne Betriebs-ID) oder klassisch Betriebs-ID */}
            <div style={{ display: "flex", background: T.bg2, borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {[["email", "E-Mail"], ["code", "Betriebs-ID"]].map(([k, l]) => (
                <button key={k} onClick={() => setLMode(k)} style={{ flex: 1, padding: "8px 6px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: lMode === k ? 700 : 500, background: lMode === k ? T.card : "transparent", color: lMode === k ? T.tx : T.tx2, fontFamily: "inherit" }}>{l}</button>
              ))}
            </div>

            {lMode === "email" ? <>
              <label style={lbl}>E-Mail</label>
              <input style={inp} type="email" placeholder="name@beispiel.de" value={lEmail} onChange={e => setLEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && doLoginEmail()} />
              <label style={lbl}>PIN</label>
              <input style={{ ...inp, letterSpacing: 6, fontWeight: 700, textAlign: "center" }} type="password" placeholder="••••" value={lPin} onChange={e => setLPin(e.target.value)} onKeyDown={e => e.key === "Enter" && doLoginEmail()} />
              <button style={{ ...btn("p"), width: "100%", marginTop: 18 }} onClick={() => doLoginEmail()}>Anmelden</button>
              <p style={{ margin: "12px 0 0", fontSize: 11, color: T.tx2, textAlign: "center" }}>Deine E-Mail hinterlegst du im Profil. Noch keine? Dann über Betriebs-ID anmelden.</p>
            </> : <>
              <label style={lbl}>Betriebs-ID</label>
              <input style={{ ...inp, fontFamily: "ui-monospace,monospace", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }} placeholder="AB12C" value={lOrg} onChange={e => setLOrg(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
              <label style={lbl}>Login-ID</label>
              <input style={inp} placeholder="z. B. max" value={lId} onChange={e => setLId(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
              <label style={lbl}>PIN</label>
              <input style={{ ...inp, letterSpacing: 6, fontWeight: 700, textAlign: "center" }} type="password" placeholder="••••" value={lPin} onChange={e => setLPin(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
              <button style={{ ...btn("p"), width: "100%", marginTop: 18 }} onClick={doLogin}>Anmelden</button>
            </>}
          </>}
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button style={{ ...btn("s"), width: "100%" }} onClick={() => setView("setup")}>Betrieb anlegen &amp; testen</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{DarkBtn}</div>
      </div>
    </div>
  );
}
