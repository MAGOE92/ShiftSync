// Storage-Router: wählt je nach VITE_STORAGE den passenden Adapter.
// VITE_STORAGE=supabase → storage.supabase.js
// (default)             → storage.local.js  (window.storage / localStorage Shim)
//
// Kein top-level await → kompatibel mit esbuild IIFE (e2e-Tests).

import localDb from './storage.local.js';

// Zur Laufzeit ermitteln, ob Supabase gewünscht ist.
// Sicherer Guard: import.meta.env ist in Vite definiert, in esbuild IIFE leer.
const _isSupabase = (typeof import.meta !== 'undefined' && !!import.meta.env)
  && import.meta.env.VITE_STORAGE === 'supabase';

// Lazy-Holder für den Supabase-Adapter
let _supaDb = null;
const getSupaDb = async () => {
  if (!_supaDb) {
    const mod = await import('./storage.supabase.js');
    _supaDb = mod.default;
  }
  return _supaDb;
};

// Einheitlicher Adapter: im Local-Modus direkt synchron,
// im Supabase-Modus async mit Lazy-Load.
const db = {
  get: async k => {
    if (!_isSupabase) return localDb.get(k);
    return (await getSupaDb()).get(k);
  },
  set: async (k, v) => {
    if (!_isSupabase) return localDb.set(k, v);
    return (await getSupaDb()).set(k, v);
  },
  delete: async k => {
    if (!_isSupabase) return localDb.delete(k);
    return (await getSupaDb()).delete(k);
  },
  subscribe: (orgId, handlers) => {
    if (!_isSupabase) return () => {};
    // Asynchron subscriben — gibt sofort ein cleanup zurück
    let unsub = () => {};
    getSupaDb().then(d => { unsub = d.subscribe(orgId, handlers); });
    return () => unsub();
  },
};

export default db;
