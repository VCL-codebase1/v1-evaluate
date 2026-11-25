import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Change Super Admin password" };

async function ChangePasswordAccess() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Super Admin") redirect("/dashboard");
  return <ChangePasswordForm />;
}

export default function ChangePasswordPage() {
  return <AuthShell><Suspense fallback={<div className="auth-form" aria-busy="true" />}><ChangePasswordAccess /></Suspense></AuthShell>;
}
