import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";
import { ExchangeRatesPanel } from "@/components/admin/exchange-rates-panel";

export const metadata: Metadata = { title: "Exchange rates" };

export default function ExchangeRatesPage() {
  return (
    <ModulePage
      title="Exchange rates"
      description="NGN rates for USD, EUR, and GBP. A Sales Director saves the values used on estimates."
    ><ExchangeRatesPanel /></ModulePage>
  );
}
