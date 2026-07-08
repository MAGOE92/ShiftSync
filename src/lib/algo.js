import { dim, hoursOf } from "./utils.js";

// Erkennt Nachtschichten (Start >= 20 Uhr oder Ende <= 6 Uhr bei Mitternachtsübergang)
function isNightShift(def) {
  const sh = parseInt(def.start.split(":")[0]);
  const eh = parseInt(def.end.split(":")[0]);
  return sh >= 20 || (eh <= 6 && sh > eh);
}

// §5/§11 ArbZG: prüft ob ein Mitarbeiter an Tag d in Schicht sh eingesetzt werden kann.
export function canWork(sc, id, d, sh, shiftDefs) {
  const r = sc[id];
  if (!r || r[d] !== "-") return false;
  const def = shiftDefs.find(x => x.key === sh);
  if (!def) return false;
  if (d > 0) {
    const p = r[d - 1];
    if (p === "N" || p === "K") return false;
    const prevDef = shiftDefs.find(x => x.key === p);
    if (prevDef) {
      const [ph2] = prevDef.end.split(":");
      const [ch1] = def.start.split(":");
      if (parseInt(ph2) >= 20 && parseInt(ch1) <= 8) return false;
    }
  }
  let consec = 0;
  for (let i = d - 1; i >= 0 && r[i] !== "-" && r[i] !== "U"; i--) consec++;
  if (consec >= 6) return false;
  return true;
}

