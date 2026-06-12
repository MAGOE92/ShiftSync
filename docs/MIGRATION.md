# Migrationsplan: Prototyp → Produkt

## Phase 1 — Projektstruktur (1–2 Sitzungen)

Ziel: identisches Verhalten, saubere Struktur. KEINE Funktionsänderungen.

```
npm create vite@latest shiftsync -- --template react
```

Zerlegung von `src/App.jsx` (Vorschlag):
```
src/
├── lib/storage.js        # window.storage-Wrapper → später Supabase-Adapter
├── lib/arbzg.js          # arbzgCheck (pure function, unit-testbar)
├── lib/algo.js           # Auto-Generator (pure function, unit-testbar)
├── lib/orgCode.js        # deterministische Betriebs-ID
├── theme/                # T-Paletten, Icon-Set, Logo, Avatar
├── views/Login.jsx, Setup.jsx, SuperConsole.jsx
├── views/admin/  (Dash, Team, Requests, Planner, Settings)
├── views/employee/ (Home+Stempeluhr, Plan+Börse, Requests, Profile)
└── App.jsx               # Routing/State-Container
```
Abnahme: `tests/e2e.test.cjs` grün + manueller Vergleich gegen
`standalone/ShiftSyncPro.html`.

## Phase 2 — Supabase

### Schema (SQL-Entwurf)

```sql
create table orgs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null, sub text,
  week_std_hours numeric default 40,
  shifts jsonb not null,          -- [{key,label,start,end,required,color}]
  holidays jsonb default '[]',
  perms jsonb,                    -- Berechtigungs-Matrix
  status text default 'trial',    -- active|trial|suspended|archived
  plan text default 'trial',
  trial_ends timestamptz,
  accent text,
  created_at timestamptz default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  name text not null,
  lid text not null,              -- lowercase, unique je Betrieb
  pin_hash text not null,         -- bcrypt! NIE wieder Klartext
  role text default 'staff',
  work_pct int default 100,
  pref text default 'any',
  in_plan boolean default true,
  unique (org_id, lid)
);

create table schedules (
  org_id uuid references orgs on delete cascade,
  month text not null,            -- 'YYYY-MM'
  data jsonb not null,            -- { empId: [Tageskürzel] }
  published_at timestamptz default now(),
  primary key (org_id, month)
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  emp_id uuid references employees on delete cascade,
  type text not null,             -- vac|sick|swap
  payload jsonb not null,
  status text default 'pending',
  decided_by uuid, decided_at timestamptz, decision_note text,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  emp_id uuid references employees on delete cascade,
  type text, text text, read boolean default false,
  created_at timestamptz default now()
);

create table clock_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  emp_id uuid references employees on delete cascade,
  day date not null,
  clock_in timestamptz, clock_out timestamptz,
  unique (org_id, emp_id, day)
);

create table market_offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,
  emp_id uuid references employees on delete cascade,
  month text, day int, shift_key text,
  status text default 'open',     -- open|taken|withdrawn
  taker_id uuid, taken_at timestamptz,
  created_at timestamptz default now()
);
```

### Auth & RLS

- Login: Edge Function `login(code, lid, pin)` → prüft bcrypt, gibt
  Custom-JWT mit `org_id` + `emp_id` + `role` zurück (oder Supabase-Auth
  mit anonymem User + Claims).
- RLS auf JEDER Tabelle: `org_id = auth.jwt() ->> 'org_id'`.
  Schreibrechte zusätzlich nach Rolle (z. B. schedules nur owner/director/manager).
- Verknüpfte Betriebe (linkedOrgs): eigene Tabelle `memberships(emp_global_id,
  org_id, role)` — löst das Paar-Modell des Prototyps sauber ab.

### Code-Umbau

Nur `lib/storage.js` austauschen: gleiche Funktionssignaturen, dahinter
supabase-js. Realtime-Subscription auf notifications + schedules für
Live-Updates. Stempel-PINs beim Erst-Login migrieren (hashen).

## Phase 3 — Stripe & Deploy

- Stripe Checkout + Customer Portal; Webhooks → orgs.status/plan
  (invoice.paid → active, payment_failed → past_due, Dunning → suspended).
- Deploy: Vercel (Frontend) + Supabase (DB/Functions). Eigene Domain.

## Phase 4 — PWA & Wachstum

Push-Benachrichtigungen (Börse!), Installierbarkeit, dann Forecast/Benchmarks.
