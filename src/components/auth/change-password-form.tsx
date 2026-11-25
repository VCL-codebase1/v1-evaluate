"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to update your password. Please try again.");
        return;
      }
      window.location.replace("/dashboard");
    } catch {
      setError("Unable to update your password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="text-welcome">Change Super Admin password</h1>
      <p className="text-subtitle">Update the password for your own account.</p>
      <div className="form-fields">
        <TextField label="New password" name="password" type="password" autoComplete="new-password"
          value={password} onChange={(event) => setPassword(event.target.value)} />
        <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password"
          value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </div>
      {error ? <p className="text-error" role="alert">{error}</p> : null}
      <Button type="submit" variant="primary" size="xl" disabled={pending}>
        {pending ? "Saving password" : "Save password"}
      </Button>
    </form>
  );
}
