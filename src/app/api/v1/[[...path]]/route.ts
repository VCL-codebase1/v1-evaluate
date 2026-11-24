import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createEstimate,
  dashboard,
  decideEstimate,
  dropRefreshToken,
  findUserByEmail,
  findUserById,
  getEstimate,
  getRates,
  getSheetView,
  addDirectory,
  getPricingRules,
  getQuotation,
  importDirectory,
  listAudit,
  listApprovals,
  listClients,
  listDirectory,
  listEstimates,
  listReports,
  savePricingRules,
  saveQuotation,
  publicUser,
  saveRates,
  saveRefreshToken,
  saveSheet,
  submitEstimate,
  takeRefreshToken,
  type ApiUser,
} from "@/lib/backend/store";
import { openApiDocument } from "@/lib/backend/openapi";
import { signJwt, verifyJwt } from "@/lib/jwt";
import type { PricingRules, QuotationDraft } from "@/lib/db/commercial";
import type { ExchangeRateTable, SheetLine } from "@/lib/types";
import { log, requestMeta } from "@/lib/observability/logger";
import { checkThrottle, checkThrottles, clearThrottle, registerFailure, throttleSubject } from "@/lib/auth/throttle";
import { isUserLocked, markLoginFailure, markLoginSuccess } from "@/lib/auth/users";
import { canManageExchangeRates, canSubmitEstimate, isOrgAdmin } from "@/lib/auth/roles";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { supabaseFetch } from "@/lib/supabase/fetch";

type Context = { params: Promise<{ path?: string[] }> };

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

async function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const claims = verifyJwt(token);
  if (!claims || claims.typ !== "access") return null;
  const user = await findUserById(claims.sub);
  if (!user || !user.isActive || isUserLocked(user)) return null;
  return user;
}

async function issueTokens(user: ApiUser) {
  const accessToken = signJwt(
    { sub: user.id, role: user.role, name: user.name, typ: "access" },
    60 * 15,
  );
  const jti = randomUUID();
  const refreshToken = signJwt(
    { sub: user.id, role: user.role, name: user.name, typ: "refresh", jti },
    60 * 60 * 24 * 7,
  );
  const claims = verifyJwt(refreshToken);
  await saveRefreshToken(jti, user.id, claims?.exp ?? 0);
  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: 60 * 15, user: publicUser(user) };
}

