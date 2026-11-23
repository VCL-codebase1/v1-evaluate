alter table exchange_rates
  add column if not exists floatation numeric not null default 0;
