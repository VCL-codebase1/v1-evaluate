"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

type Field = "organizationName" | "name" | "email" | "password";

export function SignupForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const nextErrors: Partial<Record<Field, string>> = {};
    if (!organizationName.trim()) nextErrors.organizationName = "Enter your organization name.";
    if (!name.trim()) nextErrors.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter a valid work email.";
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        field?: Field;
        requiresSignIn?: boolean;
      };
      if (!response.ok) {
        if (payload.field) setErrors({ [payload.field]: payload.error || "Check this field." });
        setFormError(payload.error || "Unable to create your organization account.");
        setPending(false);
        return;
      }
      if (payload.requiresSignIn) {
        setPending(false);
        router.push("/login?next=%2Fdashboard");
        return;
      }
      setPending(false);
      router.push("/dashboard");
    } catch {
      setFormError("Unable to create your organization account. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="text-welcome">Create your organization</h1>
      <p className="text-subtitle">Set up a workspace and become its Super Admin</p>

      <div className="form-fields">
        <TextField
          label="Organization name"
          name="organizationName"
          placeholder="Acme Engineering Ltd"
          value={organizationName}
          error={errors.organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
        />
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Jane Doe"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="jane@acme.com"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {formError ? <p className="text-error" role="alert">{formError}</p> : null}

      <Button type="submit" variant="primary" size="xl" disabled={pending}>
        {pending ? "Creating workspace" : "Create organization"}
      </Button>

      <p className="text-footer-note">
        Already have an account?{" "}
        <Link href="/login" className="text-link">Sign in</Link>
      </p>
    </form>
  );
}
