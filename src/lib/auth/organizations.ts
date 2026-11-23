import { randomUUID } from "crypto";
import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";

export type DbOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapOrg(row: Record<string, unknown>): DbOrganization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: toIso(row.created_at),
  };
}

export function slugifyOrganizationName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "organization";
}

export async function getOrganizationById(id: string): Promise<DbOrganization | null> {
  await ensureDb();
  const rows = await sql()`select id, name, slug, created_at from organizations where id = ${id} limit 1`;
  return rows[0] ? mapOrg(rows[0] as Record<string, unknown>) : null;
}

export async function createOrganization(input: { name: string; slugBase?: string }) {
  await ensureDb();
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required.");
  const id = `org-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const base = slugifyOrganizationName(input.slugBase || name);
  const slug = `${base}-${id.slice(-6)}`;
  return sql().begin(async (db) => {
    const rows = await db`
      insert into organizations(id, name, slug)
      values (${id}, ${name}, ${slug})
      returning id, name, slug, created_at
    `;
    await db`
      insert into exchange_rates(organization_id, currency, rate)
      values (${id}, 'NGN', 1)
    `;
    return mapOrg(rows[0] as Record<string, unknown>);
  });
}
