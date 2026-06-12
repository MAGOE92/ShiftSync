import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

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
