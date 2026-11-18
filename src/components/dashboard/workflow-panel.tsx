export function WorkflowPanel({
  steps,
  progress,
}: {
  steps: readonly string[];
  progress: number;
}) {
  return (
    <section className="surface-card" aria-labelledby="workflow-title">
      <h2 id="workflow-title" className="text-section">
        Estimate workflow · all roles
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
