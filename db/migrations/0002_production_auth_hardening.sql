-- 0002_production_auth_hardening: auth hardening, provisioning, reset, throttling, and seed cleanup

-- Users: lifecycle and lockout fields
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists must_change_password boolean not null default false;
alter table users add column if not exists failed_login_count integer not null default 0;
alter table users add column if not exists locked_until timestamptz;
alter table users add column if not exists last_login_at timestamptz;

-- Password reset tokens (store hash only, single-use)
create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  requested_ip text,
  requested_user_agent text
);
create index if not exists password_reset_tokens_user_id_idx on password_reset_tokens(user_id);
create index if not exists password_reset_tokens_expires_at_idx on password_reset_tokens(expires_at);

-- Generic auth throttling / lockout windows (e.g. login, forgot-password by ip/email)
create table if not exists auth_throttle (
  scope text not null,
  subject text not null,
  window_started_at timestamptz not null default now(),
  fail_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, subject)
);
create index if not exists auth_throttle_blocked_until_idx on auth_throttle(blocked_until);

-- Remove seeded demo accounts from 0001_init (rotate credentials; provision real users instead)
delete from users where email in (
  'rep1@v11.estimate',
  'manager@v11.estimate',
  'director@v11.estimate'
);
