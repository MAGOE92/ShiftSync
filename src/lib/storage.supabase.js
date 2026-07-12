// Supabase-Gateway-Client.
// Spricht ausschließlich mit der Edge-Function "api" (service_role, RLS-gesperrt).
// Keine direkten Tabellenzugriffe → kein Datenleck über den öffentlichen Key.
// Identische Schnittstelle zum lokalen Adapter:
//   get/set/delete + login/setup/restore/switchOrg/linkOrg/unlinkOrg/chpin/logout

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
const FN_URL = `${env.VITE_SUPABASE_URL}/functions/v1/api`;
const ANON = env.VITE_SUPABASE_ANON_KEY || "";

const TOKEN_KEY = "ss_token";
let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch {}

const setToken = t => {
  token = t || null;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
};

// Ein Aufruf ans Gateway. Wirft Error(serverMessage) bei Fehler.
async function call(action, payload = {}) {
  const headers = { "Content-Type": "application/json" };
  if (ANON) headers["apikey"] = ANON;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(FN_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Keine Verbindung zum Server");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401) setToken(null); // abgelaufene Sitzung verwerfen
    throw new Error((data && data.error) || `Serverfehler (${res.status})`);
  }
  return data || {};
}

// dark / config bleiben Geräte-Einstellungen (localStorage), nie am Server
const localPref = {
  get: key => { try { return JSON.parse(localStorage.getItem(`ss_${key}`) ?? "null"); } catch { return null; } },
  set: (key, v) => { try { if (v === null) localStorage.removeItem(`ss_${key}`); else localStorage.setItem(`ss_${key}`, JSON.stringify(v)); } catch {} },
};

const db = {
  mode: "supabase",

  get: async key => {
    if (key === "dark" || key === "config") return localPref.get(key);
    const r = await call("get", { key });
    return r.value;
  },

  set: async (key, value) => {
    if (key === "dark" || key === "config") return localPref.set(key, value);
    await call("set", { key, value });
  },

  delete: async key => {
    if (key === "dark" || key === "config") return localPref.set(key, null);
    // org_X mit null = löschen (nur Super) — wird über set(null) abgebildet
    await call("set", { key, value: null });
  },

  // ── Auth/Workflows ──────────────────────────────────────────

  login: async (code, lid, pin) => {
    const r = await call("login", { code, lid, pin });
    if (r.token) setToken(r.token);
    return r;
  },

  setup: async payload => {
    const r = await call("setup", payload);
    if (r.token) setToken(r.token);
    return r;
  },

  // Session über Reload/PWA-Neustart wiederherstellen
  restore: async () => {
    if (!token) return null;
    try { return await call("me"); }
    catch { setToken(null); return null; }
  },

  switchOrg: async (targetId, lid) => {
    const r = await call("switch_org", { targetId, lid });
    if (r.token) setToken(r.token); // Super behält sein Token (kein token im Response)
    return r;
  },

  linkOrg: async (code, lid, pin) => call("link_org", { code, lid, pin }),
  unlinkOrg: async targetId => call("unlink_org", { targetId }),
  chpin: async (cur, nw) => call("chpin", { cur, nw }),

  // Push-Token des Geräts am Server registrieren/entfernen (nur native Apps)
  registerPush: async (pushToken, platform) => call("register_push", { pushToken, platform }),
  unregisterPush: async pushToken => call("unregister_push", { pushToken }).catch(() => {}),

  logout: () => setToken(null),

  // Realtime entfällt im Gateway-Modell (RLS gesperrt → kein anon-Subscribe).
  // Frische Daten kommen bei Login/Restore und nach jeder Aktion.
  subscribe: () => () => {},
};

export default db;
