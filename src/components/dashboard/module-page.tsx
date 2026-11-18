export function ModulePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="surface-card module-card">
      <h1 className="text-page-title">{title}</h1>
      <p className="text-page-copy">{description}</p>
    </section>
  );
}
