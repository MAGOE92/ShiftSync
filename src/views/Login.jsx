import { useApp } from "../App.jsx";
import { Icon } from "../theme/icons.jsx";

export default function LoginView() {
  const {
    T, crd, inp, lbl, btn, ovl,
    lOrg, lId, lPin, setLOrg, setLId, setLPin,
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
          <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800 }}>Anmelden</h2>
          <label style={lbl}>Betriebs-ID</label>
          <input style={{ ...inp, fontFamily: "ui-monospace,monospace", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }} placeholder="AB12C" value={lOrg} onChange={e => setLOrg(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
          <label style={lbl}>Login-ID</label>
          <input style={inp} placeholder="z. B. max" value={lId} onChange={e => setLId(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
          <label style={lbl}>PIN</label>
          <input style={{ ...inp, letterSpacing: 6, fontWeight: 700, textAlign: "center" }} type="password" placeholder="••••" value={lPin} onChange={e => setLPin(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
          <button style={{ ...btn("p"), width: "100%", marginTop: 18 }} onClick={doLogin}>Anmelden</button>
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button style={{ ...btn("s"), width: "100%" }} onClick={() => setView("setup")}>Betrieb anlegen &amp; testen</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{DarkBtn}</div>
      </div>
    </div>
  );
}
