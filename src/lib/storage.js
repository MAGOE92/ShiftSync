// Speicher-Router: wählt zur Build-Zeit den Adapter anhand von VITE_STORAGE.
//   VITE_STORAGE=supabase → Cloud-Gateway (zentrale DB, geräteübergreifend)
//   sonst                 → lokal (localStorage / window.storage)
// Beide Adapter teilen exakt dieselbe Schnittstelle:
//   get/set/delete + login/setup/restore/switchOrg/linkOrg/unlinkOrg/chpin/logout + mode
//
// Der Gateway-Client nutzt nur fetch (kein @supabase/supabase-js im Bundle),
// daher kein Lazy-Load nötig — beide Adapter sind leichtgewichtig.
import localDb from "./storage.local.js";
import supaDb from "./storage.supabase.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
const useSupabase = env.VITE_STORAGE === "supabase";

const db = useSupabase ? supaDb : localDb;

export default db;
