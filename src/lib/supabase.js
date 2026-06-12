import { createClient } from "@supabase/supabase-js";

// Sicherer Zugriff auf Vite-Env-Variablen (in esbuild IIFE sind sie undefined)
const _env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const url = _env.VITE_SUPABASE_URL;
const key = _env.VITE_SUPABASE_ANON_KEY;

// Client wird lazy erstellt — kein throw beim Import
let _client = null;

export function getSupabase() {
  if (!_client) {
    if (!url || !key) {
      throw new Error("VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein.");
    }
    _client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

// Convenience-Export für direkten Zugriff
export const supabase = new Proxy({}, {
  get(_t, prop) { return Reflect.get(getSupabase(), prop); },
});
