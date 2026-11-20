"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const tokenHash = params.get("token_hash") ?? params.get("token") ?? "";
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase recovery links may place tokens in the URL hash fragment; detect presence for UX.
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery") || hash.includes("access_token=")) {
      window.setTimeout(() => setHasRecoverySession(true), 0);
    }
  }, []);

  const canSubmit = useMemo(
    () => Boolean(code || tokenHash || hasRecoverySession),
    [code, tokenHash, hasRecoverySession],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!canSubmit) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code || undefined, token: tokenHash || undefined, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Reset link is invalid or has expired.");
        setPending(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Unable to reset password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="auth-form">
        <h1 className="text-welcome">Password updated</h1>
        <p className="text-subtitle">You can now sign in with your new password.</p>
        <p className="text-footer-note">
          <Link href="/login" className="text-link">
            Continue to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="text-welcome">Set a new password</h1>
      <p className="text-subtitle">Choose a strong password for your account</p>
      <div className="form-fields">
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error ? <p className="text-error">{error}</p> : null}
      <Button type="submit" variant="primary" size="xl" disabled={pending || !canSubmit}>
        {pending ? "Saving" : "Reset password"}
      </Button>
      {!canSubmit ? (
        <p className="text-error">Reset link is missing or invalid. Request a new reset email.</p>
      ) : null}
      <p className="text-footer-note">
        <Link href="/login" className="text-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
