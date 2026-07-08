# ShiftSync Pro — Projektkontext

Deutschsprachige Multi-Tenant-SaaS für Dienstplanung in 24/7-Kleinbetrieben
(Tankstellen, Autohöfe, Kioske; 5–30 Mitarbeiter). Pilotkunde: Euro Rastpark
Eichenzell. Zielgruppe der UI: Inhaber/Shopleiter ohne IT-Affinität.

## Aktueller Stand

- **Gesamte App in einer Datei:** `src/App.jsx` (~2700 Zeilen React, default export `App`).
  Funktionierender Prototyp, im Produktivtest beim Pilotkunden.
- **Lauffähige Standalone-Version:** `standalone/ShiftSyncPro.html`
  (React/Babel via CDN, Speicher-Shim). Referenz für das erwartete Verhalten.
- **E2E-Test:** `tests/e2e.test.cjs` (jsdom; Betrieb anlegen → Mitarbeiter anlegen →
  Login inkl. Whitespace-/Case-Härtung). MUSS nach jedem Refactor grün bleiben.

## Persistenz (wichtigste Eigenheit)

Alles läuft über `window.storage` (async get/set/delete/list, Werte = JSON-Strings):
- Key `orgs`: Array aller Betriebe `{id, code, name, sub, weekStdHours, shifts,
  holidays, perms, status, plan, trialEnds, accent, createdAt}`
- Key `org_{id}`: `{emps, wishes, scheds, reqs, notifs, clock, market}`
  - `emps[]`: `{id, name, lid (lowercase), pin (getrimmt, Klartext!), role:
    owner|director|manager|staff, workPct, pref, inPlan, linkedOrgs[]}`
  - `scheds`: `{ "YYYY-MM": { empId: ["F"|"S"|"N"|"U"|"K"|"-"] pro Tag } }`
  - `reqs[]`: Urlaub/Krank/Tausch mit Genehmigungs-Workflow
  - `notifs[]`, `clock` (Stempeluhr `{date:{empId:{in,out}}}`), `market[]` (Schichtbörse)

Im Standalone-HTML gibt es einen Shim auf localStorage. **Migrationsziel: Supabase**
(siehe docs/MIGRATION.md) — `window.storage` ist die einzige Stelle, an der
Persistenz stattfindet; bewusst so gekapselt.

## Fachliche Kernregeln (nicht brechen)

- **ArbZG-Compliance-Wächter** (`arbzgCheck`): Ruhezeit ≥ 11 h (§5), Schicht ≤ 10 h
  (§3), Warnung ab 7. Arbeitstag in Folge. Läuft live im Planer, blockt
  Schichtbörsen-Übernahmen, warnt vor Veröffentlichung.
- **Auto-Generator** (`algo`): harter Stunden-Deckel — Pass 0 (Wunschfrei + Soll),
  Pass 1 (ohne Wunschfrei + Soll), Pass 2 (Not, max. 110 % Soll). Lieber Lücke
  offen lassen als Mehrarbeit erzeugen. Genehmigter Urlaub (absMap) wird vorbelegt.
- **Login:** Betriebs-ID + Login-ID + PIN. Alle Eingaben trimmen, lid lowercase,
  PIN-Vergleich heilt Whitespace in Altdaten. Fehlermeldungen präzise
  („PIN falsch für {Name}" vs. „Login-ID existiert nicht").
- **Betriebs-ID** (`orgCode`): deterministisch aus dem Namen (FNV-Hash, Alphabet
  ohne 0/O/1/I/L). Einmal vergeben = nie ändern.
- **Tarife** (`PLANS`): free(5 MA)/trial(14 T)/starter/pro/business — steuern
  maxEmps, Auto-Planung, Lohn-Export, White-Label-Akzent. Status-Lifecycle:
  active/trial/suspended/archived (Login-Sperren in `doLogin`).
- **Rollen/Rechte:** ROLES + DEFAULT_PERMS + per-Betrieb-Matrix; `can(perm)` prüft.
  Mitarbeiter sehen nur Start/Plan/Anfragen/Profil.

## Design-System (strikt einhalten)

- Schriften: Hanken Grotesk (UI), Schibsted Grotesk (Headlines/Zahlen), tabular-nums.
- Eine Akzentfarbe (Indigo #4f46e5, pro Betrieb via `org.accent` aus ACCENTS).
  Neutrale warme Palette, KEINE Verläufe, KEINE Emojis — nur das `Icon`-SVG-Set.
- Avatare = Initialen in Rollenfarbe. Deutsch, metrische Einheiten, Du-Form.

## Befehle

- E2E: `npx esbuild tests/entry.jsx --bundle --jsx=automatic --format=iife
  --outfile=/tmp/bundle.js && node tests/e2e.test.cjs`
  (entry rendert App in #root; siehe README)

## Roadmap (Reihenfolge ist bewusst)

1. Vite-Projekt, App.jsx in Module zerlegen (Verhalten 1:1, E2E grün)
2. Supabase: Schema + Auth + RLS (docs/MIGRATION.md), storage-Layer austauschen
3. Stripe (Tarife existieren schon als PLANS), Deployment (Vercel)
4. PWA/Push, dann Forecast-Features

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
