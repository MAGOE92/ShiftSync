import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "ShiftSync Pro",
        short_name: "ShiftSync",
        description: "Dienstplanung für 24/7-Kleinbetriebe — Schichtplaner, ArbZG-Wächter, Stempeluhr.",
        theme_color: "#4f46e5",
        background_color: "#f0f0ed",
        display: "standalone",
        start_url: "/",
        orientation: "any",
        lang: "de",
        dir: "ltr",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App-Shell + statische Assets cachen
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // API-Calls nie cachen
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/functions\//, /^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts cachen
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Im Dev-Server kein SW, vermeidet Cache-Probleme
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    exclude: ["tests/**", "node_modules/**"],
  },
});
