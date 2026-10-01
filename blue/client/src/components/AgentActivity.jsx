export default function AgentActivity({ steps }) {
  if (!steps || steps.length === 0) return null;
  const isRunning = steps[steps.length - 1]?.status === "active";

  return (
    <div className="activity-panel">
      <div className="activity-title">
        {isRunning && <span className="pulse-dot" />}
        Blue is working...
      </div>
      {steps.map((s, i) => (
        <div key={i} className={`activity-step ${s.status}`}>
          <span className="step-icon">
            {s.status === "done" ? "✓" : s.status === "error" ? "✕" : s.status === "active" ? "●" : "○"}
          </span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
