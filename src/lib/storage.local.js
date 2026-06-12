// localStorage / window.storage Adapter (Prototyp + Standalone)
const db = {
  get: async k => {
    try {
      const r = await window.storage.get(k);
      return r ? JSON.parse(r.value ?? r) : null;
    } catch {
      return null;
    }
  },
  set: async (k, v) => {
    try {
      if (v === null) {
        await window.storage.delete(k);
      } else {
        await window.storage.set(k, JSON.stringify(v));
      }
    } catch {}
  },
  delete: async k => {
    try { await window.storage.delete(k); } catch {}
  },
};

export default db;
