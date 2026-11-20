import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { canManageUsers } from "@/lib/auth/roles";
import { UserAdminPanel } from "@/components/admin/user-admin-panel";

export const metadata: Metadata = { title: "User administration" };

async function AdminUsersGate() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageUsers(session.role)) redirect("/dashboard");
  return <UserAdminPanel />;
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="page-stack"><p>Loading…</p></div>}>
      <AdminUsersGate />
    </Suspense>
  );
}
