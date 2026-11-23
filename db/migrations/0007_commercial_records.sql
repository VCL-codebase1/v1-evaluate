create table if not exists directory_records (
  id text primary key,
  organization_id text not null references organizations(id),
  kind text not null,
  name text not null,
  contact text not null default '',
  email text not null default '',
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create index if not exists directory_records_org_kind_idx on directory_records(organization_id, kind);

create table if not exists pricing_rules (
  organization_id text primary key references organizations(id),
  air_bank numeric not null default 0.25,
  customs numeric not null default 10.5,
  agency numeric not null default 7.5,
  delivery numeric not null default 1.5,
  warehouse numeric not null default 12.5,
  markup numeric not null default 30,
  soncap numeric not null default 650,
  local_bank numeric not null default 0.5,
  local_delivery numeric not null default 1,
  local_markup numeric not null default 15,
  bank1 numeric not null default 15
);

create table if not exists quotations (
  estimate_id text primary key,
  organization_id text not null references organizations(id),
  scope text not null default '',
  delivery text not null default '',
  payment text not null default '',
  validity text not null default '',
  exclusions text not null default '',
  warranty text not null default '',
  terms text not null default '',
  recipient text not null default '',
  issued jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