// ArbZG-konformer Auto-Planer. Pure function — kein Seiteneffekt, unit-testbar.
// opts.baseSc + opts.fromDay (1-basiert): Teilregenerierung — Tage vor fromDay
// bleiben fixiert (zählen für Stundenkonten mit), ab fromDay wird neu verteilt.
export function algo(emps, wm, absM, y, mo, shiftDefs, weekStdHours, opts = {}) {
  const days = dim(y, mo);
  const fromIdx = opts.fromDay ? Math.max(0, Math.min(days, opts.fromDay - 1)) : 0;
  const sc = {};
  if (opts.baseSc && fromIdx > 0) {
    // Fixierte Tage aus dem bestehenden Plan übernehmen, ab fromIdx leeren (U/K bleibt)
    emps.forEach(e => {
      const base = opts.baseSc[e.id] || Array(days).fill("-");
      sc[e.id] = base.map((s, i) => (i < fromIdx || s === "U" || s === "K") ? s : "-");
    });
  } else {
    emps.forEach(e => sc[e.id] = Array(days).fill("-"));
  }
  emps.forEach(e => { (absM[e.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) sc[e.id][day - 1] = type; }); });
  const ws = {}; emps.forEach(e => ws[e.id] = new Set((wm[e.id] || []).map(d => d - 1)));
  const monthlyTargetHours = {};
  emps.forEach(e => { const pct = e.workPct || 100; monthlyTargetHours[e.id] = (weekStdHours * pct / 100) * (days / 7); });
  const workedHours = {}; emps.forEach(e => workedHours[e.id] = 0);
  // Per-Schicht-Zähler für Ausgewogenheit (besonders "FS"-Präferenz)
  const shiftCounts = {}; emps.forEach(e => shiftCounts[e.id] = {});
  // Max. Arbeitstage pro Woche: Zähler je Mitarbeiter je Kalender-Woche (0-basiert im Monat)
  const weekDayCount = {}; emps.forEach(e => weekDayCount[e.id] = {});
  // Fixierte Tage in die Konten einrechnen, damit der Stunden-Deckel weiter gilt
  if (fromIdx > 0) {
    emps.forEach(e => {
      for (let i = 0; i < fromIdx; i++) {
        const k = sc[e.id][i];
        const def = shiftDefs.find(x => x.key === k);
        if (!def) continue;
        workedHours[e.id] += hoursOf(def.start, def.end);
        shiftCounts[e.id][k] = (shiftCounts[e.id][k] || 0) + 1;
        const dt = new Date(y, mo - 1, i + 1);
        const wn = Math.floor((dt.getTime() - new Date(1970, 0, 5).getTime()) / 86400000 / 7);
        weekDayCount[e.id][wn] = (weekDayCount[e.id][wn] || 0) + 1;
      }
    });
  }

  // Nicht-Nacht- und Nacht-Schichten trennen für rotierende Tagesreihenfolge
  const nonNightDefs = shiftDefs.filter(s => !isNightShift(s));
  const nightDefs = shiftDefs.filter(s => isNightShift(s));

  const prefScore = (e, sh) => {
    const cnt = shiftCounts[e.id][sh] || 0;
    // Exakte Schichtpräferenz: stark bevorzugt, leichte Dämpfung bei Häufung
    if (e.pref === sh) return -8 + cnt * 0.25;
    // Früh-oder-Spät: Ausgewogenheit zwischen F und S sicherstellen
    if (e.pref === "FS" && (sh === "F" || sh === "S")) {
      const otherKey = sh === "F" ? "S" : "F";
      const otherCnt = shiftCounts[e.id][otherKey] || 0;
      const imbalance = cnt - otherCnt; // positiv = schon zu viele dieser Art
      return -4 + imbalance * 0.9;
    }
    // Keine Nacht: Nachtschicht stark bestrafen
    if (e.pref === "noN" && sh === "N") return 12;
    // Flexibel: neutral
    if (e.pref === "any") return 0;
    // Nicht-bevorzugte Schicht: hohe Strafe — Mitarbeiter mit anderer Präferenz
    // nur im absoluten Notfall einsetzen, damit ihr Monatsbudget geschützt bleibt
    return 15;
  };

  for (let d = fromIdx; d < days; d++) {
    // Rotierende Schichtreihenfolge: Nicht-Nacht-Schichten täglich rotieren,
    // damit FS-Mitarbeiter nicht systematisch immer zuerst in Früh landen.
    // Nachtschichten immer zuletzt (ArbZG-Ruhezeit-Logik unverändert).
    const rotated = d % 2 === 0
      ? [...nonNightDefs]
      : [...nonNightDefs.slice(1), ...nonNightDefs.slice(0, 1)];
    const dayShifts = [...rotated, ...nightDefs];

    for (const def of dayShifts) {
      const sh = def.key, need = def.required;
      const shHours = hoursOf(def.start, def.end);
      let got = 0;
      for (let pass = 0; pass < 3 && got < need; pass++) {
        const capF = pass < 2 ? 1.02 : 1.10;
        const candidates = [...emps]
          .filter(e => {
            if (!canWork(sc, e.id, d, sh, shiftDefs)) return false;
            if (pass === 0 && ws[e.id].has(d)) return false;
            if (workedHours[e.id] + shHours > monthlyTargetHours[e.id] * capF + 0.01) return false;
            // Wochentag-Verfügbarkeit: avail[dow] = Array erlaubter Schicht-Keys, fehlt = alle erlaubt
            if (e.avail) {
              const dow = new Date(y, mo - 1, d + 1).getDay();
              const allowed = e.avail[String(dow)];
              if (allowed && !allowed.includes(sh)) return false;
            }
            // Max. Arbeitstage pro Woche — echte Kalenderwoche (Mo=Start)
            if (e.maxDaysPerWeek) {
              const dt = new Date(y, mo - 1, d + 1);
              // ISO-ähnliche Wochennummer: Tage seit einem bekannten Montag geteilt durch 7
              const daysSinceEpochMonday = Math.floor((dt.getTime() - new Date(1970, 0, 5).getTime()) / 86400000);
              const wn = Math.floor(daysSinceEpochMonday / 7);
              if ((weekDayCount[e.id][wn] || 0) >= e.maxDaysPerWeek) return false;
            }
            return true;
          })
          .map(e => {
            const target = monthlyTargetHours[e.id];
            const worked = workedHours[e.id];
            // Auslastungs-Faktor reduziert (3 statt 5), damit Präferenz stärker dominiert
            const utilization = target > 0 ? worked / target : 1;
            return { ...e, score: utilization * 3 + prefScore(e, sh) + (Math.random() - .5) * .35 };
          })
          .sort((a, b) => a.score - b.score);
        candidates.forEach(e => {
          if (got < need) {
            sc[e.id][d] = sh;
            workedHours[e.id] += shHours;
            shiftCounts[e.id][sh] = (shiftCounts[e.id][sh] || 0) + 1;
            const _dt = new Date(y, mo - 1, d + 1);
            const _wn = Math.floor((_dt.getTime() - new Date(1970, 0, 5).getTime()) / 86400000 / 7);
            weekDayCount[e.id][_wn] = (weekDayCount[e.id][_wn] || 0) + 1;
            got++;
          }
        });
      }
    }
  }
  return sc;
}
