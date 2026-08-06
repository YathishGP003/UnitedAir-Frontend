import { useState } from "react";
import { api } from "../api/client";
import { AlertIcon } from "../components/Icons";
import type { ActionView } from "../types";

function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function valueText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return String(value);
}

export function ChatActionCard({
  action,
  onSettled,
}: {
  action: ActionView;
  onSettled?: (action: ActionView) => void | Promise<void>;
}) {
  const [current, setCurrent] = useState(action);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  const pending = current.status === "PENDING";
  const warning = current.summary.warning as string | undefined;
  const entries = Object.entries(current.summary).filter(
    ([key]) => key !== "warning" && key !== "action",
  );
  const resultMessage = current.result?.message;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const settled = await api.confirmAction(current.actionUuid);
      setCurrent(settled);
      await onSettled?.(settled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancellation could not be confirmed.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cancelAction(current.actionUuid);
      setHidden(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The proposal could not be dismissed.");
      setBusy(false);
    }
  };

  return (
    <section
      className={`chat-action-card ${pending ? "" : "settled"}`}
      aria-label="Booking cancellation"
    >
      <div className="chat-action-head">
        <span className="chat-action-kicker">
          {pending ? "Confirmation required" : "Cancellation complete"}
        </span>
        <strong>{pending ? "Cancel this booking?" : "Booking cancelled"}</strong>
        {pending && <p>Nothing has changed yet.</p>}
      </div>

      {pending ? (
        <>
          <dl className="chat-action-facts">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt>{humanise(key)}</dt>
                <dd>{valueText(value)}</dd>
              </div>
            ))}
          </dl>
          {warning && (
            <div className="chat-action-warning">
              <AlertIcon size={15} />
              <span>{warning}</span>
            </div>
          )}
          {current.citations && current.citations.length > 0 && (
            <p className="chat-action-source">
              Governed by{" "}
              {current.citations
                .map((citation) => `${citation.documentCode} ${citation.section ?? ""}`.trim())
                .join("; ")}
            </p>
          )}
          {error && <p className="chat-action-error" role="alert">{error}</p>}
          <div className="chat-action-buttons">
            <button className="btn btn-ghost" onClick={() => void dismiss()} disabled={busy}>
              Keep my booking
            </button>
            <button className="btn btn-danger" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Confirming..." : "Confirm cancellation"}
            </button>
          </div>
        </>
      ) : (
        <p className="chat-action-result">
          {String(resultMessage ?? "The cancellation was completed.")}
        </p>
      )}
    </section>
  );
}
