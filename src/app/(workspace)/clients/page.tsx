import type { Metadata } from "next";
import { DirectoryPanel } from "@/components/commercial/directory-panel";

export const metadata: Metadata = { title: "Clients and suppliers" };

export default function ClientsPage() {
  return <DirectoryPanel />;
}
