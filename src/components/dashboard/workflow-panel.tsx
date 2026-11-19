export function WorkflowPanel({
  steps,
  progress,
  title = "Estimate workflow · all roles",
}: {
  steps: readonly string[];
  progress: number;
  title?: string;
}) {
  return (
    <section className="surface-card" aria-labelledby="workflow-title">
      <h2 id="workflow-title" className="text-section">
        {title}
      </h2>
      <div className="progress" aria-hidden>
        <span className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="workflow-steps">
        {steps.map((step) => (
          <span key={step} className="step-pill">
            {step}
          </span>
        ))}
      </div>
    </section>
  );
}
