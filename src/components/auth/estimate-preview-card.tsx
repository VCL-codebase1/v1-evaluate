export function EstimatePreviewCard() {
  return (
    <div className="preview-block">
      <article className="preview-card">
        <div className="card-title-row">
          <h2 className="card-title">EST-2026-001 · Air freight</h2>
          <span className="status-pill">Awaiting Sales Director</span>
        </div>
        <div className="card-stack">
          <div className="card-row">
            <p className="card-muted">Industrial Sensor · base USD 1,000.00</p>
            <p className="card-usd">USD 1,778.50</p>
          </div>
          <div className="card-row">
            <p className="card-muted">At ₦1,500 per USD</p>
            <p className="card-money">₦2,667,750</p>
          </div>
        </div>
        <div className="role-row">
          <span className="chip chip-done">Representative ✓</span>
          <span className="chip chip-done">Line Manager ✓</span>
          <span className="chip chip-current">Sales Director</span>
        </div>
      </article>
      <p className="frozen-pill">Rates frozen on approval</p>
    </div>
  );
}
