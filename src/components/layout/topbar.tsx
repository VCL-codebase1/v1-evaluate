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
      <p className="session-pill">
        <span>Signed in as</span>
        <strong>{name || role}</strong>
        {organizationName ? (
          <>
            <span aria-hidden>·</span>
            <strong>{organizationName}</strong>
          </>
        ) : null}
        <span aria-hidden>·</span>
        {manager || !estimateId ? null : <strong>{estimateId}</strong>}
        {manager || !estimateId ? null : (
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
    <Topbar role="Loading account…" version="v1" />
  );
}
