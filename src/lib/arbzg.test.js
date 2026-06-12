import { describe, it, expect } from "vitest";
import { arbzgCheck } from "./arbzg.js";

const SHIFTS = [
  { key: "F", label: "Früh", start: "06:00", end: "14:00", required: 1, colorIdx: 0 },
  { key: "S", label: "Spät", start: "14:00", end: "22:00", required: 1, colorIdx: 1 },
  { key: "N", label: "Nacht", start: "22:00", end: "06:00", required: 1, colorIdx: 2 },
  { key: "L", label: "Lang", start: "08:00", end: "20:00", required: 1, colorIdx: 3 },
];

const emp = { id: "e1", name: "Anna" };

describe("arbzgCheck – §3 Schichtlänge", () => {
  it("keine Warnung bei ≤10 h", () => {
    const sc = { e1: Array(5).fill("F") };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    expect(issues.filter(i => i.msg.includes("§3"))).toHaveLength(0);
  });

  it("Fehler bei >10 h Schicht", () => {
    const sc = { e1: Array(3).fill("L") };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    const over10 = issues.filter(i => i.msg.includes("§3") && i.sev === "er");
    expect(over10.length).toBeGreaterThan(0);
  });
});

describe("arbzgCheck – §5 Ruhezeit", () => {
  it("Fehler bei Spät → Früh (nur 8 h Pause)", () => {
    const sc = { e1: ["S", "F", "-", "-", "-", "-", "-"] };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    const rest = issues.filter(i => i.msg.includes("§5") && i.sev === "er");
    expect(rest.length).toBeGreaterThan(0);
  });

  it("keine Warnung bei Früh → Spät (24 h Abstand)", () => {
    const sc = { e1: ["F", "S", "-", "-", "-", "-", "-"] };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    const rest = issues.filter(i => i.msg.includes("§5"));
    expect(rest).toHaveLength(0);
  });
});

describe("arbzgCheck – 7. Arbeitstag", () => {
  it("Warnung am 7. Tag in Folge", () => {
    const sc = { e1: Array(7).fill("F") };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    const streak = issues.filter(i => i.sev === "w" && i.msg.includes("7."));
    expect(streak.length).toBe(1);
    expect(streak[0].day).toBe(6);
  });

  it("keine Warnung bei 6 Tagen in Folge", () => {
    const sc = { e1: [...Array(6).fill("F"), "-"] };
    const issues = arbzgCheck(sc, [emp], SHIFTS);
    expect(issues.filter(i => i.sev === "w")).toHaveLength(0);
  });
});

describe("arbzgCheck – leerer Plan", () => {
  it("gibt leeres Array zurück", () => {
    const sc = { e1: Array(30).fill("-") };
    expect(arbzgCheck(sc, [emp], SHIFTS)).toHaveLength(0);
  });
});
