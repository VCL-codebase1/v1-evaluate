import { SignOutButton } from "@/components/layout/sign-out-button";

export function Topbar({
  role,
  name,
  estimateId,
  version,
  organizationName,
}: {
  role: string;
  name?: string;
  estimateId?: string;
  version: string;
  organizationName?: string;
}) {
  const manager = role === "Line Manager";
  return (
    <header className="topbar">
      <div className="workspace-identity">
        <strong>{organizationName || role}</strong>
        {name && <span>{name}</span>}
        {!manager && estimateId && <span>{estimateId} · {version}</span>}
      </div>
      <SignOutButton />
    </header>
  );
}

export function TopbarFallback() {
  return (
    <Topbar role="Loading account…" version="v1" />
  );
}
