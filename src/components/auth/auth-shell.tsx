import type { ReactNode } from "react";
import { AuthShowcase } from "@/components/auth/auth-showcase";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-screen">
      <AuthShowcase />
      <section className="auth-panel">{children}</section>
    </main>
  );
}
