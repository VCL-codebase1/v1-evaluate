-- Password authentication is handled by Supabase Auth; remove duplicate local hashes.
alter table users drop column if exists password_hash;
alter table users drop column if exists password_salt;
drop table if exists password_reset_tokens;

-- New installations should configure current FX rates per organization.
-- Preserve rates where the legacy default organization already has user data.
delete from exchange_rates
where organization_id = 'org-default'
  and currency in ('USD', 'EUR', 'GBP')
  and not exists (select 1 from users where organization_id = 'org-default')
  and not exists (select 1 from estimates where organization_id = 'org-default');
