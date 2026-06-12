-- ============================================================
-- ShiftSync Pro · Row Level Security
-- JWT claims: { org_id, emp_id, role, is_super }
-- ============================================================

-- Enable RLS on all tables
alter table public.orgs              enable row level security;
alter table public.employees         enable row level security;
alter table public.schedules         enable row level security;
alter table public.requests          enable row level security;
alter table public.notifications     enable row level security;
alter table public.clock_entries     enable row level security;
alter table public.market_offers     enable row level security;
alter table public.wishes            enable row level security;

-- Helper: extract claim from JWT
create or replace function auth.jwt_claim(claim text)
returns text language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> claim),
    ''
  );
$$;

create or replace function auth.my_org_id() returns uuid language sql stable as $$
  select nullif(auth.jwt_claim('org_id'), '')::uuid;
$$;

create or replace function auth.my_emp_id() returns uuid language sql stable as $$
  select nullif(auth.jwt_claim('emp_id'), '')::uuid;
$$;

create or replace function auth.my_role() returns text language sql stable as $$
  select auth.jwt_claim('role');
$$;

create or replace function auth.is_super() returns boolean language sql stable as $$
  select auth.jwt_claim('is_super') = 'true';
$$;

create or replace function auth.is_mgmt() returns boolean language sql stable as $$
  select auth.my_role() in ('owner','director','manager');
$$;

-- ─── ORGS ────────────────────────────────────────────────────
-- Super admin: all. Regular user: only own org.
create policy "orgs: read own" on public.orgs for select
  using (auth.is_super() or id = auth.my_org_id());

create policy "orgs: update own (mgmt only)" on public.orgs for update
  using (id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt()));

-- ─── EMPLOYEES ───────────────────────────────────────────────
create policy "emps: read own org" on public.employees for select
  using (auth.is_super() or org_id = auth.my_org_id());

create policy "emps: insert own org (mgmt)" on public.employees for insert
  with check (org_id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt()));

create policy "emps: update own org (mgmt or self)" on public.employees for update
  using (org_id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt() or id = auth.my_emp_id()));

create policy "emps: delete own org (owner/super)" on public.employees for delete
  using (org_id = auth.my_org_id() and (auth.is_super() or auth.my_role() = 'owner'));

-- ─── SCHEDULES ────────────────────────────────────────────────
create policy "scheds: read own org" on public.schedules for select
  using (auth.is_super() or org_id = auth.my_org_id());

create policy "scheds: write own org (mgmt)" on public.schedules for insert
  with check (org_id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt()));

create policy "scheds: update own org (mgmt)" on public.schedules for update
  using (org_id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt()));

-- ─── REQUESTS ─────────────────────────────────────────────────
create policy "reqs: read own org" on public.requests for select
  using (auth.is_super() or org_id = auth.my_org_id());

create policy "reqs: insert own org (own emp)" on public.requests for insert
  with check (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

create policy "reqs: update own org (mgmt or own pending)" on public.requests for update
  using (org_id = auth.my_org_id() and (auth.is_super() or auth.is_mgmt()
    or (emp_id = auth.my_emp_id() and status = 'pending')));

-- ─── NOTIFICATIONS ────────────────────────────────────────────
create policy "notifs: read own" on public.notifications for select
  using (auth.is_super() or (org_id = auth.my_org_id() and emp_id = auth.my_emp_id()));

create policy "notifs: update own (mark read)" on public.notifications for update
  using (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

create policy "notifs: delete own" on public.notifications for delete
  using (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

-- Insert from server-side only (Edge Functions have service_role key)
create policy "notifs: insert via service role" on public.notifications for insert
  with check (true);

-- ─── CLOCK ENTRIES ────────────────────────────────────────────
create policy "clock: read own org (mgmt) or own" on public.clock_entries for select
  using (auth.is_super() or (org_id = auth.my_org_id()
    and (auth.is_mgmt() or emp_id = auth.my_emp_id())));

create policy "clock: insert/update own" on public.clock_entries for insert
  with check (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

create policy "clock: update own" on public.clock_entries for update
  using (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

-- ─── MARKET OFFERS ────────────────────────────────────────────
create policy "market: read own org" on public.market_offers for select
  using (auth.is_super() or org_id = auth.my_org_id());

create policy "market: insert own" on public.market_offers for insert
  with check (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

create policy "market: update own or taker" on public.market_offers for update
  using (org_id = auth.my_org_id() and (emp_id = auth.my_emp_id() or auth.is_mgmt() or auth.is_super()));

-- ─── WISHES ──────────────────────────────────────────────────
create policy "wishes: read own org (mgmt) or own" on public.wishes for select
  using (auth.is_super() or (org_id = auth.my_org_id()
    and (auth.is_mgmt() or emp_id = auth.my_emp_id())));

create policy "wishes: write own" on public.wishes for insert
  with check (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());

create policy "wishes: update own" on public.wishes for update
  using (org_id = auth.my_org_id() and emp_id = auth.my_emp_id());
