import { Topbar, TopbarFallback } from "@/components/layout/topbar";
import { getSession } from "@/lib/session";

export async function SessionTopbar() {
  const session = await getSession();
  if (!session) return <TopbarFallback />;

  return (
    <Topbar
      role={session.role}
      name={session.name}
      estimateId={session.estimateId}
      version={session.version}
      organizationName={session.organizationName}
    />
  );
}
