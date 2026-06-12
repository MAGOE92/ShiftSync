import { describe, it, expect } from "vitest";
import { algo } from "./algo.js";

const SHIFTS = [
  { key: "F", label: "Früh", start: "06:00", end: "14:00", required: 1, colorIdx: 0 },
  { key: "N", label: "Nacht", start: "22:00", end: "06:00", required: 1, colorIdx: 1 },
];

const makeEmps = n => Array.from({ length: n }, (_, i) => ({
  id: `e${i}`, name: `MA ${i}`, pref: "any", workPct: 100, inPlan: true,
}));

describe("algo – Basisausgabe", () => {
  it("gibt für jeden Mitarbeiter ein Array der Monatslänge zurück", () => {
    const emps = makeEmps(4);
    const sc = algo(emps, {}, {}, 2026, 0, SHIFTS, 40);
    emps.forEach(e => {
      expect(sc[e.id]).toHaveLength(31);
    });
  });

  it("besetzt Früh-Schicht täglich mit mind. 1 MA (30-Tage-Monat)", () => {
    const emps = makeEmps(6);
    const sc = algo(emps, {}, {}, 2026, 3, SHIFTS, 40);
    let misses = 0;
    for (let d = 0; d < 30; d++) {
      const cnt = emps.filter(e => sc[e.id][d] === "F").length;
      if (cnt < 1) misses++;
    }
    expect(misses).toBe(0);
  });
});

describe("algo – Stundenkappung", () => {
  it("kein Mitarbeiter überschreitet 110% Soll deutlich", () => {
    const emps = makeEmps(5);
    const sc = algo(emps, {}, {}, 2026, 0, SHIFTS, 40);
    const targetFull = 40 * (31 / 7);
    emps.forEach(e => {
      const worked = sc[e.id].filter(s => s === "F").length * 8
        + sc[e.id].filter(s => s === "N").length * 8;
      expect(worked).toBeLessThanOrEqual(targetFull * 1.12);
    });
  });
});

describe("algo – genehmigter Urlaub", () => {
  it("Urlaub-Tage bleiben unverändert", () => {
    const emps = makeEmps(4);
    const absM = { e0: [{ day: 5, type: "U" }, { day: 6, type: "U" }] };
    const sc = algo(emps, {}, absM, 2026, 0, SHIFTS, 40);
    expect(sc["e0"][4]).toBe("U");
    expect(sc["e0"][5]).toBe("U");
  });
});

describe("algo – Wunschfrei", () => {
  it("Pass 0 berücksichtigt Wunschfrei-Tage", () => {
    const emps = makeEmps(8);
    const wm = { e0: [1, 2, 3] };
    const sc = algo(emps, wm, {}, 2026, 0, SHIFTS, 40);
    expect(["F", "N"]).not.toContain(sc["e0"][0]);
  });
});
