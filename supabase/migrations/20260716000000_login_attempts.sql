-- Brute-Force-Schutz für den Login. Ein Eintrag je Identität
-- (email  oder  code:lid). Nur die Edge Function (service_role) greift zu.
create table if not exists login_attempts (
  key text primary key,
  fails int not null default 0,
  first_fail timestamptz not null default now(),
  locked_until timestamptz
);

alter table login_attempts enable row level security;
-- keine Policies: ausschließlich service_role
