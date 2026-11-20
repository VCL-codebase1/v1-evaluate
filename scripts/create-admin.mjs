#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(process.cwd() + "/" + file);
      if (process.env.DATABASE_URL) return;
    } catch {
      // ignore
    }
  }
}

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env[name.toUpperCase().replace(/-/g, "_")] || "";
}

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return base || "organization";
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to provision an account.");
  process.exit(1);
}

const email = (arg("email") || "").trim().toLowerCase();
const name = (arg("name") || "Administrator").trim();
const role = (arg("role") || "Super Admin").trim();
const organizationIdArg = (arg("organization-id") || arg("organizationId") || "").trim();
const organizationNameArg = (arg("organization-name") || arg("organizationName") || "").trim();
let password = arg("password");
const generated = !password;
if (!password) password = randomBytes(18).toString("base64url");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/create-admin.mjs --email admin@example.com [--name 'Admin'] [--password 'StrongPass123'] [--role 'Super Admin'] [--organization-id org-xxx | --organization-name 'Acme']");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
});

async function findSupabaseUserByEmail(admin, targetEmail) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users?.find((u) => (u.email || "").toLowerCase() === targetEmail) || null;
}

async function resolveOrganization() {
  if (organizationIdArg) {
    const rows = await sql`select id, name from organizations where id = ${organizationIdArg} limit 1`;
    if (!rows[0]) throw new Error(`Organization not found: ${organizationIdArg}`);
    return { id: String(rows[0].id), name: String(rows[0].name) };
  }
  if (organizationNameArg) {
    const id = `org-${randomBytes(10).toString("hex")}`;
    const slug = `${slugify(organizationNameArg)}-${id.slice(-6)}`;
    const rows = await sql`
      insert into organizations(id, name, slug)
      values (${id}, ${organizationNameArg}, ${slug})
      returning id, name
    `;
    const org = { id: String(rows[0].id), name: String(rows[0].name) };
    await sql`
      insert into exchange_rates(organization_id, currency, rate) values
        (${org.id}, 'NGN', 1)
      on conflict (organization_id, currency) do nothing
    `;
    return org;
  }
  const rows = await sql`select id, name from organizations order by created_at asc limit 1`;
  if (rows[0]) return { id: String(rows[0].id), name: String(rows[0].name) };
  throw new Error("No organization found. Provide --organization-name to create one or run the signup flow.");
}

try {
  const org = await resolveOrganization();
  const existingRows = await sql`
    select id, auth_user_id from users
    where lower(email) = ${email} and organization_id = ${org.id}
    limit 1
  `;
  const existing = existingRows[0] || null;

  let authUserId = existing?.auth_user_id ? String(existing.auth_user_id) : null;
  {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const userMeta = { name, organization_id: org.id, organization_name: org.name };
    const appMeta = { role, organization_id: org.id };

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMeta,
      app_metadata: appMeta,
    });

    if (createError) {
      if (/already|exists|registered/i.test(createError.message || "")) {
        const found = await findSupabaseUserByEmail(admin, email);
        if (!found) {
          console.error(`Supabase auth user exists but could not be resolved: ${createError.message}`);
          process.exit(1);
        }
        if (found.id !== authUserId && found.app_metadata?.organization_id !== org.id) {
          console.error("This email belongs to an account outside the selected organization.");
          process.exit(1);
        }
        authUserId = found.id;
        const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: userMeta,
          app_metadata: appMeta,
        });
        if (updErr) {
          console.error(`Failed to update existing Supabase auth user: ${updErr.message}`);
          process.exit(1);
        }
      } else {
        console.error(`Failed to create Supabase auth user: ${createError.message}`);
        process.exit(1);
      }
    } else {
      authUserId = created.user?.id ?? authUserId;
    }
  }

  if (existing) {
    const id = String(existing.id);
    await sql`
      update users set
        auth_user_id = ${authUserId}::uuid,
        name = ${name},
        role = ${role},
        is_active = true,
        must_change_password = false,
        failed_login_count = 0,
        locked_until = null,
        updated_at = now()
      where id = ${id}
    `;
    console.log(JSON.stringify({ ok: true, id, email, name, role, organizationId: org.id, organizationName: org.name, authUserId, passwordGenerated: generated, updated: true }, null, 2));
  } else {
    const id = `usr-${randomBytes(12).toString("hex")}`;
    await sql`
      insert into users(id, organization_id, auth_user_id, email, name, role, is_active, must_change_password)
      values (${id}, ${org.id}, ${authUserId}::uuid, ${email}, ${name}, ${role}, true, false)
    `;
    console.log(JSON.stringify({ ok: true, id, email, name, role, organizationId: org.id, organizationName: org.name, authUserId, passwordGenerated: generated }, null, 2));
  }

  if (generated) {
    console.log(`\nINITIAL_PASSWORD=${password}`);
    console.log("Store this password securely and rotate/change after first sign-in.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