async function readJson(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

async function handle(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const key = path.join("/");
  const method = request.method;

  if (method === "GET" && key === "openapi.json") {
    return json(openApiDocument);
  }

  if (method === "POST" && key === "auth/login") {
    const body = await readJson(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const meta = requestMeta(request);
    const ipSubject = throttleSubject("v1login:ip", meta.ip);
    const emailSubject = throttleSubject("v1login:email", email || "blank");
    const ipCfg = { scope: "v1login:ip", subject: ipSubject, windowMs: 15 * 60_000, maxFailures: 20, blockMs: 15 * 60_000 };
    const emailCfg = { scope: "v1login:email", subject: emailSubject, windowMs: 15 * 60_000, maxFailures: 8, blockMs: 15 * 60_000 };

    const blocked = await checkThrottles(ipCfg, emailCfg);
    if (blocked.blocked) {
      log.warn("v1.auth.login.rate_limited", { ip: meta.ip });
      return json({ error: "Too many sign-in attempts. Try again later." }, 429, { "Retry-After": String(blocked.retryAfterSec) });
    }

    const user = email ? await findUserByEmail(email) : null;
    if (!user || !user.isActive || isUserLocked(user) || !user.authUserId) {
      await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
      log.warn("v1.auth.login.failed", { ip: meta.ip, reason: !user ? "not_found" : !user.isActive ? "inactive" : isUserLocked(user) ? "locked" : "bad_password" });
      return json({ error: "Email or password is incorrect." }, 401);
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: { fetch: supabaseFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || authData.user?.id !== user.authUserId) {
      await markLoginFailure(user.id);
      await Promise.all([registerFailure(ipCfg), registerFailure(emailCfg)]);
      log.warn("v1.auth.login.failed", { ip: meta.ip, reason: "supabase_auth" });
      return json({ error: "Email or password is incorrect." }, 401);
    }

    await Promise.all([markLoginSuccess(user.id), clearThrottle("v1login:ip", ipSubject), clearThrottle("v1login:email", emailSubject)]);
    log.info("v1.auth.login.success", { userId: user.id, role: user.role });
    return json(await issueTokens(user));
  }

  if (method === "POST" && key === "auth/refresh") {
    const meta = requestMeta(request);
    const ipCfg = { scope: "v1refresh:ip", subject: throttleSubject("v1refresh:ip", meta.ip), windowMs: 15 * 60_000, maxFailures: 30, blockMs: 15 * 60_000 };
    const ipCheck = await checkThrottle(ipCfg);
    if (ipCheck.blocked) {
      log.warn("v1.auth.refresh.rate_limited", { ip: meta.ip });
      return json({ error: "Too many attempts. Try again later." }, 429, { "Retry-After": String(ipCheck.retryAfterSec) });
    }
    const body = await readJson(request);
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const claims = verifyJwt(refreshToken);
    if (!claims || claims.typ !== "refresh" || !claims.jti) {
      await registerFailure(ipCfg);
      return json({ error: "Refresh token is invalid." }, 401);
    }
    const stored = await takeRefreshToken(claims.jti);
    const user = stored ? await findUserById(stored.userId) : null;
    if (!stored || stored.userId !== claims.sub || !user || !user.isActive || isUserLocked(user)) {
      await registerFailure(ipCfg);
      return json({ error: "Refresh token is invalid." }, 401);
    }
    log.info("v1.auth.refresh.success", { userId: user.id });
    return json(await issueTokens(user));
  }

  const user = await bearer(request);
  if (!user) return json({ error: "Sign in with a bearer access token." }, 401);

  const role = user.role;
  const canManageRates = canManageExchangeRates(role);

  if (method === "POST" && key === "auth/logout") {
    const body = await readJson(request);
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const claims = verifyJwt(refreshToken);
    if (claims?.jti) await dropRefreshToken(claims.jti);
    log.info("v1.auth.logout", { userId: user.id });
    return new NextResponse(null, { status: 204 });
  }

  if (method === "GET" && key === "auth/me") return json({ user: publicUser(user) });
  if (method === "GET" && key === "estimates") return json({ estimates: await listEstimates(user.organizationId) });
  if (method === "GET" && key === "approvals") {
    return json({ estimates: await listApprovals(user.organizationId) });
  }
  if (method === "GET" && key === "audit") {
    const estimateId = new URL(request.url).searchParams.get("estimateId") ?? undefined;
    return json({ events: await listAudit(user.organizationId, estimateId) });
  }
  if (method === "GET" && key === "exchange-rates") return json({ rates: await getRates(user.organizationId) });
  if (method === "GET" && key === "clients") return json({ clients: await listClients(user.organizationId) });
  if (method === "GET" && key === "reports") return json({ reports: await listReports(user.organizationId) });
  if (method === "GET" && key === "dashboard") return json(await dashboard(user.organizationId));

  if (method === "GET" && key === "directory") {
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "client" && kind !== "supplier") return json({ error: "Choose clients or suppliers." }, 400);
    return json({ records: await listDirectory(user.organizationId, kind) });
  }

  if (method === "POST" && key === "directory") {
    const body = await readJson(request);
    const kind = body?.kind === "client" || body?.kind === "supplier" ? body.kind : null;
    if (!kind) return json({ error: "Choose clients or suppliers." }, 400);
    if (Array.isArray(body?.rows)) {
      const records = await importDirectory(
        user.organizationId,
        kind,
        body.rows.map((row) => {
          const entry = row as { name?: string; contact?: string; email?: string };
          return { name: String(entry.name ?? ""), contact: String(entry.contact ?? ""), email: String(entry.email ?? "") };
        }),
      );
      log.info("v1.directory.imported", { userId: user.id, kind, count: records.length });
      return json({ records }, 201);
    }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return json({ error: "Enter a name." }, 400);
    const record = await addDirectory(user.organizationId, kind, {
      name,
      contact: typeof body?.contact === "string" ? body.contact.trim() : "",
      email: typeof body?.email === "string" ? body.email.trim() : "",
    });
    log.info("v1.directory.created", { userId: user.id, kind });
    return json({ record }, 201);
  }

  if (method === "GET" && key === "pricing-rules") {
    return json({ rules: await getPricingRules(user.organizationId), canEdit: canManageRates });
  }

  if (method === "PUT" && key === "pricing-rules") {
    if (!canManageRates) return json({ error: "You do not have access to this action." }, 403);
    const body = await readJson(request);
    const patch = (body?.rules ?? body) as Partial<PricingRules> | null;
    if (!patch || typeof patch !== "object") return json({ error: "Enter the pricing rules." }, 400);
    const current = await getPricingRules(user.organizationId);
    const next = { ...current };
    (Object.keys(current) as (keyof PricingRules)[]).forEach((field) => {
      const value = patch[field];
      if (typeof value === "number" && Number.isFinite(value)) next[field] = value;
    });
    log.info("v1.pricing_rules.updated", { userId: user.id });
    return json({ rules: await savePricingRules(user.organizationId, next) });
  }

  const quotationMatch = key.match(/^quotations\/([^/]+)$/);
  if (quotationMatch && method === "GET") {
    const estimate = await getEstimate(quotationMatch[1], user.organizationId);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    return json({ quotation: await getQuotation(user.organizationId, quotationMatch[1]) });
  }
  if (quotationMatch && method === "PUT") {
    const estimate = await getEstimate(quotationMatch[1], user.organizationId);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    const body = (await readJson(request)) as Partial<QuotationDraft> | null;
    const current = await getQuotation(user.organizationId, quotationMatch[1]);
    const next: QuotationDraft = {
      ...current,
      ...body,
      estimateId: quotationMatch[1],
      issued: Array.isArray(body?.issued) ? body.issued.map(String) : current.issued,
    };
    log.info("v1.quotation.saved", { userId: user.id, estimateId: quotationMatch[1] });
    return json({ quotation: await saveQuotation(user.organizationId, next) });
  }

  if (method === "POST" && key === "estimates") {
    if (!canSubmitEstimate(user.role)) return json({ error: "You do not have access to create estimates." }, 403);
    const body = await readJson(request);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
    if (!title) return json({ error: "Enter the RFQ title.", field: "title" }, 400);
    if (!clientName) return json({ error: "Enter the client name.", field: "clientName" }, 400);
    const description = typeof body?.description === "string" ? body.description : "";
    return json({ estimate: await createEstimate({ title, clientName, description }, user) }, 201);
  }

  if (method === "PUT" && key === "exchange-rates") {
    if (!canManageRates) return json({ error: "You do not have access to this action." }, 403);
    const body = (await readJson(request)) as Partial<ExchangeRateTable> | null;
    log.info("v1.exchange_rates.updated", { userId: user.id });
    return json({ rates: await saveRates(user.organizationId, body ?? {}) });
  }

  const estimateMatch = key.match(/^estimates\/([^/]+)$/);
  if (method === "GET" && estimateMatch) {
    const estimate = await getEstimate(estimateMatch[1], user.organizationId);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    return json({ estimate });
  }

  const sheetMatch = key.match(/^estimates\/([^/]+)\/sheet$/);
  if (sheetMatch && method === "GET") {
    const sheet = await getSheetView(sheetMatch[1], user.organizationId);
    if (!sheet) return json({ error: "Estimate not found." }, 404);
    return json(sheet);
  }
  if (sheetMatch && method === "PUT") {
    const estimate = await getEstimate(sheetMatch[1], user.organizationId);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    if (!isOrgAdmin(user.role) && user.role !== "Line Manager" && estimate.ownerUserId !== user.id) {
      return json({ error: "You do not have access to edit this estimate." }, 403);
    }
    const body = await readJson(request);
    if (!Array.isArray(body?.lines)) return json({ error: "Send the sheet lines." }, 400);
    const result = await saveSheet(sheetMatch[1], body.lines as Partial<SheetLine>[], user);
    if ("error" in result) return json({ error: result.error }, result.error === "Estimate not found." ? 404 : 409);
    return json(result.sheet);
  }

  const submitMatch = key.match(/^estimates\/([^/]+)\/submit$/);
  if (method === "POST" && submitMatch) {
    if (!canSubmitEstimate(user.role)) return json({ error: "You do not have access to submit estimates." }, 403);
    const estimate = await getEstimate(submitMatch[1], user.organizationId);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    if (!isOrgAdmin(user.role) && estimate.ownerUserId !== user.id) {
      return json({ error: "You do not have access to submit this estimate." }, 403);
    }
    const result = await submitEstimate(submitMatch[1], user);
    if ("error" in result) return json({ error: result.error }, result.error === "Estimate not found." ? 404 : 400);
    return json(result.sheet);
  }

  const decisionMatch = key.match(/^estimates\/([^/]+)\/decision$/);
  if (method === "POST" && decisionMatch) {
    const body = await readJson(request);
    const decision = body?.decision === "approved" || body?.decision === "returned" ? body.decision : null;
    if (!decision) return json({ error: "Decision must be approved or returned." }, 400);
    const result = await decideEstimate(decisionMatch[1], decision, user);
    if ("error" in result) return json({ error: result.error }, result.error === "Estimate not found." ? 404 : 409);
    return json(result.sheet);
  }

  return json({ error: "Not found." }, 404);
}

export function GET(request: Request, context: Context) {
  return handle(request, context);
}

export function POST(request: Request, context: Context) {
  return handle(request, context);
}

export function PUT(request: Request, context: Context) {
  return handle(request, context);
}
