#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { scryptSync } from "node:crypto";

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

const email = (arg("email") || "").trim().toLowerCase();
const name = (arg("name") || "Administrator").trim();
const role = (arg("role") || "Admin").trim();
let password = arg("password");
const generated = !password;
if (!password) password = randomBytes(18).toString("base64url");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/create-admin.mjs --email admin@example.com [--name \"Admin\"] [--password \"StrongPass123!\"] [--role Admin]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false });

try {
  const existing = await sql`select id from users where lower(email) = lower(${email}) limit 1`;
  if (existing.length > 0) {
    console.error(`User with email ${email} already exists.`);
    process.exit(1);
  }
  const id = `usr-${randomBytes(12).toString("hex")}`;
  const { passwordHash, passwordSalt } = hashPassword(password);
  await sql`
    insert into users(id, email, name, role, password_hash, password_salt, is_active, must_change_password)
    values (${id}, ${email}, ${name}, ${role}, ${passwordHash}, ${passwordSalt}, true, false)
  `;
  console.log(JSON.stringify({ ok: true, id, email, name, role, passwordGenerated: generated }, null, 2));
  if (generated) {
    console.log(`\nINITIAL_PASSWORD=${password}`);
    console.log("Store this password securely and rotate/change after first sign-in.");
  }
} catch (error) {
  console.error("Failed to create user:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
