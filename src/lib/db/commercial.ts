import { ensureDb } from "@/lib/db/schema";
import { sql } from "@/lib/db/client";
import {
  DEFAULT_RULES,
  type DirectoryKind,
  type DirectoryRecord,
  type PricingRules,
  type QuotationDraft,
} from "@/lib/commercial-types";

export type { DirectoryKind, DirectoryRecord, PricingRules, QuotationDraft };
export { DEFAULT_RULES };

function id() {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listDirectory(organizationId: string, kind: DirectoryKind): Promise<DirectoryRecord[]> {
  await ensureDb();
  const rows = await sql()`
    select id, kind, name, contact, email, status
    from directory_records
    where organization_id = ${organizationId} and kind = ${kind}
    order by created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind) as DirectoryKind,
    name: String(row.name),
    contact: String(row.contact),
    email: String(row.email),
    status: String(row.status),
  }));
}

export async function addDirectory(
  organizationId: string,
  kind: DirectoryKind,
  input: { name: string; contact: string; email: string },
) {
  await ensureDb();
  const recordId = id();
  await sql()`
    insert into directory_records(id, organization_id, kind, name, contact, email)
    values (${recordId}, ${organizationId}, ${kind}, ${input.name}, ${input.contact}, ${input.email})
  `;
  return { id: recordId, kind, ...input, status: "Active" };
}

export async function importDirectory(
  organizationId: string,
  kind: DirectoryKind,
  rows: { name: string; contact: string; email: string }[],
) {
  const saved = [];
  for (const row of rows) {
    if (!row.name.trim()) continue;
    saved.push(await addDirectory(organizationId, kind, {
      name: row.name.trim(),
      contact: row.contact.trim(),
      email: row.email.trim(),
    }));
  }
  return saved;
}

function mapRules(row: Record<string, unknown>): PricingRules {
  return {
    ...DEFAULT_RULES,
    airBank: Number(row.air_bank),
    customs: Number(row.customs),
    agency: Number(row.agency),
    delivery: Number(row.delivery),
    warehouse: Number(row.warehouse),
    markup: Number(row.markup),
    soncap: Number(row.soncap),
    localBank: Number(row.local_bank),
    localDelivery: Number(row.local_delivery),
    localMarkup: Number(row.local_markup),
    bank1: Number(row.bank1),
    ...((row.mode_rules && typeof row.mode_rules === "object") ? row.mode_rules as Partial<PricingRules> : {}),
  };
}

export async function getPricingRules(organizationId: string): Promise<PricingRules> {
  await ensureDb();
  const rows = await sql()`select * from pricing_rules where organization_id = ${organizationId} limit 1`;
  if (!rows[0]) return { ...DEFAULT_RULES };
  return mapRules(rows[0] as Record<string, unknown>);
}

export async function savePricingRules(organizationId: string, rules: PricingRules) {
  await ensureDb();
  await sql()`
    insert into pricing_rules(
      organization_id, air_bank, customs, agency, delivery, warehouse, markup, soncap,
      local_bank, local_delivery, local_markup, bank1, mode_rules
    ) values (
      ${organizationId}, ${rules.airBank}, ${rules.customs}, ${rules.agency}, ${rules.delivery},
      ${rules.warehouse}, ${rules.markup}, ${rules.soncap}, ${rules.localBank}, ${rules.localDelivery},
      ${rules.localMarkup}, ${rules.bank1}, ${sql().json(rules)}::jsonb
    )
    on conflict (organization_id) do update set
      air_bank = excluded.air_bank,
      customs = excluded.customs,
      agency = excluded.agency,
      delivery = excluded.delivery,
      warehouse = excluded.warehouse,
      markup = excluded.markup,
      soncap = excluded.soncap,
      local_bank = excluded.local_bank,
      local_delivery = excluded.local_delivery,
      local_markup = excluded.local_markup,
      bank1 = excluded.bank1,
      mode_rules = excluded.mode_rules
  `;
  return rules;
}

export async function getQuotation(organizationId: string, estimateId: string): Promise<QuotationDraft> {
  await ensureDb();
  const rows = await sql()`
    select * from quotations where organization_id = ${organizationId} and estimate_id = ${estimateId} limit 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return {
      estimateId,
      scope: "",
      delivery: "",
      payment: "",
      validity: "",
      exclusions: "",
      warranty: "",
      terms: "",
      recipient: "",
      issued: [],
    };
  }
  const issued = Array.isArray(row.issued) ? row.issued.map(String) : [];
  return {
    estimateId,
    scope: String(row.scope ?? ""),
    delivery: String(row.delivery ?? ""),
    payment: String(row.payment ?? ""),
    validity: String(row.validity ?? ""),
    exclusions: String(row.exclusions ?? ""),
    warranty: String(row.warranty ?? ""),
    terms: String(row.terms ?? ""),
    recipient: String(row.recipient ?? ""),
    issued,
  };
}

export async function saveQuotation(organizationId: string, draft: QuotationDraft) {
  await ensureDb();
  const issued = JSON.stringify(draft.issued);
  await sql()`
    insert into quotations(
      estimate_id, organization_id, scope, delivery, payment, validity, exclusions, warranty, terms, recipient, issued
    ) values (
      ${draft.estimateId}, ${organizationId}, ${draft.scope}, ${draft.delivery}, ${draft.payment}, ${draft.validity},
      ${draft.exclusions}, ${draft.warranty}, ${draft.terms}, ${draft.recipient}, ${issued}::jsonb
    )
    on conflict (estimate_id) do update set
      scope = excluded.scope,
      delivery = excluded.delivery,
      payment = excluded.payment,
      validity = excluded.validity,
      exclusions = excluded.exclusions,
      warranty = excluded.warranty,
      terms = excluded.terms,
      recipient = excluded.recipient,
      issued = excluded.issued,
      updated_at = now()
  `;
  return draft;
}
