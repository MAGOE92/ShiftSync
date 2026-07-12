-- Push-Token der nativen Apps (iOS/Android). Ein Token = ein Gerät.
-- Zugriff ausschließlich über die Edge Function "api" (service_role);
-- RLS gesperrt wie bei allen anderen Tabellen.
create table if not exists push_tokens (
  token text primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  platform text not null default 'android', -- 'ios' | 'android'
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_emp_idx on push_tokens(org_id, emp_id);

alter table push_tokens enable row level security;
-- keine Policies: nur service_role kommt dran
