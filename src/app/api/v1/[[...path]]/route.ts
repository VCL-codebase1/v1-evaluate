import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
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
  listAudit,
  listClients,
  listEstimates,
  listReports,
  publicUser,
  saveRates,
  saveRefreshToken,
  saveSheet,
  submitEstimate,
  takeRefreshToken,
  verifyPassword,
  type ApiUser,
} from "@/lib/backend/store";
import { openApiDocument } from "@/lib/backend/openapi";
import { signJwt, verifyJwt } from "@/lib/jwt";
import type { ExchangeRateTable, SheetLine } from "@/lib/types";

type Context = { params: Promise<{ path?: string[] }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const claims = verifyJwt(token);
  if (!claims || claims.typ !== "access") return null;
  return findUserById(claims.sub);
}

function issueTokens(user: ApiUser) {
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
  saveRefreshToken(jti, user.id, claims?.exp ?? 0);
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
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(user, password)) {
      return json({ error: "Email or password is incorrect." }, 401);
    }
    return json(issueTokens(user));
  }

  if (method === "POST" && key === "auth/refresh") {
    const body = await readJson(request);
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const claims = verifyJwt(refreshToken);
    if (!claims || claims.typ !== "refresh" || !claims.jti) return json({ error: "Refresh token is invalid." }, 401);
    const stored = takeRefreshToken(claims.jti);
    const user = stored ? findUserById(stored.userId) : null;
    if (!stored || stored.userId !== claims.sub || !user) return json({ error: "Refresh token is invalid." }, 401);
    return json(issueTokens(user));
  }

  const user = bearer(request);
  if (!user) return json({ error: "Sign in with a bearer access token." }, 401);

  if (method === "POST" && key === "auth/logout") {
    const body = await readJson(request);
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const claims = verifyJwt(refreshToken);
    if (claims?.jti) dropRefreshToken(claims.jti);
    return new NextResponse(null, { status: 204 });
  }

  if (method === "GET" && key === "auth/me") return json({ user: publicUser(user) });
  if (method === "GET" && key === "estimates") return json({ estimates: listEstimates() });
  if (method === "GET" && key === "approvals") {
    return json({
      estimates: listEstimates().filter((estimate) => estimate.reviewStage === "in_review" || estimate.reviewStage === "approved"),
    });
  }
  if (method === "GET" && key === "audit") {
    const estimateId = new URL(request.url).searchParams.get("estimateId") ?? undefined;
    return json({ events: listAudit(estimateId) });
  }
  if (method === "GET" && key === "exchange-rates") return json({ rates: getRates() });
  if (method === "GET" && key === "clients") return json({ clients: listClients() });
  if (method === "GET" && key === "reports") return json({ reports: listReports() });
  if (method === "GET" && key === "dashboard") return json(dashboard());

  if (method === "POST" && key === "estimates") {
    const body = await readJson(request);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
    if (!title) return json({ error: "Enter the RFQ title.", field: "title" }, 400);
    if (!clientName) return json({ error: "Enter the client name.", field: "clientName" }, 400);
    const description = typeof body?.description === "string" ? body.description : "";
    return json({ estimate: createEstimate({ title, clientName, description }, user) }, 201);
  }

  if (method === "PUT" && key === "exchange-rates") {
    const body = (await readJson(request)) as Partial<ExchangeRateTable> | null;
    return json({ rates: saveRates(body ?? {}) });
  }

  const estimateMatch = key.match(/^estimates\/([^/]+)$/);
  if (method === "GET" && estimateMatch) {
    const estimate = getEstimate(estimateMatch[1]);
    if (!estimate) return json({ error: "Estimate not found." }, 404);
    return json({ estimate });
  }

  const sheetMatch = key.match(/^estimates\/([^/]+)\/sheet$/);
  if (sheetMatch && method === "GET") {
    const sheet = getSheetView(sheetMatch[1]);
    if (!sheet) return json({ error: "Estimate not found." }, 404);
    return json(sheet);
  }
  if (sheetMatch && method === "PUT") {
    const body = await readJson(request);
    if (!Array.isArray(body?.lines)) return json({ error: "Send the sheet lines." }, 400);
    const result = saveSheet(sheetMatch[1], body.lines as Partial<SheetLine>[], user);
    if ("error" in result) return json({ error: result.error }, result.status);
    return json(result.sheet);
  }

  const submitMatch = key.match(/^estimates\/([^/]+)\/submit$/);
  if (method === "POST" && submitMatch) {
    const result = submitEstimate(submitMatch[1], user);
    if ("error" in result) return json({ error: result.error }, result.status);
    return json(result.sheet);
  }

  const decisionMatch = key.match(/^estimates\/([^/]+)\/decision$/);
  if (method === "POST" && decisionMatch) {
    const body = await readJson(request);
    const decision = body?.decision === "approved" || body?.decision === "returned" ? body.decision : null;
    if (!decision) return json({ error: "Decision must be approved or returned." }, 400);
    const result = decideEstimate(decisionMatch[1], decision, user);
    if ("error" in result) return json({ error: result.error }, result.status);
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
