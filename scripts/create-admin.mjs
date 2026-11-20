#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { scryptSync } from "node:crypto";
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

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const passwordHash = scryptSync(password, salt, 32).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env[name.toUpperCase()] || "";
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const email = (arg("email") || "").trim().toLowerCase();
const name = (arg("name") || "Administrator").trim();
const role = (arg("role") || "Admin").trim();
let password = arg("password");
const generated = !password;
if (!password) password = randomBytes(18).toString("base64url");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/create-admin.mjs --email admin@example.com [--name 'Admin'] [--password 'StrongPass123'] [--role Admin]");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
});

async function ensureProfileTableColumns() {
  await sql.unsafe(`
    alter table if exists users add column if not exists auth_user_id uuid;
    create unique index if not exists users_auth_user_id_unique_idx on users(auth_user_id) where auth_user_id is not null;
    alter table if exists users alter column password_hash drop not null;
    alter table if exists users alter column password_salt drop not null;
  `).catch(() => {});
}

async function findSupabaseUserByEmail(admin, targetEmail) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users?.find((u) => (u.email || "").toLowerCase() === targetEmail) || null;
}

try {
  await ensureProfileTableColumns();

  const existingRows = await sql`select id, auth_user_id from users where lower(email) = ${email} limit 1`;
  const existing = existingRows[0] || null;

  let authUserId = existing?.auth_user_id ? String(existing.auth_user_id) : null;
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role },
    });

    if (createError) {
      if (/already|exists|registered/i.test(createError.message || "")) {
        const found = await findSupabaseUserByEmail(admin, email);
        if (!found) {
          console.error(`Supabase auth user exists but could not be resolved: ${createError.message}`);
          process.exit(1);
        }
        authUserId = found.id;
        const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: { name },
          app_metadata: { role },
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
  } else {
    console.warn("Supabase service env not set; creating/updating local DB profile only (Supabase Auth user not provisioned).");
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  if (existing) {
    const id = String(existing.id);
    await sql`
      update users set
        auth_user_id = ${authUserId}::uuid,
        name = ${name},
        role = ${role},
        password_hash = ${passwordHash},
        password_salt = ${passwordSalt},
        is_active = true,
        must_change_password = false,
        failed_login_count = 0,
        locked_until = null,
        updated_at = now()
      where id = ${id}
    `;
    console.log(JSON.stringify({ ok: true, id, email, name, role, authUserId, passwordGenerated: generated, updated: true }, null, 2));
  } else {
    const id = `usr-${randomBytes(12).toString("hex")}`;
    await sql`
      insert into users(id, auth_user_id, email, name, role, password_hash, password_salt, is_active, must_change_password)
      values (${id}, ${authUserId}::uuid, ${email}, ${name}, ${role}, ${passwordHash}, ${passwordSalt}, true, false)
    `;
    console.log(JSON.stringify({ ok: true, id, email, name, role, authUserId, passwordGenerated: generated }, null, 2));
  }

  if (generated) {
    console.log(`\nINITIAL_PASSWORD=${password}`);
    console.log("Store this password securely and rotate/change after first sign-in.");
  }
  if (!authUserId) {
    console.log("\nNOTE: No Supabase auth identity was linked. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and reprovision, or create/link the auth user in Supabase.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
