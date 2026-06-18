# Feature-Konzept: Zeiterfassung-Modi & Kiosk-Stempeln

> **Status:** geplant, noch nicht implementiert.
> **Zweck dieses Dokuments:** vollständige Arbeitsgrundlage. Ein Chat/Agent ohne
> Vorgeschichte kann damit direkt loslegen. Enthält Problem, Entscheidung, Design,
> offene Punkte, betroffene Dateien und Akzeptanzkriterien.
> **Letzter Stand:** 2026-06 (nach QA-Durchlauf, Cloud-Backend live).

---

## 1. Problem

Mitarbeiter bekommen die App auf ihr **privates Handy**. Die aktuelle Stempeluhr
(EmpView, Tab „Start") erlaubt **Ein-/Ausstempeln jederzeit und von überall** —
also auch vom Sofa, bevor man im Betrieb ist. Für eine verlässliche
Arbeitszeiterfassung (vgl. BAG-Urteil 2022: „objektiv und manipulationssicher")
ist das zu schwach. Es braucht eine **Anwesenheits-Sicherung** und die Möglichkeit,
die Stempeluhr je Kunde **komplett abzuschalten** (viele Kleinbetriebe wollen sie gar nicht).

## 2. Entscheidung (bereits getroffen)

- **Drei-stufige Einstellung pro Betrieb** statt nur an/aus.
- **Standard für neue Betriebe: `off`** (Stempeluhr unsichtbar, bis bewusst aktiviert).
- Steuerbar durch **Inhaber** (Recht `manageOrg`) **und** durch den **Anbieter/Betreuer**
  (Super-Admin via Support-Login → dieselben Betriebs-Einstellungen).
- Empfohlener Hauptmodus für Tankstelle/Rastpark/Kiosk: **`kiosk`** (gemeinsames
  Gerät an der Theke), weil Anwesenheit garantiert ist, kein GPS, datenschutzfreundlich.

### Die drei Modi (`org.timeclock`)
| Wert | Verhalten |
|------|-----------|
| `off` | Keine Stempeluhr. In EmpView komplett ausgeblendet (Start-Tab zeigt nur „Nächste Schichten"). Kein Stundenkonto-Ist. |
| `self` | Aktuelles Verhalten: Vertrauens-Stempeln auf dem eigenen Handy. |
| `kiosk` | Auf dem Mitarbeiter-Handy **keine** Stempel-Buttons. Stempeln nur über den **Kiosk-Terminal-Modus** auf einem gemeinsamen Gerät im Betrieb. |

## 3. Kiosk-Modus — Ablauf (UX)

1. Login-Bildschirm bekommt unten einen Button **„Stempel-Terminal"** (nur sinnvoll,
   wenn man weiß, dass der Betrieb `kiosk` nutzt — Button ist immer sichtbar, fragt
   dann Betriebs-ID + Inhaber/Manager-PIN ab, um das Terminal zu starten).
2. Nach Freischaltung zeigt das Tablet eine **Kachel-Liste aller Mitarbeiter**
   (Initialen-Avatar + Name), bleibt dauerhaft in diesem Modus (Vollbild/„Kiosk").
3. Mitarbeiter tippt seine Kachel → **PIN-Eingabe** → großer Button
   **„Einstempeln"** bzw. **„Ausstempeln"** (je nach aktuellem Status) → kurze
   Bestätigung („Hallo David, eingestempelt 14:02") → zurück zur Liste.
4. Verlassen des Terminal-Modus nur mit **Inhaber-/Manager-PIN** (verhindert, dass
   jemand über das Terminal in die normale App gelangt).
5. Auf dem **eigenen Handy** der Mitarbeiter ist der Stempel-Bereich ausgeblendet;
   sie sehen dort weiterhin Plan, Schichtbörse, Anträge, Profil.

## 4. Offene Entscheidungen (mit Empfehlung)

1. **PIN am Kiosk?** → **Ja, mit PIN** (sonst kann jeder für jeden stempeln).
2. **Korrektur durch Manager:** Vergessenes Ausstempeln muss nachträglich
   editierbar sein. **Aktuell fehlt jede Korrektur-UI für Zeiten.** Empfehlung:
   im Admin eine kleine „Zeiten"-Ansicht (pro Tag/Mitarbeiter in/out bearbeiten).
   → Umfangstreiber, separat entscheidbar.
3. **Geteilte Schichten / mehrmals pro Tag:** Datenmodell speichert derzeit
   **nur EIN in/out-Paar pro Tag** (DB-Constraint `unique(org_id, emp_id, day)`).
   Für „morgens + abends" am selben Tag braucht es mehrere Paare → **Schema-Änderung**.
   → Nur umsetzen, wenn der Kunde geteilte Dienste hat.

## 5. Architektur-Kontext (für einen kalten Agenten zwingend lesen)

- **Stack:** Vite + React 18, eine zentrale Datei `src/App.jsx` hält den gesamten
  State + alle Action-Funktionen und reicht sie via React-Context (`useApp()`) an die
  Views (`src/views/...`). Konstanten in `src/theme/constants.js`, Icons `src/theme/icons.jsx`.
- **Speicher:** Router `src/lib/storage.js` wählt per `VITE_STORAGE` zwischen
  `storage.local.js` (localStorage, Dev/E2E) und `storage.supabase.js` (Cloud).
  **Live läuft Cloud.** Beide Adapter haben dieselbe Schnittstelle:
  `get/set/delete/login/setup/restore/switchOrg/linkOrg/unlinkOrg/chpin/logout` + `mode`.
- **Cloud = Gateway-Modell:** ALLER DB-Zugriff läuft über die Edge-Function
  `supabase/functions/api/index.ts` (läuft mit service_role, **RLS auf allen Tabellen
  komplett gesperrt, keine Policies**). Auth: eigene HMAC-Session-Tokens, PINs als
  PBKDF2-Hash. **Mitarbeiter werden ohne `pin` ausgeliefert** (nie Klartext).
- **Betriebs-Einstellungen** liegen in der `orgs`-Zeile. Schreiben über
  `saveOrgs(...)` → `db.set("orgs", liste)`. Im Gateway prüft `actSet` für normale
  Nutzer eine **Whitelist** `ORG_SELF_FIELDS` (aktuell: name, sub, weekStdHours,
  shifts, holidays, perms, accent — NICHT plan/status). Super darf alles.
- **Clock-Datenmodell:** `data.clock = { 'YYYY-MM-DD': { empId: { in: ms, out: ms } } }`.
  In der Cloud Tabelle `clock_entries` mit `unique(org_id, emp_id, day)` →
  **ein Paar pro Tag**. `todayKey` nutzt **lokales** Datum (`isoDate(new Date())`,
  nicht UTC — wichtig für Nachtschichten, bereits gefixt). `doClock` in App.jsx,
  Auswertung `istHoursMonth`. Beim Cloud-Save werden clock-Zeilen nur **upserted**
  (kein Reconcile-Delete).
- **EmpView** (`src/views/employee/EmpView.jsx`): Tab „Start" rendert die
  Stempeluhr-Karte (Buttons „Einstempeln"/„Ausstempeln", `myStamp`, `doClock`).
- **E2E-Regressionsschutz:** `tests/e2e.test.cjs` (jsdom, local mode) testet
  Anlegen→Login→Planansicht. Bei UI-Änderungen grün halten:
  `npm run test && npm run test:e2e`.

## 6. Umsetzungsplan (Dateien & Schritte)

### A. Einstellung `timeclock` einführen (klein)
1. **DB-Migration** (neue Datei `supabase/migrations/…_timeclock.sql`):
   `alter table public.orgs add column timeclock text not null default 'off'
   check (timeclock in ('off','self','kiosk'));` Danach `scripts/apply-migrations.ps1`
   bzw. einzeln über die Management-API ausführen (Token nötig).
2. **Gateway** `supabase/functions/api/index.ts`:
   - `mapOrg`: `timeclock: row.timeclock || 'off'`.
   - `actSetup` orgRow: `timeclock: 'off'` (Default; Super könnte es mitgeben).
   - Super-`actSet` orgs-Upsert: `timeclock` mit aufnehmen.
   - `ORG_SELF_FIELDS`: `timeclock: 'timeclock'` ergänzen (Inhaber darf es setzen).
   - Danach `npx supabase functions deploy api --project-ref <ref> --no-verify-jwt`.
3. **Local-Adapter** `src/lib/storage.local.js`: `setup` legt `timeclock: 'off'` an.
4. **Konstante** (optional) in `constants.js`: `TIMECLOCK_MODES`.
5. **AdminView Einstellungen** (`src/views/admin/AdminView.jsx`, Tab settings):
   Auswahl (Aus / Eigenes Handy / Kiosk), nur sichtbar mit `can('manageOrg')`,
   speichert via vorhandener `saveOrgEdits`/`saveOrgs`-Logik (Feld `timeclock`).
6. **EmpView** Start-Tab: Stempeluhr nur rendern, wenn `org.timeclock === 'self'`.
   Bei `off`/`kiosk` ausblenden.
7. **App.jsx**: `org.timeclock` über ctx verfügbar machen (org ist schon im ctx).

### B. Kiosk-Terminal (größer)
8. Neuer **View** `view === 'kiosk'` (eigene Komponente `src/views/Kiosk.jsx`):
   Mitarbeiterliste → PIN → in/out.
9. **Login.jsx**: Button „Stempel-Terminal" → fragt Betriebs-ID + Inhaber/Manager-PIN,
   ruft eine neue Gateway-Aktion zum Starten auf, wechselt in `kiosk`-View.
10. **Gateway-Aktionen (Cloud)** — *Kern-Designfrage*:
    - `kiosk_start { code, lid, pin }` → prüft Inhaber/Manager-PIN, gibt einen
      **eingeschränkten Kiosk-Token** + Mitarbeiterliste (ohne PINs) zurück.
    - `kiosk_clock { empId, pin, action:'in'|'out' }` → verifiziert die PIN des
      **gewählten Mitarbeiters** serverseitig, schreibt clock_entry. Nur mit Kiosk-Token,
      auf den Betrieb des Tokens beschränkt.
    - So muss der Mitarbeiter-PIN nie im Client geprüft werden (Gateway hat die Hashes).
11. **Local-Adapter**: analoge `kiosk_start`/`kiosk_clock`-Methoden für Dev/E2E.

### C. Optional: Manager-Korrektur (B-Frage 2) und Mehrfach-Stempeln (B-Frage 3)
- Korrektur-UI im Admin + Edit-Pfad über bestehendes `saveData`/clock.
- Mehrfach pro Tag: Datenmodell auf Array von Paaren umstellen
  (`clock[day][empId] = [{in,out}, …]`), DB-Constraint lösen/erweitern,
  `istHoursMonth` + Anzeige anpassen. **Breaking** — bewusst separat.

## 7. Akzeptanzkriterien

- Neuer Betrieb: Stempeluhr ist **unsichtbar** (`timeclock='off'`).
- Inhaber kann in Einstellungen auf „Eigenes Handy" / „Kiosk" umstellen; Super-Admin
  ebenso via Support-Login. Wechsel wirkt sofort beim Mitarbeiter.
- Modus `self`: wie heute, Stempeln auf dem Handy.
- Modus `kiosk`: Handy zeigt keine Stempel-Buttons; am Terminal stempeln Mitarbeiter
  per PIN ein/aus; Zeiten landen korrekt im Stundenkonto/Lohn-Export.
- `npm run build`, `npm run test` (18), `npm run test:e2e` (9), Gateway-Tests grün.
- Keine Klartext-PIN verlässt je den Server.

## 8. Befehle / Infra (Kurzreferenz)
- Node liegt auf `D:\` (in PowerShell PATH voranstellen).
- Supabase-Projekt-Ref: `esnqnedjqtslkncttzrr`. Gateway-Function: `api`.
- Deploy Frontend: `vercel deploy --prod --yes --scope max-goettler-s-projects --token <TOKEN>`.
- Live-URL: https://shiftsync-pro-zeta.vercel.app
- Test-Skripte: `scripts/test-gateway.ps1`, `scripts/test-super.ps1`, `scripts/apply-migrations.ps1`.
