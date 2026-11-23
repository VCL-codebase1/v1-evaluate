import type { Metadata } from "next";
import { PricingRulesPanel } from "@/components/commercial/pricing-rules-panel";

export const metadata: Metadata = { title: "Pricing rules" };

export default function PricingRulesPage() {
  return <PricingRulesPanel />;
}
