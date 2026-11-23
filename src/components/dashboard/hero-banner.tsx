import { ButtonLink } from "@/components/ui/button";
import { canManageUsers, isRole } from "@/lib/auth/roles";

export function HeroBanner({ role, waiting = 0 }: { role: string; waiting?: number }) {
  const reviewing = role === "Line Manager" && waiting > 0;

  return (
    <header className="dashboard-heading">
      <div>
        <p>{role} workspace</p>
        <h1>Dashboard</h1>
      </div>
      <div className="action-row">
        {isRole(role) && canManageUsers(role) && (
          <ButtonLink href="/admin/users" variant="outline" size="sm">Manage users</ButtonLink>
        )}
        {reviewing && <ButtonLink href="/rfqs/new" variant="outline" size="sm">New RFQ</ButtonLink>}
        <ButtonLink href={reviewing ? "/approval" : "/rfqs/new"} size="sm">
          {reviewing ? `Review quotations (${waiting})` : "New RFQ estimate"}
        </ButtonLink>
      </div>
    </header>
  );
}
