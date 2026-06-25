export const SUPER_ADMIN_PW = "supersecret";

export const SH = {
  "-": { l: "Frei", bg: "#f1f5f9", bgD: "#1e293b", c: "#94a3b8", cD: "#64748b", x: "#94a3b8" },
  U:   { l: "Urlaub", bg: "#fef3c7", bgD: "#78350f", c: "#92400e", cD: "#fcd34d", x: "#f59e0b" },
  K:   { l: "Krank", bg: "#fee2e2", bgD: "#7f1d1d", c: "#dc2626", cD: "#fca5a5", x: "#ef4444" },
};

export const SHIFT_COLORS = [
  { bg: "#dcfce7", bgD: "#14532d", c: "#15803d", cD: "#86efac", x: "#22c55e" }, // Grün
  { bg: "#dbeafe", bgD: "#1e3a5f", c: "#2563eb", cD: "#93c5fd", x: "#3b82f6" }, // Blau
  { bg: "#ede9fe", bgD: "#3b2764", c: "#7c3aed", cD: "#c4b5fd", x: "#8b5cf6" }, // Violett
  { bg: "#fce7f3", bgD: "#831843", c: "#be185d", cD: "#f9a8d4", x: "#ec4899" }, // Pink
  { bg: "#cffafe", bgD: "#164e63", c: "#0e7490", cD: "#67e8f9", x: "#06b6d4" }, // Cyan
  { bg: "#ffedd5", bgD: "#7c2d12", c: "#c2410c", cD: "#fdba74", x: "#f97316" }, // Orange
  { bg: "#ccfbf1", bgD: "#134e4a", c: "#0f766e", cD: "#5eead4", x: "#14b8a6" }, // Türkis
  { bg: "#e0e7ff", bgD: "#312e81", c: "#4338ca", cD: "#a5b4fc", x: "#6366f1" }, // Indigo
  { bg: "#ecfccb", bgD: "#365314", c: "#4d7c0f", cD: "#bef264", x: "#84cc16" }, // Limette
  { bg: "#fae8ff", bgD: "#701a75", c: "#a21caf", cD: "#f0abfc", x: "#d946ef" }, // Magenta
  { bg: "#e0f2fe", bgD: "#075985", c: "#0369a1", cD: "#7dd3fc", x: "#0ea5e9" }, // Himmelblau
  { bg: "#f5f5f4", bgD: "#44403c", c: "#57534e", cD: "#d6d3d1", x: "#78716c" }, // Stein
];

export const ROLES = {
  owner:    { l: "Inhaber",           ic: "", col: "#4f46e5", rank: 4 },
  director: { l: "Geschäftsführer",   ic: "", col: "#0c7a4e", rank: 3 },
  manager:  { l: "Shopleiter",        ic: "", col: "#c4373a", rank: 2 },
  staff:    { l: "Mitarbeiter",       ic: "", col: "#74746d", rank: 1 },
};

export const ACCENTS = ["#4f46e5", "#0d9488", "#0284c7", "#ea580c", "#7c3aed", "#e11d48"];

export const PLANS = {
  free:    { l: "Free",     maxEmps: 5,        auto: false, exportF: false, whitelabel: false, price: "0 € (bis 5 MA)",  order: 0 },
  trial:   { l: "Test",     maxEmps: 15,       auto: true,  exportF: true,  whitelabel: false, price: "14 Tage gratis", order: 1 },
  starter: { l: "Starter",  maxEmps: 10,       auto: false, exportF: false, whitelabel: false, price: "19 €/Monat",     order: 2 },
  pro:     { l: "Pro",      maxEmps: 30,       auto: true,  exportF: true,  whitelabel: false, price: "49 €/Monat",     order: 3 },
  business:{ l: "Business", maxEmps: Infinity, auto: true,  exportF: true,  whitelabel: true,  price: "99 €/Monat",     order: 4 },
};

export const STATUS = {
  active:    { l: "Aktiv",     col: "#0c7a4e" },
  trial:     { l: "Testphase", col: "#0284c7" },
  archived:  { l: "Offline",   col: "#946315" },
  suspended: { l: "Gesperrt",  col: "#c4373a" },
};

export const PERMS = {
  createPlan:   "Dienstpläne erstellen/bearbeiten",
  approveVac:   "Urlaubsanträge entscheiden",
  approveSick:  "Krankmeldungen entscheiden",
  approveSwap:  "Schichttausch entscheiden",
  manageStaff:  "Mitarbeiter anlegen/bearbeiten",
  resetPins:    "PINs zurücksetzen",
  manageShifts: "Schichtmodelle ändern",
  manageOrg:    "Betriebseinstellungen ändern",
};

export const DEFAULT_PERMS = {
  owner:    Object.fromEntries(Object.keys(PERMS).map(k => [k, true])),
  director: { createPlan: true, approveVac: true, approveSick: true, approveSwap: true, manageStaff: true, resetPins: true, manageShifts: false, manageOrg: false },
  manager:  { createPlan: true, approveVac: false, approveSick: true, approveSwap: true, manageStaff: false, resetPins: false, manageShifts: false, manageOrg: false },
  staff:    Object.fromEntries(Object.keys(PERMS).map(k => [k, false])),
};

export const DEFAULT_SHIFTS = [
  { key: "F", label: "Früh",  start: "06:00", end: "14:00", required: 2, colorIdx: 0 },
  { key: "S", label: "Spät",  start: "14:00", end: "22:00", required: 2, colorIdx: 1 },
  { key: "N", label: "Nacht", start: "22:00", end: "06:00", required: 1, colorIdx: 2 },
];

export const MF = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
export const DW = ["So","Mo","Di","Mi","Do","Fr","Sa"];
export const PR = [{ v: "any", l: "Flexibel" }, { v: "FS", l: "Früh oder Spät" }, { v: "noN", l: "Keine Nacht" }];
