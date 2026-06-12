// Compliance-Wächter: prüft einen Planentwurf gegen ArbZG-Kernregeln.
// Pure function — kein Seiteneffekt, unit-testbar.
export function arbzgCheck(sched, empList, shiftDefs) {
  const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s]));
  const tm = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const issues = [];
  empList.forEach(e => {
    const row = sched[e.id];
    if (!row) return;
    let consec = 0;
    for (let d = 0; d < row.length; d++) {
      const def = SD[row[d]];
      if (def) {
        consec++;
        let dur = tm(def.end) - tm(def.start);
        if (dur <= 0) dur += 1440;
        if (dur > 600)
          issues.push({ empId: e.id, name: e.name, day: d, sev: "er", msg: `Schicht ${row[d]} über 10 h (§3 ArbZG)` });
        const pk = d > 0 ? row[d - 1] : null, prev = pk ? SD[pk] : null;
        if (prev) {
          let endAbs = (d - 1) * 1440 + tm(prev.end);
          if (tm(prev.end) <= tm(prev.start)) endAbs = d * 1440 + tm(prev.end);
          const rest = d * 1440 + tm(def.start) - endAbs;
          if (rest >= 0 && rest < 660)
            issues.push({ empId: e.id, name: e.name, day: d, sev: "er", msg: `Ruhezeit nur ${Math.floor(rest / 60)} h nach ${pk}-Schicht (§5: mind. 11 h)` });
        }
        if (consec === 7)
          issues.push({ empId: e.id, name: e.name, day: d, sev: "w", msg: `7. Arbeitstag in Folge – Ausgleichstag einplanen` });
      } else {
        consec = 0;
      }
    }
  });
  return issues;
}
