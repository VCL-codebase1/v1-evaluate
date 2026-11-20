import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="auth-form"><p>Loading…</p></div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
