import { describe, it, expect, beforeEach, vi } from "vitest";

// Speicher-Shim wie im Prototyp/Standalone — jeder Test startet leer.
const mem = {};
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  vi.resetModules();
});
globalThis.window = {
  storage: {
    get: async k => (k in mem ? { value: mem[k] } : null),
    set: async (k, v) => { mem[k] = v; },
    delete: async k => { delete mem[k]; },
  },
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const load = async () => (await import("./storage.local.js")).default;

const mkOrg = async (db, over = {}) => db.setup({
  coName: "Testpark", name: "Chef Test", lid: "chef", pin: "1234",
  email: "chef@example.com", ...over,
});

describe("E-Mail-Login", () => {
  it("legt die Anmelde-E-Mail in die Inhaber-Karte (klein geschrieben)", async () => {
    const db = await load();
    await mkOrg(db, { email: "Chef@Example.COM" });
    const orgs = JSON.parse(mem["orgs"]);
    const data = JSON.parse(mem[`org_${orgs[0].id}`]);
    expect(data.emps[0].email).toBe("chef@example.com");
  });

  it("meldet mit E-Mail + PIN an — ohne Betriebs-ID, heilt Whitespace/Großschreibung", async () => {
    const db = await load();
    await mkOrg(db);
    const r = await db.loginEmail("  Chef@Example.com  ", " 1234 ");
    expect(r.emp.name).toBe("Chef Test");
    expect(r.org.name).toBe("Testpark");
    expect(r.chooseOrg).toBeUndefined();
  });

  it("falsche PIN und unbekannte E-Mail liefern DIESELBE neutrale Meldung", async () => {
    const db = await load();
    await mkOrg(db);
    await expect(db.loginEmail("chef@example.com", "0000")).rejects.toThrow("E-Mail oder PIN falsch");
    await expect(db.loginEmail("niemand@nirgends.de", "1234")).rejects.toThrow("E-Mail oder PIN falsch");
  });

  it("ohne E-Mail oder PIN wird nicht angemeldet", async () => {
    const db = await load();
    await mkOrg(db);
    await expect(db.loginEmail("", "1234")).rejects.toThrow();
    await expect(db.loginEmail("chef@example.com", "")).rejects.toThrow();
  });

  it("gleiche Person in zwei Betrieben ⇒ Betriebs-Auswahl statt Sitzung", async () => {
    const db = await load();
    // "Laura Bauer" mit derselben E-Mail in zwei Betrieben
    await mkOrg(db, { coName: "Tanke Nord", name: "Laura Bauer", lid: "laura", pin: "4321", email: "laura@mail.de" });
    await mkOrg(db, { coName: "Tanke Süd", name: "Laura Bauer", lid: "laura", pin: "4321", email: "laura@mail.de" });

    const r = await db.loginEmail("laura@mail.de", "4321");
    expect(r.token).toBeUndefined();
    expect(r.chooseOrg).toHaveLength(2);
    expect(r.chooseOrg.map(o => o.name).sort()).toEqual(["Tanke Nord", "Tanke Süd"]);

    // Nach der Wahl gibt es die Sitzung für genau diesen Betrieb
    const target = r.chooseOrg.find(o => o.name === "Tanke Süd");
    const r2 = await db.loginEmail("laura@mail.de", "4321", target.id);
    expect(r2.org.name).toBe("Tanke Süd");
    expect(r2.emp.name).toBe("Laura Bauer");
  });

  it("Betriebs-ID-Login funktioniert unverändert weiter (kein Regress)", async () => {
    const db = await load();
    await mkOrg(db);
    const orgs = JSON.parse(mem["orgs"]);
    const r = await db.login(orgs[0].code, "chef", "1234");
    expect(r.emp.name).toBe("Chef Test");
  });
});
