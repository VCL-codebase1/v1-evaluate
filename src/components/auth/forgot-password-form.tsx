"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid work email.");
      setSent(false);
      return;
    }

    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!response.ok) {
        setError("Unable to send a reset link right now.");
        setPending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Unable to send a reset link. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="text-welcome">Reset password</h1>
      <p className="text-subtitle">Enter your work email and we&apos;ll send a reset link</p>
      <div className="form-fields">
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          error={error}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {sent ? (
        <p className="form-success">If this email is registered, a reset link is on its way.</p>
      ) : null}
      <Button type="submit" variant="primary" size="xl" disabled={pending}>
        {pending ? "Sending" : "Send reset link"}
      </Button>
      <p className="text-footer-note">
        <Link href="/login" className="text-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
