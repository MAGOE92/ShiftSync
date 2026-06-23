const { JSDOM } = require("jsdom");
const fs = require("fs");

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, {
  url: "https://test.local/", pretendToBeVisual: true, runScripts: "outside-only",
});
const { window } = dom;
// Globals für React/Bundle
global.window = window; global.document = window.document;
global.navigator = window.navigator; global.HTMLElement = window.HTMLElement;
global.Event = window.Event; global.MouseEvent = window.MouseEvent;
global.confirm = () => true; window.confirm = () => true; window.alert = () => {};
global.localStorage = window.localStorage;
// Speicher-Shim (RAM) wie im Artefakt
const mem = {};
window.storage = {
  get: async k => (k in mem ? { value: mem[k] } : null),
  set: async (k, v) => { mem[k] = v; return { key: k, value: v }; },
  delete: async k => { delete mem[k]; return { key: k, deleted: true }; },
  list: async () => ({ keys: Object.keys(mem) }),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const setVal = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const byText = (txt, tag = "button") => [...document.querySelectorAll(tag)].find(b => b.textContent.trim() === txt || b.textContent.includes(txt));
const byPlaceholder = p => [...document.querySelectorAll("input,textarea")].find(i => (i.placeholder || "").includes(p));
const inputAfterLabel = lblTxt => {
  const labels = [...document.querySelectorAll("label")].filter(l => l.textContent.includes(lblTxt));
  for (const l of labels) {
    let n = l.nextElementSibling;
    if (n && (n.tagName === "INPUT" || n.tagName === "SELECT")) return n;
    if (l.parentElement) { const i = l.parentElement.querySelector("input,select"); if (i) return i; }
  }
  return null;
};
const fail = m => { console.log("❌ FAIL:", m); console.log("--- BODY ---\n", document.body.textContent.slice(0, 1200)); process.exit(1); };
const ok = m => console.log("✓", m);

(async () => {
  // App laden
  eval(fs.readFileSync(process.env.BUNDLE||"/tmp/bundle.js", "utf-8"));
  await sleep(300);

  // ── 1) Login-Seite sichtbar?
  if (!byText("Anmelden")) fail("Login-Seite nicht gerendert");
  ok("Login-Seite rendert");

  // ── 2) Betrieb anlegen (Trial)
  click(byText("Betrieb anlegen & testen")); await sleep(150);
  const coName = byPlaceholder("Euro Rastpark"); if (!coName) fail("Setup-Formular fehlt");
  setVal(coName, "Testpark Eichenzell");
  setVal(byPlaceholder("Max Mustermann"), "Max Inhaber");
  setVal(byPlaceholder("chef@"), "test@example.com"); // E-Mail-Pflichtfeld (Placeholder "chef@meinbetrieb.de")
  setVal(byPlaceholder("max"), "max");                // Login-ID (kein "chef@" im Placeholder → kein Konflikt)
  // Inhaber-PIN: das password-Feld im Setup
  const wizPin = [...document.querySelectorAll('input[type="password"]')][0];
  setVal(wizPin, "1234");
  click(byText("14 Tage kostenlos starten")); await sleep(300);
  if (!document.body.textContent.includes("Übersicht")) fail("Nach Setup nicht im Admin-Bereich");
  ok("Betrieb angelegt, als Inhaber eingeloggt");
  const orgsRaw = JSON.parse(mem["orgs"]); const code = orgsRaw[0].code;
  ok("Betriebs-ID: " + code);

  // ── 3) Mitarbeiter david.koch anlegen — PIN absichtlich mit Leerzeichen "5678 "
  click(byText("Team")); await sleep(150);
  const nameI = inputAfterLabel("Name"); const lidI = inputAfterLabel("Login-ID"); const pinI = inputAfterLabel("PIN (≥4)");
  if (!nameI || !lidI || !pinI) fail("Team-Formular nicht gefunden");
  setVal(nameI, "David Koch"); setVal(lidI, "David.Koch "); setVal(pinI, "5678 ");
  click(byText("Anlegen")); await sleep(250);
  const orgData = JSON.parse(mem["org_" + orgsRaw[0].id]);
  const david = orgData.emps.find(e => e.name === "David Koch");
  if (!david) fail("David wurde nicht gespeichert");
  if (david.pin !== "5678") fail(`PIN nicht getrimmt gespeichert: "${david.pin}"`);
  if (david.lid !== "david.koch") fail(`lid nicht normalisiert: "${david.lid}"`);
  ok(`David gespeichert · lid="${david.lid}" · pin="${david.pin}" (getrimmt)`);

  // ── 3b) Dienstplan anlegen → Admin-Ansicht darf NICHT abstürzen.
  //   Regression-Guard: arbzgCheck (u.a.) muss im App-Context an AdminView durchgereicht sein.
  //   Sobald ein Plan existiert, läuft der ArbZG-Wächter live — fehlt er im ctx, weißer Bildschirm.
  click(byText("Planer")); await sleep(150);
  const emptyBtn = byText("Leer & selbst erstellen") || byText("selbst erstellen");
  if (!emptyBtn) fail("Planer: Button 'Leer & selbst erstellen' nicht gefunden");
  click(emptyBtn); await sleep(300);
  const bodyTxt = document.body.textContent || "";
  if (bodyTxt.length < 200 || !/Stundenkonto|Compliance|Stunden/i.test(bodyTxt)) {
    fail("Admin-Ansicht nach Planerstellung abgestürzt (arbzgCheck/ctx?): body=" + bodyTxt.slice(0, 200));
  }
  if (!byText("Team")) fail("Nach Planerstellung ist die Admin-Navigation verschwunden (Crash)");
  ok("Dienstplan angelegt · Admin-Ansicht rendert (ArbZG-Wächter live, kein Crash)");

  // ── 4) Abmelden
  click(document.querySelector('button[title="Abmelden"]') || byText("Abmelden")); await sleep(200);
  if (!byText("Anmelden")) fail("Logout führte nicht zur Login-Seite");
  ok("Abgemeldet");

  // ── 5) Login als david.koch — Eingabe MIT Leerzeichen und Großschreibung
  setVal(byPlaceholder("AB12C"), " " + code.toLowerCase() + " ");
  setVal(byPlaceholder("z. B. max"), " David.Koch ");
  setVal(byPlaceholder("••••"), " 5678 ");
  click(byText("Anmelden")); await sleep(300);
  if (!document.body.textContent.includes("Stempeluhr")) fail("Login als david.koch fehlgeschlagen: " + document.body.textContent.slice(0, 300));
  ok("Login david.koch erfolgreich (trotz Leerzeichen/Großschreibung in allen Feldern)");

  // ── 6) Abmelden, falsche PIN → präzise Meldung
  click(document.querySelector('button[title="Abmelden"]')); await sleep(200);
  setVal(byPlaceholder("AB12C"), code);
  setVal(byPlaceholder("z. B. max"), "david.koch");
  setVal(byPlaceholder("••••"), "9999");
  click(byText("Anmelden")); await sleep(250);
  if (!document.body.textContent.includes("PIN falsch für David Koch")) fail("Falsch-PIN-Meldung fehlt");
  ok("Falsche PIN → präzise Meldung: 'PIN falsch für David Koch'");

  // ── 7) Unbekannte Login-ID → präzise Meldung
  setVal(byPlaceholder("z. B. max"), "david.k");
  setVal(byPlaceholder("••••"), "5678");
  click(byText("Anmelden")); await sleep(250);
  if (!document.body.textContent.includes("existiert in diesem Betrieb nicht")) fail("Unbekannte-ID-Meldung fehlt");
  ok("Unbekannte Login-ID → präzise Meldung");

  // ── 8) Alt-Datenfall: PIN mit Leerzeichen DIREKT im Speicher (vor dem Fix angelegt) → Login muss heilen
  const od = JSON.parse(mem["org_" + orgsRaw[0].id]);
  od.emps = od.emps.map(e => e.id === david.id ? { ...e, pin: "5678 " } : e);
  mem["org_" + orgsRaw[0].id] = JSON.stringify(od);
  setVal(byPlaceholder("z. B. max"), "david.koch");
  setVal(byPlaceholder("••••"), "5678");
  click(byText("Anmelden")); await sleep(300);
  if (!document.body.textContent.includes("Stempeluhr")) fail("Heilung alter Leerzeichen-PINs funktioniert nicht");
  ok("Alt-Daten mit Leerzeichen-PIN: Login heilt automatisch");

  console.log("\n✅ ALLE 9 TESTS BESTANDEN — Anlegen→Login→Planansicht verifiziert.");
  process.exit(0);
})().catch(e => { console.log("❌ EXCEPTION:", e.message); process.exit(1); });
