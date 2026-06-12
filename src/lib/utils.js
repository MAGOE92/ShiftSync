export const rid = () => Math.random().toString(36).slice(2, 9);
export const dim = (y, m) => new Date(y, m + 1, 0).getDate();
export const tms = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const nms = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return tms(d); };
export const pm = s => { const [y, m] = s.split("-").map(Number), m0 = m - 1; return { y, m0, days: dim(y, m0), lbl: `${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][m0]} ${y}` }; };
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoursOf = (s, e) => { const [h1, m1] = s.split(":").map(Number), [h2, m2] = e.split(":").map(Number); let d = (h2 * 60 + m2) - (h1 * 60 + m1); if (d <= 0) d += 24 * 60; return d / 60; };
export const relTime = t => { const s = (Date.now() - t) / 1000; if (s < 60) return "gerade eben"; if (s < 3600) return `vor ${Math.floor(s / 60)} Min`; if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`; if (s < 604800) return `vor ${Math.floor(s / 86400)} Tg`; return new Date(t).toLocaleDateString("de-DE"); };
export const datesBetween = (from, to) => { const a = [], s = new Date(from), e = new Date(to); for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) a.push(isoDate(d)); return a; };

export function doICS(sc, nm, y, m0, shiftDefs) {
  const SD = Object.fromEntries(shiftDefs.map(s => [s.key, s]));
  let str = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\n";
  sc.forEach((sh, i) => {
    const def = SD[sh]; if (!def) return;
    const [h1, m1] = def.start.split(":"), [h2, m2] = def.end.split(":");
    const dd = String(i + 1).padStart(2, "0"), mm = String(m0 + 1).padStart(2, "0"), ds = `${y}${mm}${dd}`;
    let de = ds;
    if (parseInt(h2) < parseInt(h1)) { const n = new Date(y, m0, i + 2); de = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}`; }
    str += `BEGIN:VEVENT\r\nUID:${rid()}\r\nDTSTART:${ds}T${h1}${m1}00\r\nDTEND:${de}T${h2}${m2}00\r\nSUMMARY:${def.label}schicht\r\nEND:VEVENT\r\n`;
  });
  str += "END:VCALENDAR";
  const a = document.createElement("a"); a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(str)}`; a.download = `Dienstplan_${y}_${m0 + 1}.ics`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
