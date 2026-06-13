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
  und `storage.supabase.js` (Cloud-Gateway) je nach `VITE_STORAGE`. Beide Adapter
  bieten dieselbe Schnittstelle (`get/set/login/setup/restore/switchOrg/…`).
- **`src/theme/`** — `constants.js` (Tarife, Rollen, Schichten …), `icons.jsx` (SVG-Set).

## Cloud-Architektur (Gateway-Modell)

Im Supabase-Modus läuft **jeder** Datenzugriff über eine einzige Edge-Function
`supabase/functions/api` (`service_role`, umgeht RLS). Der öffentliche Client
spricht nie direkt mit den Tabellen — **RLS ist auf allen Tabellen komplett
gesperrt** (keine Policies). Das Gateway erzwingt selbst:
- **Auth:** Login per Betriebs-ID + Login-ID + PIN; PINs als PBKDF2-Hash (nie Klartext).
- **Sessions:** eigene HMAC-SHA256-Tokens (30 Tage), im `localStorage` als `ss_token`.
- **Mandantentrennung:** das Token ist auf einen Betrieb gescoped; Querzugriffe sind unmöglich.
- **Feld-Whitelist:** Betriebe können `plan`/`status` nicht selbst hochstufen.

So bleibt der „alles laden / alles speichern"-Datenfluss der App erhalten, ohne
die Datenbank dem öffentlichen Key auszusetzen. Realtime entfällt bewusst
(RLS gesperrt) — frische Daten kommen bei Login/Reload und nach jeder Aktion.

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

## Backend ausrollen

Voraussetzung: `SUPABASE_ACCESS_TOKEN` (Personal Access Token) gesetzt.

**1. Schema + RLS-Sperre einspielen** (Windows/PowerShell):
```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_…"
./scripts/apply-migrations.ps1            # legt Tabellen an + sperrt RLS
```
(`./scripts/db-reset.ps1` droppt + erstellt neu — nur für leere Erst-Einrichtung.)

**2. Gateway-Function deployen** und Secrets setzen:
```bash
npx supabase secrets set --project-ref <ref> SESSION_SECRET=<zufall> SUPER_ADMIN_PW=<pw>
npx supabase functions deploy api --project-ref <ref> --no-verify-jwt
```
`--no-verify-jwt`, weil das Gateway seine eigenen HMAC-Tokens prüft.

**3. Gateway testen:** `./scripts/test-gateway.ps1` (12 End-to-End-Checks).

**Stripe** (Phase 3, noch nicht aktiv): `create-checkout` + `stripe-webhook`
liegen unter `supabase/functions/`, sind aber noch nicht deployt. Erst
`VITE_STRIPE_ENABLED=true` + Price-IDs in `STRIPE_PRICE_IDS` aktivieren.

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
