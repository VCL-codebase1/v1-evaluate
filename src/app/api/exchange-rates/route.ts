import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { getExchangeRates, saveExchangeRates } from "@/lib/db";
import type { ExchangeRateTable } from "@/lib/types";
import { canManageExchangeRates } from "@/lib/auth/roles";
import { log } from "@/lib/observability/logger";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  return NextResponse.json({ rates: await getExchangeRates(auth.session.organizationId) });
}

export async function PUT(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  if (!canManageExchangeRates(auth.session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { rates?: Partial<ExchangeRateTable> } | null;
  if (!body?.rates || typeof body.rates !== "object") {
    return NextResponse.json({ error: "Enter exchange rates for USD, EUR, and GBP." }, { status: 400 });
  }
  let rates: ExchangeRateTable;
  try {
    rates = await saveExchangeRates(auth.session.organizationId, body.rates);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save exchange rates." },
      { status: 400 },
    );
  }
  log.info("exchange_rates.updated", { by: auth.session.email, role: auth.session.role, organizationId: auth.session.organizationId });
  return NextResponse.json({ rates });
}
