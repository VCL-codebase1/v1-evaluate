-- 0001_init: initial schema, indexes, and seed data for V11 Estimate

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  token_id text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user_id_idx on refresh_tokens(user_id);
create index if not exists refresh_tokens_expires_at_idx on refresh_tokens(expires_at);

create table if not exists estimates (
  id text primary key,
  title text not null default '',
  client_name text not null default '',
  tender_number text not null default '',
  contact text not null default '',
  department text not null default '',
  date_received text not null default '',
  deadline text not null default '',
  account_manager text not null default '',
  originator text not null default '',
  description text not null default '',
  remarks text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  mode text not null default 'Air freight',
  status text not null default 'pending',
  review_stage text not null default 'draft',
  workflow_step text not null default 'created',
  version text not null default 'v1',
  submitted_at timestamptz,
  submitted_by text,
  total_ngn numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estimates_created_at_idx on estimates(created_at desc);
create index if not exists estimates_status_idx on estimates(status);
create index if not exists estimates_review_stage_idx on estimates(review_stage);

create table if not exists estimate_sheets (
  estimate_id text primary key references estimates(id) on delete cascade,
  version text not null default 'v1',
  review_stage text not null default 'draft',
  lines jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  submitted_by text,
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  event_ref text not null unique,
  at timestamptz not null default now(),
  actor text not null,
  role text,
  action text not null,
  estimate_id text not null default '',
  detail text not null default ''
);
create index if not exists audit_events_estimate_id_idx on audit_events(estimate_id);
create index if not exists audit_events_at_idx on audit_events(at desc);

create table if not exists exchange_rates (
  currency text primary key,
  rate numeric not null
);

create table if not exists counters (
  name text primary key,
  value bigint not null
);

-- Seed counters
insert into counters(name, value) values ('estimate', 0), ('audit', 0)
  on conflict (name) do nothing;

-- Seed default exchange rates
insert into exchange_rates(currency, rate) values
  ('NGN', 1),
  ('USD', 1500),
  ('EUR', 1620),
  ('GBP', 1900)
on conflict (currency) do nothing;

-- Do not seed demo accounts. Provision users via admin tooling or scripts/create-admin.mjs.
-- Migration 0002 removes any legacy seeded demo accounts from existing databases.
