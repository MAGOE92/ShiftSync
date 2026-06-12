// PWA Update-Banner: erscheint wenn der Service Worker ein Update bereitstellt.
import { useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Alle 60 Minuten auf Updates prüfen
      r && setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
      zIndex: 9998, display: "flex", alignItems: "center", gap: 12,
      background: "#1b1b19", color: "#f4f4f1", borderRadius: 14,
      padding: "12px 18px", boxShadow: "0 8px 32px rgba(0,0,0,.32)",
      fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      <span>Neue Version verfügbar</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: "#4f46e5", color: "#fff", border: "none",
          borderRadius: 8, padding: "6px 14px", cursor: "pointer",
          fontSize: 12, fontWeight: 700,
        }}
      >
        Jetzt aktualisieren
      </button>
    </div>
  );
}
