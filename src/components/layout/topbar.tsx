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
      <p className="text-signed-in">
        Signed in as <strong>{role}</strong> · {estimateId} · {version}
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
