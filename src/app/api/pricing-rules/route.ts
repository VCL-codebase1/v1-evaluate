import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { canManageExchangeRates } from "@/lib/auth/roles";
import { getPricingRules, savePricingRules, type PricingRules } from "@/lib/db/commercial";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  try {
    return NextResponse.json({
      rules: await getPricingRules(auth.session.organizationId),
      canEdit: canManageExchangeRates(auth.session.role),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load pricing rules." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  if (!canManageExchangeRates(auth.session.role)) {
    return NextResponse.json({ error: "You do not have access to this action." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { rules?: Partial<PricingRules> } | null;
  if (!body?.rules) return NextResponse.json({ error: "Enter the pricing rules." }, { status: 400 });
  const current = await getPricingRules(auth.session.organizationId);
  const next = { ...current };
  (Object.keys(current) as (keyof PricingRules)[]).forEach((key) => {
    const value = body.rules?.[key];
    if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
  });
  try {
    return NextResponse.json({ rules: await savePricingRules(auth.session.organizationId, next) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save pricing rules." }, { status: 500 });
  }
}
