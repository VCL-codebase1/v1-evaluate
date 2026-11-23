-- Legacy estimates have only a display name. A current name match cannot
-- distinguish a renamed or deleted creator from another member of the tenant.
-- Leave ownership unresolved until the organization verifies the creator.
alter table estimates add column owner_user_id text references users(id) on delete set null;
