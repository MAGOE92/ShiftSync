import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Auto-Reload bei neuem Service Worker: sobald eine neue App-Version übernimmt,
// lädt die Seite sich EINMAL automatisch neu → Nutzer ist immer auf der frischen
// Version, ohne manuelles Cache-Leeren. Nur bei echtem Update (nicht Erst-Install).
if (import.meta.env?.PROD && "serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

// PWA Update-Banner: nur in Vite-Builds verfügbar (virtual:pwa-register/react)
const PwaUpdateBanner = import.meta.env?.PROD
  ? lazy(() => import("./pwa.jsx").then(m => ({ default: m.PwaUpdateBanner })).catch(() => ({ default: () => null })))
  : () => null;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Suspense fallback={null}><PwaUpdateBanner /></Suspense>
  </StrictMode>
);
