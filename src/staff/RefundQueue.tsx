import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ActivityIcon, AlertIcon, CheckIcon } from "../components/Icons";
import type { RefundCaseView, RefundStatus } from "../types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type ViewFilter = "OPEN" | "ALL";

export default function RefundQueue() {
  const [cases, setCases] = useState<RefundCaseView[]>([]);
  const [filter, setFilter] = useState<ViewFilter>("OPEN");
  const [loading, setLoading] = useState(true);
  const [busyCase, setBusyCase] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await api.staffRefundCases());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Refund cases could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => filter === "ALL"
    ? cases
    : cases.filter((item) => item.status !== "COMPLETED"), [cases, filter]);

  async function transition(item: RefundCaseView, status: RefundStatus) {
    const note = notes[item.caseUuid]?.trim() ?? "";
    if ((status === "CONTACT_NEEDED" || status === "FAILED") && !note) {
      setError("Add a note before marking a refund as needing contact or failed.");
      return;
    }
    setBusyCase(item.caseUuid);
    setError(null);
    try {
      await api.transitionRefund(item.caseUuid, status, note);
      setNotes((current) => ({ ...current, [item.caseUuid]: "" }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The refund status could not be updated.");
    } finally {
      setBusyCase(null);
    }
  }

  const openCount = cases.filter((item) => item.status !== "COMPLETED").length;
  const dueSoon = cases.filter((item) =>
    item.status !== "COMPLETED"
    && new Date(item.dueAt).getTime() < Date.now() + 2 * 86_400_000).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="metric-label">Passenger servicing</span>
          <h1>Refund cases</h1>
          <p>Track every confirmed cancellation from quote to simulated settlement.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
          <ActivityIcon size={14} /> Refresh
        </button>
      </div>

      <div className="grid-cards refund-stats">
        <Stat label="Open cases" value={openCount} />
        <Stat label="Due within 48 hours" value={dueSoon} tone={dueSoon ? "warn" : undefined} />
        <Stat label="Completed" value={cases.filter((item) => item.status === "COMPLETED").length} />
      </div>

      <div className="seg-control refund-filter" aria-label="Refund case filter">
        <button className={filter === "OPEN" ? "on" : ""} onClick={() => setFilter("OPEN")}>
          Open ({openCount})
        </button>
        <button className={filter === "ALL" ? "on" : ""} onClick={() => setFilter("ALL")}>
          All ({cases.length})
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertIcon size={15} /><span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {loading && <div className="panel-empty"><span className="spinner" /> Loading refund cases…</div>}
      {!loading && shown.length === 0 && (
        <div className="panel-empty">
          <CheckIcon size={22} />
          <p>No refund cases match this view.</p>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="table-scroll refund-table-scroll" role="region"
          aria-label="Refund cases table" tabIndex={0}>
          <table className="data refund-table">
            <thead>
              <tr>
                <th>Case</th><th>Passenger and journey</th><th>Refund</th>
                <th>Payment</th><th>Due</th><th>Status and action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.caseUuid}>
                  <td>
                    <strong className="mono">RFD-{item.caseUuid.slice(0, 8).toUpperCase()}</strong>
                    <small>{item.pnr}</small>
                  </td>
                  <td>
                    <strong>{item.passengerName}</strong>
                    <span>{item.flightNo} · {item.origin} to {item.destination}</span>
                    <small>{item.flightDate} · {item.fareBrand}</small>
                  </td>
                  <td>
                    <strong>{inr.format(item.refundAmount)}</strong>
                    <small>Paid {inr.format(item.amountPaid)}</small>
                    <small>Fee {inr.format(item.cancellationFee)}</small>
                  </td>
                  <td>
                    <span>{item.paymentMethod ?? "Not recorded"}</span>
                    <small>{item.maskedPayment ?? "Not available"}</small>
                    {item.callbackStatus && <small>Callback: {item.callbackStatus.toLowerCase()}</small>}
                  </td>
                  <td>
                    <span>{new Date(item.dueAt).toLocaleDateString()}</span>
                    <small>Updated {new Date(item.updatedAt).toLocaleString()}</small>
                  </td>
                  <td className="refund-actions-cell">
                    <span className={`chip refund-${item.status.toLowerCase()}`}>
                      {item.status.replaceAll("_", " ").toLowerCase()}
                    </span>
                    {item.status !== "COMPLETED" && (
                      <input
                        className="input refund-note"
                        aria-label={`Staff note for ${item.pnr}`}
                        placeholder="Note for contact or failure"
                        value={notes[item.caseUuid] ?? ""}
                        onChange={(event) => setNotes((current) => ({
                          ...current,
                          [item.caseUuid]: event.target.value,
                        }))}
                      />
                    )}
                    <div className="refund-actions">
                      {(item.status === "PENDING" || item.status === "FAILED"
                        || item.status === "CONTACT_NEEDED") && (
                        <button className="btn btn-primary btn-sm"
                          disabled={busyCase === item.caseUuid}
                          onClick={() => void transition(item, "PROCESSING")}>
                          {item.status === "PENDING" ? "Start processing" : "Resume processing"}
                        </button>
                      )}
                      {item.status === "PROCESSING" && (
                        <button className="btn btn-primary btn-sm"
                          disabled={busyCase === item.caseUuid}
                          onClick={() => void transition(item, "COMPLETED")}>
                          Mark completed
                        </button>
                      )}
                      {(item.status === "PENDING" || item.status === "PROCESSING") && (
                        <button className="btn btn-ghost btn-sm"
                          disabled={busyCase === item.caseUuid}
                          onClick={() => void transition(item, "CONTACT_NEEDED")}>
                          Need contact
                        </button>
                      )}
                      {item.status !== "FAILED" && (
                        <button className="btn btn-ghost btn-sm"
                          disabled={busyCase === item.caseUuid}
                          onClick={() => void transition(item, "FAILED")}>
                          Mark failed
                        </button>
                      )}
                    </div>
                    <details>
                      <summary>History and policy basis</summary>
                      <p>{item.cancellationBasis}</p>
                      <ol className="refund-history">
                        {item.history.map((entry, index) => (
                          <li key={`${entry.changedAt}-${index}`}>
                            <strong>{entry.toStatus.replaceAll("_", " ").toLowerCase()}</strong>
                            <span>{new Date(entry.changedAt).toLocaleString()}</span>
                            {entry.note && <small>{entry.note}</small>}
                            {entry.changedBy && <small>by {entry.changedBy}</small>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
