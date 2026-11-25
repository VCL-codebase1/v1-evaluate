"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const ROLES = ["Representative", "Line Manager", "Sales Director", "Admin"] as const; // Super Admin is assigned at organization creation

export function UserAdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "Representative", password: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json()) as { users?: User[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; user?: User };
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setForm({ email: "", name: "", role: "Representative", password: "" });
      const createdUser = data.user;
      if (createdUser) setUsers((current) => [createdUser, ...current]);
      setNotice("User created. Share the sign-in password securely.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setBusy(null);
    }
  }

  async function patchUser(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; user?: User };
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      const updatedUser = data.user;
      if (updatedUser) setUsers((current) => current.map((user) => user.id === id ? updatedUser : user));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(id: string) {
    const pw = window.prompt("Enter a new sign-in password (min 8 chars).");
    if (!pw) return;
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    await patchUser(id, { resetPassword: pw });
  }

  return (
    <div className="page-stack user-admin-page">
      <div className="page-heading">
        <h1 className="text-page-title">User administration</h1>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="sheet-message" role="status">{notice}</p> : null}

      <section className="surface-card panel-card">
        <h2 className="text-section-title">Provision user</h2>
        <form onSubmit={createUser} className="form-fields">
          <TextField label="Email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <TextField label="Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <TextField label="Sign-in password (min 8 chars)" name="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <div>
            <Button type="submit" variant="primary" size="sm" disabled={busy === "create"}>
              {busy === "create" ? "Creating…" : "Create user"}
            </Button>
          </div>
          <p className="text-subtitle">Users sign in with the credentials you create for this organization. Only the Super Admin can reset their passwords.</p>
        </form>
      </section>

      <section className="surface-card panel-card" aria-label="Users">
        <h2 className="text-section-title">Users</h2>
        {loading ? <p>Loading…</p> : users.length === 0 ? <p>No users yet. Create the first organization user above.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.name}</td>
                    <td>
                      {u.role === "Super Admin" ? "Super Admin" : <select value={u.role} disabled={busy === u.id} onChange={(e) => void patchUser(u.id, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>}
                    </td>
                    <td>{u.isActive ? "Active" : "Disabled"}</td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" disabled={busy === u.id || u.role === "Super Admin"} onClick={() => void patchUser(u.id, { isActive: !u.isActive })}>
                          {u.isActive ? "Disable" : "Enable"}
                        </button>
                        <button type="button" disabled={busy === u.id || u.role === "Super Admin"} onClick={() => void resetPassword(u.id)}>
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
