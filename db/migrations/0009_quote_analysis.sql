alter table pricing_rules add column mode_rules jsonb not null default '{}'::jsonb;
alter table pricing_rules alter column soncap set default 0;
update pricing_rules set soncap = 0
where soncap = 650 and air_bank = 0.25 and customs = 10.5
  and agency = 7.5 and delivery = 1.5 and warehouse = 12.5
  and markup = 30 and local_bank = 0.5 and local_delivery = 1
  and local_markup = 15 and bank1 = 15;
alter table estimate_sheets add column pricing_snapshot jsonb;
alter table estimate_sheets add column rate_snapshot jsonb;
