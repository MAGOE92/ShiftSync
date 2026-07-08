-- Freie Zusatzfelder, die der Gateway bisher stillschweigend verworfen hat:
-- orgs.settings   → availMode, absEntryMode, regenLeadDays
-- employees.profile → avail, maxDaysPerWeek, vacDays, vacCarry, startDate, hrNotes
-- (Bereits am 2026-07-09 via Supabase MCP auf esnqnedjqtslkncttzrr angewendet.)
alter table public.orgs add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.employees add column if not exists profile jsonb not null default '{}'::jsonb;
