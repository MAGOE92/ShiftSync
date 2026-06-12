import { dim, hoursOf } from "./utils.js";

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
export function algo(emps, wm, absM, y, mo, shiftDefs, weekStdHours) {
  const days = dim(y, mo);
  const sc = {};
  emps.forEach(e => sc[e.id] = Array(days).fill("-"));
  emps.forEach(e => { (absM[e.id] || []).forEach(({ day, type }) => { if (day >= 1 && day <= days) sc[e.id][day - 1] = type; }); });
  const ws = {}; emps.forEach(e => ws[e.id] = new Set((wm[e.id] || []).map(d => d - 1)));
  const monthlyTargetHours = {};
  emps.forEach(e => { const pct = e.workPct || 100; monthlyTargetHours[e.id] = (weekStdHours * pct / 100) * (days / 7); });
  const workedHours = {}; emps.forEach(e => workedHours[e.id] = 0);

  const prefScore = (e, sh) => {
    if (e.pref === sh) return -2;
    if (e.pref === "FS" && (sh === "F" || sh === "S")) return -1.5;
    if (e.pref === "noN" && sh === "N") return 5;
    if (e.pref === "any") return 0;
    return 0.3;
  };

  for (let d = 0; d < days; d++) {
    for (const def of shiftDefs) {
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
            return true;
          })
          .map(e => {
            const target = monthlyTargetHours[e.id];
            const worked = workedHours[e.id];
            const utilization = target > 0 ? worked / target : 1;
            return { ...e, score: utilization * 5 + prefScore(e, sh) + (Math.random() - .5) * .6 };
          })
          .sort((a, b) => a.score - b.score);
        candidates.forEach(e => { if (got < need) { sc[e.id][d] = sh; workedHours[e.id] += shHours; got++; } });
      }
    }
  }
  return sc;
}
