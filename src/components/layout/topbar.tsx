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
  estimateId: string;
  version: string;
  organizationName?: string;
}) {
  const manager = role === "Line Manager";
  return (
    <header className="topbar">
      <p className="session-pill">
        <span>Signed in as</span>
        <strong>{manager ? name || "Manager 1" : role}</strong>
        {organizationName ? (
          <>
            <span aria-hidden>·</span>
            <strong>{organizationName}</strong>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <strong>{manager ? role : estimateId}</strong>
        {manager ? null : (
          <>
            <span aria-hidden>·</span>
            <strong>{version}</strong>
          </>
        )}
      </p>
      <SignOutButton />
    </header>
  );
}

export function TopbarFallback() {
  return (
    <Topbar role="Representative" estimateId="EST-2026-001" version="v1" />
  );
}
