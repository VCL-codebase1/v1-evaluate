import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { getExchangeRates, saveExchangeRates } from "@/lib/db";
import type { ExchangeRateTable } from "@/lib/types";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  return NextResponse.json({ rates: await getExchangeRates() });
}

export async function PUT(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const body = (await request.json().catch(() => null)) as { rates?: Partial<ExchangeRateTable> } | null;
  const rates = await saveExchangeRates(body?.rates ?? {});
  return NextResponse.json({ rates });
}
