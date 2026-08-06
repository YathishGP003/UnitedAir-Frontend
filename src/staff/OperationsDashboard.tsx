import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityIcon, AlertIcon, PlaneIcon, ShieldIcon } from "../components/Icons";
import type { OperationsSummary } from "../types";

const formatInr = (value: number) =>
  `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;

export default function OperationsDashboard() {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.operationsSummary().then(setSummary).catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Operations summary is unavailable."));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Operations brief</h1>
          <p>The next 72 hours, open human handoffs, and published booking-class rules.</p>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertIcon size={15} />{error}</div>}
      <div className="grid-cards operations-stats">
        <Stat icon={<PlaneIcon size={17} />} label="Departures" value={summary?.departures ?? "—"} />
        <Stat icon={<ActivityIcon size={17} />} label="Delayed" value={summary?.delayed ?? "—"} tone="warn" />
        <Stat icon={<AlertIcon size={17} />} label="Cancelled" value={summary?.cancelled ?? "—"} tone="danger" />
        <Stat
          icon={<ShieldIcon size={17} />}
          label="Open escalations"
          value={summary?.openEscalations.reduce((total, item) => total + item.count, 0) ?? "—"}
        />
      </div>

      <section className="card ops-section">
        <div className="page-head compact">
          <div>
            <span className="metric-label">FR-016 / FR-018</span>
            <h2>Fare rules browser</h2>
            <p>Published booking classes; fee application still depends on timing and disruption rules.</p>
          </div>
          <span className="chip chip-info">KB-AIR-004 · KB-AIR-005</span>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Class</th><th>Brand</th><th>Cabin</th><th>Change</th><th>Refund</th><th>FFP</th></tr></thead>
            <tbody>
              {(summary?.fareRules ?? []).map((fare) => (
                <tr key={fare.code}>
                  <td><strong className="fare-code">{fare.code}</strong></td>
                  <td>{fare.brand}</td><td>{fare.cabin.replaceAll("_", " ").toLowerCase()}</td>
                  <td>{fare.changeable
                    ? (fare.changeFee > 0 ? formatInr(fare.changeFee) : "No base fee")
                    : "Not changeable"}</td>
                  <td>{fare.refundable
                    ? (fare.cancelFee > 0 ? `Refundable · base fee ${formatInr(fare.cancelFee)}` : "Refundable")
                    : "Non-refundable"}</td>
                  <td>{fare.ffpAccrualPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {summary && (
        <section className="card ops-section">
          <span className="metric-label">Queue distribution</span>
          <h2>Human handoffs</h2>
          {summary.openEscalations.length === 0 ? (
            <p className="muted">No open escalations.</p>
          ) : summary.openEscalations.map((item) => (
            <div className="queue-row" key={item.queue}>
              <span>{item.queue.replaceAll("_", " ").toLowerCase()}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "warn" | "danger";
}) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ""}`}>
      <span className="stat-icon">{icon}</span>
      <div><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>
    </div>
  );
}
