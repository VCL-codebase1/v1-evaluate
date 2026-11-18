import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Exchange rates" };

export default function ExchangeRatesPage() {
  return (
    <ModulePage
      title="Exchange rates"
      description="NGN, USD, EUR, and GBP rates used on estimates will be managed here."
    />
  );
}
