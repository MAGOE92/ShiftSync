import { dim, hoursOf } from "./utils.js";

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

function prefTier(pref, sh) {
  if (!pref || pref === "any") return 2;
  if (pref === "F" || pref === "S" || pref === "N") return pref === sh ? 1 : 3;
  if (pref === "FS") return sh === "N" ? 3 : 1;
  if (pref === "noN") return sh === "N" ? 3 : 2;
  return 2;
}

function cmpKey(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function algo(emps, wm, absM, y, mo, shiftDefs, weekStdHours) {
  const days = dim(y, mo);
  const sc = {};
  emps.forEach(e => { sc[e.id] = Array(days).fill("-"); });
  emps.forEach(e => {
    (absM[e.id] || []).forEach(({ day, type }) => {
      if (day >= 1 && day <= days) sc[e.id][day - 1] = type;
    });
  });
  const ws = {};
  emps.forEach(e => { ws[e.id] = new Set((wm[e.id] || []).map(d => d - 1)); });
  const targetHours = {};
  emps.forEach(e => {
    const pct = e.workPct || 100;
    targetHours[e.id] = (weekStdHours * pct / 100) * (days / 7);
  });
  const shHours = {};
  shiftDefs.forEach(def => { shHours[def.key] = hoursOf(def.start, def.end); });
  const sumTargets = emps.reduce((s, e) => s + targetHours[e.id], 0) || 1;

  const budget = {};
  emps.forEach(e => { budget[e.id] = {}; shiftDefs.forEach(d => { budget[e.id][d.key] = 0; }); });
  const tierWeight = t => (t === 1 ? 4 : t === 2 ? 1 : 0.05);
  shiftDefs.forEach(def => {
    const sh = def.key;
    const demand = def.required * days;
    const weights = emps.map(e => {
      const share = targetHours[e.id] / sumTargets;
      return { id: e.id, w: share * tierWeight(prefTier(e.pref, sh)) };
    });
    const totW = weights.reduce((s, x) => s + x.w, 0) || 1;
    weights.forEach(x => { budget[x.id][sh] = (x.w / totW) * demand; });
  });
  emps.forEach(e => {
    if (e.pref === "FS" && "F" in budget[e.id] && "S" in budget[e.id]) {
      const combined = budget[e.id]["F"] + budget[e.id]["S"];
      budget[e.id]["F"] = combined / 2;
      budget[e.id]["S"] = combined / 2;
    }
  });

  const workedHours = {};
  const assigned = {};
  emps.forEach(e => {
    workedHours[e.id] = 0;
    assigned[e.id] = {};
    shiftDefs.forEach(d => { assigned[e.id][d.key] = 0; });
  });
  const order = [...emps].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const pick = (d, def, maxTier, respectWish, capF, capBudget) => {
    const sh = def.key, h = shHours[sh];
    let best = null, bestKey = null;
    for (const e of order) {
      if (!canWork(sc, e.id, d, sh, shiftDefs)) continue;
      const tier = prefTier(e.pref, sh);
      if (tier > maxTier) continue;
      if (respectWish && ws[e.id].has(d)) continue;
      if (workedHours[e.id] + h > targetHours[e.id] * capF + 0.01) continue;
      const deficit = budget[e.id][sh] - assigned[e.id][sh];
      if (capBudget && deficit <= 0) continue;
      const tgt = targetHours[e.id];
      const util = tgt > 0 ? workedHours[e.id] / tgt : 1;
      let balance = 0;
      if (e.pref === "FS" && (sh === "F" || sh === "S")) {
        const other = sh === "F" ? "S" : "F";
        balance = assigned[e.id][other] - assigned[e.id][sh];
      }
      const key = [tier, -balance, -deficit, util, e.id];
      if (bestKey === null || cmpKey(key, bestKey) < 0) { bestKey = key; best = e; }
    }
    return best;
  };
  const assign = (e, d, def) => {
    sc[e.id][d] = def.key;
    workedHours[e.id] += shHours[def.key];
    assigned[e.id][def.key] += 1;
  };
  const passes = [
    { maxTier: 1, respectWish: true,  capF: 1.0,  capBudget: true  },
    { maxTier: 2, respectWish: true,  capF: 1.0,  capBudget: true  },
    { maxTier: 2, respectWish: true,  capF: 1.0,  capBudget: false },
    { maxTier: 2, respectWish: false, capF: 1.0,  capBudget: false },
    { maxTier: 3, respectWish: false, capF: 1.0,  capBudget: false },
    { maxTier: 3, respectWish: false, capF: 1.10, capBudget: false },
  ];
  for (let d = 0; d < days; d++) {
    const need = {};
    shiftDefs.forEach(def => { need[def.key] = def.required; });
    for (const pass of passes) {
      let progress = true;
      while (progress) {
        progress = false;
        for (const def of shiftDefs) {
          if (need[def.key] <= 0) continue;
          const e = pick(d, def, pass.maxTier, pass.respectWish, pass.capF, pass.capBudget);
          if (e) { assign(e, d, def); need[def.key]--; progress = true; }
        }
      }
    }
  }
  return sc;
}
