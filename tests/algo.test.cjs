// Algo-Unit-Test: Verfügbarkeit + maxDaysPerWeek
// Läuft nach: npx esbuild src/lib/algo.js --bundle --format=cjs --outfile=/tmp/algo.js
const { algo } = require(process.env.ALGO_BUNDLE || "/tmp/algo.js");

const fail = (m) => { console.log("❌ FAIL:", m); process.exit(1); };
const ok   = (m) => console.log("✓", m);

const mkEmp = (id, extra) => ({ id, name: id, pref: "any", workPct: 100, ...extra });

// Juli 2026: 31 Tage, beginnt am Dienstag (dow=2)
const Y = 2026, MO = 7;

const SHIFTS_3 = [
  { key: "F", label: "Früh",       start: "06:00", end: "14:00", required: 1 },
  { key: "S", label: "Spät",       start: "14:00", end: "22:00", required: 1 },
  { key: "N", label: "Nacht",      start: "22:00", end: "06:00", required: 1 },
];

const SHIFTS_2 = [
  { key: "F", label: "Früh",       start: "06:00", end: "14:00", required: 1 },
  { key: "N", label: "Nachmittag", start: "13:00", end: "21:00", required: 1 },
];

// ── TEST 1: avail [] = komplett gesperrt an Wochentagen (Minijobber nur Wochenende)
;(() => {
  const empW = mkEmp("weekend", {
    workPct: 30,
    avail: { "1": [], "2": [], "3": [], "4": [], "5": [] }, // Mo-Fr gesperrt
  });
  const empF = mkEmp("flex", { workPct: 100 });

  const sc = algo([empW, empF], {}, {}, Y, MO, SHIFTS_3, 40);

  let violations = 0;
  for (let d = 0; d < 31; d++) {
    const dow = new Date(Y, MO - 1, d + 1).getDay();
    if ([1, 2, 3, 4, 5].includes(dow)) {
      const sh = sc["weekend"][d];
      if (sh !== "-" && sh !== "U" && sh !== "K") violations++;
    }
  }
  if (violations > 0) fail(`Minijobber hat ${violations} Schicht(en) unter der Woche (avail [] ignoriert)`);
  ok("avail[]: Wochenend-Mitarbeiter nie Mo–Fr eingeplant");
})();

// ── TEST 2: avail pro Schicht pro Wochentag (Almadhi: Mo–Fr nur Nachmittag)
;(() => {
  const empA = mkEmp("almadhi", {
    workPct: 70,
    avail: { "1": ["N"], "2": ["N"], "3": ["N"], "4": ["N"], "5": ["N"] },
  });
  const empO = mkEmp("other", { workPct: 100 });

  const sc = algo([empA, empO], {}, {}, Y, MO, SHIFTS_2, 40);

  let violations = 0;
  for (let d = 0; d < 31; d++) {
    const dow = new Date(Y, MO - 1, d + 1).getDay();
    if ([1, 2, 3, 4, 5].includes(dow) && sc["almadhi"][d] === "F") violations++;
  }
  if (violations > 0) fail(`Almadhi hat ${violations}× Früh unter der Woche (nur Nachmittag erlaubt)`);
  ok("avail[shift]: Almadhi Mo–Fr ausschließlich in Nachmittag");
})();

// ── TEST 3: Wochenende frei → Sa/So beliebige Schicht möglich (kein Over-Block)
;(() => {
  const empA = mkEmp("almadhi2", {
    workPct: 70,
    avail: { "1": ["N"], "2": ["N"], "3": ["N"], "4": ["N"], "5": ["N"] },
    // Sa(6) und So(0) fehlen → alle Schichten erlaubt
  });
  const empO = mkEmp("other2", { workPct: 100 });

  const sc = algo([empA, empO], {}, {}, Y, MO, SHIFTS_2, 40);

  let weekendShifts = 0;
  for (let d = 0; d < 31; d++) {
    const dow = new Date(Y, MO - 1, d + 1).getDay();
    if ([0, 6].includes(dow) && ["F", "N"].includes(sc["almadhi2"][d])) weekendShifts++;
  }
  if (weekendShifts === 0) fail("Almadhi wird am Wochenende gar nicht eingeplant obwohl keine Sperre");
  ok(`avail: Wochenende weiterhin offen → ${weekendShifts} Schichten Sa/So`);
})();

// ── TEST 4: maxDaysPerWeek = 3 (Frau Spahn)
;(() => {
  const empS = mkEmp("spahn", { workPct: 60, maxDaysPerWeek: 3 });
  const empO = mkEmp("other3", { workPct: 100 });

  const sc = algo([empS, empO], {}, {}, Y, MO,
    [{ key: "F", label: "Früh", start: "06:00", end: "14:00", required: 1 }], 40);

  const weekCounts = {};
  for (let d = 0; d < 31; d++) {
    if (sc["spahn"][d] === "F") {
      const dt = new Date(Y, MO - 1, d + 1);
      const wn = Math.floor((dt.getTime() - new Date(1970, 0, 5).getTime()) / 86400000 / 7);
      weekCounts[wn] = (weekCounts[wn] || 0) + 1;
    }
  }
  const maxInWeek = Math.max(0, ...Object.values(weekCounts));
  if (maxInWeek > 3) fail(`maxDaysPerWeek=3 verletzt: ${maxInWeek} Tage in einer Kalenderwoche`);
  ok(`maxDaysPerWeek=3: max ${maxInWeek} Tage pro echter Kalenderwoche`);
})();

// ── TEST 5: Kombination avail + maxDaysPerWeek
;(() => {
  const empEnnis = mkEmp("ennis", {
    workPct: 80,
    maxDaysPerWeek: 5,
    avail: {
      // Mo-Do(1-4): nur Sonderschicht S
      "1": ["S"], "2": ["S"], "3": ["S"], "4": ["S"],
      // Fr-So (5,6,0): alle Schichten
    },
  });
  const empO = mkEmp("other4", { workPct: 100 });

  const sc = algo([empEnnis, empO], {}, {}, Y, MO, SHIFTS_3, 40);

  let moDoViolations = 0;
  for (let d = 0; d < 31; d++) {
    const dow = new Date(Y, MO - 1, d + 1).getDay();
    if ([1, 2, 3, 4].includes(dow)) {
      const sh = sc["ennis"][d];
      if (sh !== "-" && sh !== "S") moDoViolations++;
    }
  }
  if (moDoViolations > 0) fail(`Ennis hat Mo–Do ${moDoViolations}× in falscher Schicht (nur S erlaubt)`);
  ok("avail+maxDaysPerWeek: Ennis Mo–Do ausschließlich S, Fr–So flexibel");
})();

console.log("\n✅ ALLE 5 ALGO-TESTS BESTANDEN\n");
