-- ============================================================
-- ShiftSync Pro · Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── ORGS ────────────────────────────────────────────────────
create table public.orgs (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,          -- 5-char FNV hash, never changes
  name          text not null,
  sub           text not null default 'Tankstelle · 24/7',
  week_std_hours numeric not null default 40,
  shifts        jsonb not null default '[]',   -- [{key,label,start,end,required,colorIdx}]
  holidays      jsonb not null default '[]',   -- [{date,name}]
  perms         jsonb not null default '{}',   -- Rollen-Berechtigungsmatrix
  status        text not null default 'trial'  -- active|trial|suspended|archived
                  check (status in ('active','trial','suspended','archived')),
  plan          text not null default 'trial'  -- free|trial|starter|pro|business
                  check (plan in ('free','trial','starter','pro','business')),
  trial_ends    timestamptz,
  accent        text default '#4f46e5',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at    timestamptz not null default now()
);

-- ─── EMPLOYEES ───────────────────────────────────────────────
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs on delete cascade,
  name          text not null,
  lid           text not null,                 -- login-id, lowercase, unique per org
  pin_hash      text not null,                 -- bcrypt hash
  role          text not null default 'staff'
                  check (role in ('owner','director','manager','staff')),
  work_pct      int not null default 100
                  check (work_pct between 1 and 200),
  pref          text not null default 'any',
  in_plan       boolean not null default true,
  notes         text not null default '',
  linked_orgs   jsonb not null default '[]',   -- [{id,code,name,lid}]
  created_at    timestamptz not null default now(),
  unique (org_id, lid)
);

-- ─── SCHEDULES ────────────────────────────────────────────────
create table public.schedules (
  org_id        uuid not null references public.orgs on delete cascade,
  month         text not null,                 -- 'YYYY-MM'
  data          jsonb not null default '{}',   -- {empId: ["F"|"S"|"-"…]}
  published_at  timestamptz not null default now(),
  published_by  uuid references public.employees,
  primary key (org_id, month)
);

-- ─── REQUESTS ─────────────────────────────────────────────────
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs on delete cascade,
  emp_id        uuid not null references public.employees on delete cascade,
  type          text not null
                  check (type in ('vac','sick','swap')),
  payload       jsonb not null default '{}',   -- dates[], fromDate, toDate, toId, toDate, note
  status        text not null default 'pending'
                  check (status in ('pending','ok','no')),
  decided_by    uuid references public.employees,
  decided_at    timestamptz,
  decision_note text not null default '',
  created_at    timestamptz not null default now()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs on delete cascade,
  emp_id        uuid not null references public.employees on delete cascade,
  type          text not null,                 -- decision_ok|decision_no|newreq|swap|plan
  text          text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ─── CLOCK ENTRIES ────────────────────────────────────────────
create table public.clock_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs on delete cascade,
  emp_id        uuid not null references public.employees on delete cascade,
  day           date not null,
  clock_in      timestamptz,
  clock_out     timestamptz,
  unique (org_id, emp_id, day)
);

-- ─── MARKET OFFERS (Schichtbörse) ─────────────────────────────
create table public.market_offers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs on delete cascade,
  emp_id        uuid not null references public.employees on delete cascade,
  month         text not null,
  day           int not null,
  shift_key     text not null,
  status        text not null default 'open'
                  check (status in ('open','taken','withdrawn')),
  taker_id      uuid references public.employees,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── WISHES ──────────────────────────────────────────────────
create table public.wishes (
  org_id        uuid not null references public.orgs on delete cascade,
  emp_id        uuid not null references public.employees on delete cascade,
  month         text not null,                 -- 'YYYY-MM'
  days          int[] not null default '{}',
  note          text not null default '',
  updated_at    timestamptz not null default now(),
  primary key (org_id, emp_id, month)
);

-- ─── INDEXES ──────────────────────────────────────────────────
create index on public.employees (org_id);
create index on public.schedules (org_id);
create index on public.requests (org_id, status);
create index on public.notifications (org_id, emp_id, read);
create index on public.clock_entries (org_id, emp_id, day);
create index on public.market_offers (org_id, status);
create index on public.wishes (org_id, emp_id);
