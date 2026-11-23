"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextField } from "@/components/ui/text-field";
import { validateLogin } from "@/lib/validators";

type Field = "email" | "password";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const result = validateLogin({ email, password });
    if ("error" in result) {
      setErrors(
        result.field === "email"
          ? { email: result.error }
          : { password: result.error },
      );
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: result.email, password: result.password, remember }),
      });
      const payload = (await response.json()) as { error?: string; field?: Field };

      if (!response.ok) {
        if (payload.field) setErrors({ [payload.field]: payload.error });
        else setFormError(payload.error ?? "Unable to sign in.");
        setPending(false);
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      setPending(false);
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch {
      setFormError("Unable to sign in. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="text-welcome">Welcome back</h1>
      <p className="text-subtitle">Sign in to continue to your workspace</p>
      <div className="form-fields">
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />
      </div>
      <div className="form-row">
        <Checkbox label="Remember me" checked={remember} onChange={setRemember} name="remember" />
        <Link href="/forgot-password" className="text-link">
          Forgot password?
        </Link>
      </div>
      {formError ? <p className="text-error">{formError}</p> : null}
      <Button type="submit" variant="primary" size="xl" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
      <p className="text-footer-note">
        New here? <Link href="/signup" className="text-link">Create an organization</Link>
      </p>
      <p className="text-footer-note">
        For authorised company users only · Secure, role-based
        <br />
        access
      </p>
    </form>
  );
}
