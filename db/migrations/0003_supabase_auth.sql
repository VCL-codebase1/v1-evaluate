-- Link app users to Supabase Auth identities and relax legacy password storage
alter table if exists users
  add column if not exists auth_user_id uuid;

create unique index if not exists users_auth_user_id_unique_idx
  on users(auth_user_id)
  where auth_user_id is not null;

create index if not exists users_email_idx on users(lower(email));

alter table if exists users alter column password_hash drop not null;
alter table if exists users alter column password_salt drop not null;
