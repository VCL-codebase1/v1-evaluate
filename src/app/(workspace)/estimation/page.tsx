import type { Metadata } from "next";
import { ModulePage } from "@/components/dashboard/module-page";

export const metadata: Metadata = { title: "Estimation sheet" };

export default function EstimationPage() {
  return (
    <ModulePage
      title="Estimation sheet"
      description="Local, air, and sea cost lines will be calculated here once the sheet design lands."
    />
  );
}
