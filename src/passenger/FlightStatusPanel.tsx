import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { ActivityIcon, AlertIcon, SearchIcon } from "../components/Icons";
import type {
  FlightChangeEvent,
  FlightNotificationSubscription,
  FlightStatusView,
} from "../types";

const SUGGESTIONS = ["UA101", "UA102", "UA202", "UA404"];

/** FR-014 — real-time status, delay, gate and terminal. */
export default function FlightStatusPanel() {
  const today = new Date().toISOString().slice(0, 10);

  const [flightNo, setFlightNo] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<FlightStatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [subscription, setSubscription] = useState<FlightNotificationSubscription | null>(null);
  const [changes, setChanges] = useState<FlightChangeEvent[]>([]);
  const [notificationCursor, setNotificationCursor] = useState(new Date().toISOString());

  async function lookup(code: string, on: string) {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setError("Enter a flight number, for example UA101.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.flightStatus(clean, on));
      setLastUpdated(new Date());
    } catch (e) {
      setStatus(null);
      setError(e instanceof ApiError ? e.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoRefresh || !status) return;
    const timer = window.setInterval(() => {
      void lookup(status.flightNo, date);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, status?.flightNo, date]);

  useEffect(() => {
    if (!subscription) return;
    const poll = async () => {
      try {
        const events = await api.flightNotifications(notificationCursor);
        if (events.length > 0) {
          setChanges((current) => {
            const known = new Set(current.map((event) => event.eventUuid));
            return [...current, ...events.filter((event) => !known.has(event.eventUuid))];
          });
          setNotificationCursor(events[events.length - 1].detectedAt);
        }
      } catch {
        // Status lookup remains usable if the polling fallback is temporarily unavailable.
      }
    };
    const timer = window.setInterval(() => void poll(), 15_000);
    void poll();
    return () => window.clearInterval(timer);
  }, [subscription?.subscriptionUuid, notificationCursor]);

  async function toggleNotifications() {
    if (!status) return;
    setError(null);
    try {
      if (subscription) {
        await api.unsubscribeFlightNotifications(subscription.subscriptionUuid);
        setSubscription(null);
      } else {
        setNotificationCursor(new Date().toISOString());
        setSubscription(await api.subscribeFlightNotifications(status.flightNo, status.flightDate));
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Notification preference could not be saved.");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Flight status</h1>
          <p>Live departure status, delays, terminal and gate.</p>
        </div>
      </div>

      <div className="search-bar">
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="status-flight-number">Flight number</label>
          <input
            id="status-flight-number"
            className="input mono"
            placeholder="UA101"
            value={flightNo}
            onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void lookup(flightNo, date)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="status-flight-date">Date</label>
          <input
            id="status-flight-date"
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary search-go"
          onClick={() => void lookup(flightNo, date)}
          disabled={busy}
        >
          {busy ? <span className="spinner" /> : <SearchIcon size={15} />} Check
        </button>
      </div>

      <div className="demo-pnrs">
        <span className="muted">Try:</span>
        {SUGGESTIONS.map((code) => (
          <button
            key={code}
            className="chip chip-muted pnr-chip"
            onClick={() => {
              setFlightNo(code);
              const when = code === "UA102" || code === "UA202"
                ? new Date(Date.now() + (code === "UA102" ? 1 : 2) * 86_400_000)
                    .toISOString()
                    .slice(0, 10)
                : date;
              setDate(when);
              void lookup(code, when);
            }}
          >
            {code}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {!status && !error && (
        <div className="panel-empty">
          <ActivityIcon size={24} />
          <p style={{ marginTop: 10 }}>Enter a flight number to see its live status.</p>
        </div>
      )}

      {status && (
        <article className={`status-card status-${status.status.toLowerCase()}`}>
          <header className="status-head">
            <div>
              <span className="mono status-flightno">{status.flightNo}</span>
              <h2>
                {status.origin} → {status.destination}
              </h2>
              <p className="muted">{status.flightDate}</p>
            </div>
            <div className="status-badge-wrap">{badge(status)}</div>
          </header>

          <div
            className="route-strip"
            role="img"
            aria-label={`Route from ${status.origin} to ${status.destination}. This is an illustrative route, not live aircraft tracking.`}
          >
            <strong>{status.origin}</strong>
            <span className="route-line"><i /></span>
            <strong>{status.destination}</strong>
          </div>

          <div className="status-times">
            <div>
              <span className="metric-label">Scheduled</span>
              <strong>{status.scheduledDeparture.slice(0, 5)}</strong>
            </div>
            <div>
              <span className="metric-label">Estimated</span>
              <strong className={status.delayMinutes > 0 ? "delayed" : ""}>
                {status.estimatedDeparture.slice(0, 5)}
              </strong>
            </div>
            <div>
              <span className="metric-label">Terminal</span>
              <strong>{status.terminal ?? "—"}</strong>
            </div>
            <div>
              <span className="metric-label">Gate</span>
              <strong>{status.gate ?? "—"}</strong>
            </div>
          </div>

          {status.status === "CANCELLED" && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              <AlertIcon size={15} />
              <span>
                This flight is cancelled. Ask the assistant about rebooking options and your
                entitlements.
              </span>
            </div>
          )}
          <footer className="status-refresh">
            <span className="muted">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Not refreshed yet"}
            </span>
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Refresh every 30 seconds
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => void toggleNotifications()}>
              {subscription ? "Stop gate alerts" : "Notify me of gate changes"}
            </button>
          </footer>
        </article>
      )}

      <section className="status-change-feed" aria-live="polite" aria-label="Flight change notifications">
        {subscription && changes.length === 0 && (
          <p className="muted">Gate and terminal alerts are on for {subscription.flightNo}.</p>
        )}
        {changes.map((change) => (
          <article className="alert alert-info" key={change.eventUuid}>
            <ActivityIcon size={15} />
            <span>
              <strong>{change.flightNo} on {change.date}</strong>:{" "}
              {change.previousTerminal !== change.terminal
                ? `terminal ${change.previousTerminal ?? "unassigned"} to ${change.terminal ?? "unassigned"}; `
                : ""}
              {change.previousGate !== change.gate
                ? `gate ${change.previousGate ?? "unassigned"} to ${change.gate ?? "unassigned"}.`
                : ""}
              {" "}Detected {new Date(change.detectedAt).toLocaleTimeString()}.
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}

function badge(status: FlightStatusView) {
  if (status.status === "CANCELLED") return <span className="chip chip-danger">Cancelled</span>;
  if (status.status === "DELAYED") {
    return <span className="chip chip-warn">Delayed {status.delayMinutes} min</span>;
  }
  return <span className="chip chip-ok">On time</span>;
}
