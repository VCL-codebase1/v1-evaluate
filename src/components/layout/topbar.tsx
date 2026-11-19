import { SignOutButton } from "@/components/layout/sign-out-button";

export function Topbar({
  role,
  estimateId,
  version,
}: {
  role: string;
  estimateId: string;
  version: string;
}) {
  return (
    <header className="topbar">
      <p className="session-pill">
        <span>Signed in as</span>
        <strong>{role}</strong>
        <span aria-hidden>·</span>
        <strong>{estimateId}</strong>
        <span aria-hidden>·</span>
        <strong>{version}</strong>
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
