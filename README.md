# ShiftSync Pro

Deutschsprachige Multi-Tenant-SaaS für Dienstplanung in 24/7-Kleinbetrieben
(Tankstellen, Autohöfe, Kioske; 5–30 Mitarbeiter). Vite + React 18, optional
Supabase (Auth/DB/Realtime) und Stripe (Tarife), als PWA installierbar.

## Schnellstart (lokal, ohne Backend)

```bash
npm install
npm run dev          # http://localhost:5173 — läuft komplett über localStorage
```

Ohne `.env.local` nutzt die App den lokalen Speicher-Adapter (`VITE_STORAGE=local`).
Damit ist sie sofort voll funktionsfähig: Betrieb anlegen → Mitarbeiter → Planung.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit HMR |
| `npm run build` | Production-Build nach `dist/` (inkl. Service Worker) |
| `npm run preview` | Production-Build lokal servieren |
| `npm run test` | Unit-Tests (Vitest, `src/lib/*.test.js`) — 18 Tests |
| `npm run test:e2e` | E2E (esbuild + jsdom): Betrieb anlegen → Login — 8 Tests |
| `node scripts/gen-icons.cjs` | PWA-PNG-Icons aus dem Markenlogo neu erzeugen |

Nach jedem Refactor: `npm run test && npm run test:e2e` müssen grün bleiben.

## Architektur

- **`src/App.jsx`** — State-Container (`AppCtx`/`useApp()`), Persistenz, Geschäftslogik,
  reicht alles via Context an die Views.
- **`src/views/`** — `Login`, `Setup`, `SuperConsole`, `admin/AdminView`, `employee/EmpView`.
- **`src/lib/`** — reine Logik (`arbzg`, `algo`, `orgCode`, `utils`) + Speicher-Layer.
- **`src/lib/storage.js`** — Router: wählt zwischen `storage.local.js` (localStorage)
  und `storage.supabase.js` je nach `VITE_STORAGE`. Einzige Persistenz-Stelle.
- **`src/theme/`** — `constants.js` (Tarife, Rollen, Schichten …), `icons.jsx` (SVG-Set).

## Umgebungsvariablen

Siehe `.env.example`. Für lokalen Betrieb nichts nötig. Für Supabase/Stripe:

```
VITE_STORAGE=supabase
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_STRIPE_ENABLED=true
```

Edge-Function-Secrets (Server, nicht im Client): `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_IDS`, `JWT_SECRET` — siehe `.env.example`.

## Backend ausrollen (optional)

**Supabase** (`supabase/`):
```bash
supabase db push                                  # Migrationen (Schema, RLS, Realtime)
supabase functions deploy login                   # Custom-Auth (bcrypt-PIN → JWT)
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```
Schema/RLS/Realtime liegen in `supabase/migrations/`. Details: `docs/MIGRATION.md`.

**Stripe**: Webhook-Endpoint auf die `stripe-webhook`-Function zeigen lassen, die
Price-IDs in `STRIPE_PRICE_IDS` (JSON: `{"price_xxx":"starter", …}`) hinterlegen.

## Deployment (Vercel)

`vercel.json` ist vorbereitet (SPA-Rewrite, Immutable-Caching, Security-Header).
```bash
vercel --prod
```
Build-Command `npm run build`, Output `dist/`. Env-Variablen im Vercel-Projekt setzen.

## PWA

`vite-plugin-pwa` erzeugt `sw.js` + `manifest.webmanifest` beim Build. Icons in
`public/icons/` (per `scripts/gen-icons.cjs` generierbar). Update-Banner: `src/pwa.jsx`.

## Referenz & Fachregeln

`standalone/ShiftSyncPro.html` ist die lauffähige Referenz für erwartetes Verhalten.
Kernregeln (ArbZG-Wächter, 3-Pass-Auto-Generator, Login-Härtung, Tarif-Lifecycle)
sind in `CLAUDE.md` dokumentiert — nicht brechen.
