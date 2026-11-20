import type { ReactNode } from "react";

export function ModulePage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="surface-card module-card">
      <h1 className="text-page-title">{title}</h1>
      <p className="text-page-copy">{description}</p>
      {children}
    </section>
  );
}
