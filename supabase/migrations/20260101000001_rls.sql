-- ============================================================
-- ShiftSync Pro · Row Level Security (Gateway-Architektur)
-- ============================================================
-- Sicherheitsmodell: ALLER Datenzugriff läuft über die Edge-Function
-- "api" (service_role, umgeht RLS). Der öffentliche anon/publishable-Key
-- darf NICHTS direkt — RLS ist aktiv, aber es gibt KEINE Policies.
-- Mandantentrennung und Auth werden serverseitig im Gateway erzwungen
-- (eigene HMAC-Session-Tokens, PBKDF2-PIN-Hashes).

do $$
declare t text;
begin
  foreach t in array array[
    'orgs','employees','schedules','requests',
    'notifications','clock_entries','market_offers','wishes'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- Keine Policies = Default-Deny für anon & authenticated.
-- service_role (Edge Functions) umgeht RLS grundsätzlich.
