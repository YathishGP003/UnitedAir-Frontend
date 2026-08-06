import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AlertIcon, CheckIcon, ShieldIcon } from "../components/Icons";
import type { EscalationCase } from "../types";

type Filter = "OPEN" | "ALL";

/** FR-015 and FR-030 — the queue staff work, and the reason each case landed there. */
export default function EscalationQueue() {
  const [cases, setCases] = useState<EscalationCase[]>([]);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setCases(await api.escalations());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the queue.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = filter === "OPEN" ? cases.filter((c) => c.status === "OPEN") : cases;
  const openCount = cases.filter((c) => c.status === "OPEN").length;
  const dgcaCount = cases.filter(
    (c) => c.status === "OPEN" && c.targetQueue === "DGCA_GRIEVANCE_OFFICER",
  ).length;
  const urgentCount = cases.filter((c) => c.status === "OPEN" && c.priority === "URGENT").length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Escalation queue</h1>
          <p>Cases the assistant referred to a human, and why.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost" onClick={() => void load()} disabled={busy}>
            {busy ? <span className="spinner" /> : null} Refresh
          </button>
        </div>
      </div>

      <div className="grid-cards" style={{ marginBottom: 22 }}>
        <Stat label="Open cases" value={String(openCount)} />
        <Stat label="DGCA grievance" value={String(dgcaCount)} tone={dgcaCount ? "warn" : undefined} />
        <Stat label="Urgent" value={String(urgentCount)} tone={urgentCount ? "danger" : undefined} />
        <Stat label="Total recorded" value={String(cases.length)} />
      </div>

      <div className="seg-control">
        <button className={filter === "OPEN" ? "on" : ""} onClick={() => setFilter("OPEN")}>
          Open ({openCount})
        </button>
        <button className={filter === "ALL" ? "on" : ""} onClick={() => setFilter("ALL")}>
          All ({cases.length})
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {shown.length === 0 && !busy && (
        <div className="panel-empty">
          <ShieldIcon size={24} />
          <p style={{ marginTop: 10 }}>
            {filter === "OPEN" ? "Nothing waiting. The queue is clear." : "No escalations recorded."}
          </p>
        </div>
      )}

      {shown.map((item) => (
        <article key={item.caseUuid} className={`case-card priority-${item.priority.toLowerCase()}`}>
          <header className="case-head">
            <div>
              <span className="case-ref mono">ESC-{item.caseUuid.slice(0, 8).toUpperCase()}</span>
              <h3>{item.reason.replaceAll("_", " ").toLowerCase()}</h3>
            </div>
            <div className="case-chips">
              <span
                className={`chip ${
                  item.targetQueue === "DGCA_GRIEVANCE_OFFICER" ? "chip-warn" : "chip-info"
                }`}
              >
                {item.targetQueue === "DGCA_GRIEVANCE_OFFICER"
                  ? "DGCA Grievance Officer"
                  : "Customer Support Manager"}
              </span>
              <span className={`chip ${priorityClass(item.priority)}`}>
                {item.priority.toLowerCase()}
              </span>
              <span className={`chip ${item.status === "OPEN" ? "chip-warn" : "chip-ok"}`}>
                {item.status.toLowerCase()}
              </span>
            </div>
          </header>

          <p className="case-summary">{item.summaryRedacted}</p>

          <footer className="case-foot">
            <span className="muted">
              {item.raisedBySystem ? "Raised automatically" : "Requested by the user"}
              {item.confidence != null
                && ` · evidence match ${(item.confidence * 100).toFixed(0)}%`}
              {item.failedGates && ` · failed ${item.failedGates}`}
              {" · "}
              {new Date(item.createdAt).toLocaleString()}
            </span>
            {item.status === "OPEN" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await api.resolveEscalation(item.caseUuid, "Resolved by airline staff.");
                  void load();
                }}
              >
                <CheckIcon size={13} /> Mark resolved
              </button>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}

function priorityClass(priority: string): string {
  if (priority === "URGENT") return "chip-danger";
  if (priority === "HIGH") return "chip-warn";
  return "chip-muted";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${tone ? `tone-${tone}` : ""}`}>{value}</div>
    </div>
  );
}
