-- 0004_multitenant_organizations: organizations, tenant scoping, and Super Admin role support

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organizations_slug_idx on organizations(slug);

-- Backfill/create a default organization for existing data before enforcing tenant constraints.
insert into organizations(id, name, slug)
values ('org-default', 'Default Organization', 'default')
on conflict (id) do nothing;

-- Users: tenant membership
alter table users add column if not exists organization_id text;
update users set organization_id = 'org-default' where organization_id is null;
alter table users alter column organization_id set default 'org-default';
alter table users alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_organization_id_fkey'
  ) then
    alter table users
      add constraint users_organization_id_fkey
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists users_organization_id_idx on users(organization_id);
create index if not exists users_org_email_idx on users(organization_id, lower(email));

-- Replace global email uniqueness with per-organization uniqueness (email remains globally unique in Supabase Auth).
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'users'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (email)'
  loop
    execute format('alter table users drop constraint %I', c.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_organization_email_unique'
  ) then
    alter table users add constraint users_organization_email_unique unique (organization_id, email);
  end if;
end $$;

-- Estimates: tenant scoping
alter table estimates add column if not exists organization_id text;
update estimates set organization_id = 'org-default' where organization_id is null;
alter table estimates alter column organization_id set default 'org-default';
alter table estimates alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estimates_organization_id_fkey'
  ) then
    alter table estimates
      add constraint estimates_organization_id_fkey
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists estimates_organization_id_idx on estimates(organization_id);
create index if not exists estimates_org_created_at_idx on estimates(organization_id, created_at desc);

-- Audit events: tenant scoping
alter table audit_events add column if not exists organization_id text;
update audit_events set organization_id = 'org-default' where organization_id is null;
alter table audit_events alter column organization_id set default 'org-default';
alter table audit_events alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audit_events_organization_id_fkey'
  ) then
    alter table audit_events
      add constraint audit_events_organization_id_fkey
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists audit_events_organization_id_idx on audit_events(organization_id);
create index if not exists audit_events_org_at_idx on audit_events(organization_id, at desc);

-- Exchange rates: per-organization rates
alter table exchange_rates add column if not exists organization_id text;
update exchange_rates set organization_id = 'org-default' where organization_id is null;
alter table exchange_rates alter column organization_id set default 'org-default';
alter table exchange_rates alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exchange_rates_organization_id_fkey'
  ) then
    alter table exchange_rates
      add constraint exchange_rates_organization_id_fkey
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

-- Replace global currency primary key with (organization_id, currency)
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'exchange_rates'::regclass
      and contype = 'p'
  loop
    execute format('alter table exchange_rates drop constraint %I', c.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exchange_rates_org_currency_pkey'
  ) then
    alter table exchange_rates add constraint exchange_rates_org_currency_pkey primary key (organization_id, currency);
  end if;
end $$;

create index if not exists exchange_rates_org_idx on exchange_rates(organization_id);

-- Ensure default exchange rates exist for the default org (idempotent)
insert into exchange_rates(organization_id, currency, rate) values
  ('org-default', 'NGN', 1),
  ('org-default', 'USD', 1500),
  ('org-default', 'EUR', 1620),
  ('org-default', 'GBP', 1900)
on conflict (organization_id, currency) do nothing;
