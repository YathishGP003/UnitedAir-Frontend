import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AlertIcon, LayersIcon, SearchIcon } from "../components/Icons";
import type {
  AuditTurn,
  OperationalDecisionType,
  OperationalDecisionView,
  SessionTrail,
  SessionView,
} from "../types";

/**
 * FR-030 — query the audit trail.
 *
 * <p>Shows, for any conversation, what was asked, what was retrieved and with what scores,
 * which tools ran, which validation gates the answer passed, and whether it was escalated.
 * This is the screen that makes "why did the assistant say that?" answerable.
 */
export default function AuditExplorer() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [trail, setTrail] = useState<SessionTrail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<OperationalDecisionType | "">("");
  const [decisionOutcome, setDecisionOutcome] = useState("");
  const [decisionPnr, setDecisionPnr] = useState("");
  const [decisions, setDecisions] = useState<OperationalDecisionView[]>([]);
  const [decisionBusy, setDecisionBusy] = useState(false);

  useEffect(() => {
    api.listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  async function load(id: string) {
    const clean = id.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      setTrail(await api.auditTrail(clean));
    } catch (e) {
      setTrail(null);
      setError(e instanceof Error ? e.message : "Could not load that trail.");
    } finally {
      setBusy(false);
    }
  }

  async function searchDecisions() {
    setDecisionBusy(true);
    setError(null);
    try {
      setDecisions(await api.operationalDecisions({
        types: decisionType ? [decisionType] : undefined,
        outcome: decisionOutcome || undefined,
        pnr: decisionPnr.trim() || undefined,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not search decisions.");
    } finally {
      setDecisionBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit trail</h1>
          <p>Every question, the evidence behind its answer, and the checks it passed.</p>
        </div>
      </div>

      <section className="card ops-section" aria-label="Operational decisions">
        <div className="page-head">
          <div>
            <h2>Operational decisions</h2>
            <p>Search normalized approvals and overrides without exposing raw booking references.</p>
          </div>
        </div>
        <div className="search-bar">
          <div className="field">
            <label className="label" htmlFor="decision-type">Type</label>
            <select id="decision-type" className="input" value={decisionType}
              onChange={(event) => setDecisionType(event.target.value as OperationalDecisionType | "")}>
              <option value="">All types</option>
              <option value="REFUND_APPROVAL">Refund approval</option>
              <option value="UPGRADE_AUTHORIZATION">Upgrade / seat authorization</option>
              <option value="BOARDING_OVERRIDE">Boarding override</option>
              <option value="SPECIAL_SERVICE_EXCEPTION">Special-service exception</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="decision-outcome">Outcome</label>
            <select id="decision-outcome" className="input" value={decisionOutcome}
              onChange={(event) => setDecisionOutcome(event.target.value)}>
              <option value="">All outcomes</option>
              <option value="PROPOSED">Proposed</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="decision-pnr">PNR filter</label>
            <input id="decision-pnr" className="input mono" value={decisionPnr}
              onChange={(event) => setDecisionPnr(event.target.value.toUpperCase())}
              placeholder="optional exact PNR" />
          </div>
          <button className="btn btn-primary search-go" disabled={decisionBusy}
            onClick={() => void searchDecisions()}>
            {decisionBusy ? <span className="spinner" /> : <SearchIcon size={15} />} Search decisions
          </button>
        </div>
        {decisions.length > 0 && (
          <div className="table-scroll" role="region" aria-label="Operational decision results" tabIndex={0}>
            <table className="data">
              <thead><tr><th>Type</th><th>Outcome</th><th>Actor</th><th>Policy</th><th>Created</th></tr></thead>
              <tbody>{decisions.map((decision) => (
                <tr key={decision.decisionUuid}>
                  <td>{decision.decisionType.replaceAll("_", " ").toLowerCase()}</td>
                  <td><span className="chip chip-muted">{decision.outcome.toLowerCase()}</span></td>
                  <td>{decision.actorRole.replaceAll("_", " ").toLowerCase()}</td>
                  <td>{decision.sourcePolicyCode ?? "No policy reference"}</td>
                  <td>{new Date(decision.createdAt).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="search-bar">
        <div className="field" style={{ flex: 1 }}>
          <label className="label" htmlFor="audit-session-id">Session identifier</label>
          <input
            id="audit-session-id"
            className="input mono"
            placeholder="paste a session UUID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load(sessionId)}
          />
        </div>
        <button className="btn btn-primary search-go" onClick={() => void load(sessionId)} disabled={busy}>
          {busy ? <span className="spinner" /> : <SearchIcon size={15} />} Open
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="demo-pnrs">
          <span className="muted">Your recent conversations:</span>
          {sessions.slice(0, 6).map((s) => (
            <button
              key={s.sessionUuid}
              className="chip chip-muted pnr-chip"
              onClick={() => {
                setSessionId(s.sessionUuid);
                void load(s.sessionUuid);
              }}
            >
              {s.sessionUuid.slice(0, 8)} · {s.messageCount} msg
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {!trail && !error && (
        <div className="panel-empty">
          <LayersIcon size={24} />
          <p style={{ marginTop: 10 }}>
            Choose a conversation to reconstruct exactly how each answer was produced.
          </p>
        </div>
      )}

      {trail && (
        <>
          <div className="grid-cards" style={{ marginBottom: 20 }}>
            <Stat label="Actor" value={trail.actorRole.replaceAll("_", " ").toLowerCase()} />
            <Stat label="Turns" value={String(trail.turns.length)} />
            <Stat
              label="Escalated"
              value={String(trail.turns.filter((t) => t.escalated).length)}
            />
            <Stat label="Escalation cases" value={String(trail.escalations?.length ?? 0)} />
          </div>

          {trail.turns.map((turn, index) => (
            <TurnCard key={turn.traceId + index} turn={turn} index={index + 1} />
          ))}
        </>
      )}
    </div>
  );
}

function TurnCard({ turn, index }: { turn: AuditTurn; index: number }) {
  const [open, setOpen] = useState(index === 1);

  return (
    <article className="turn-card">
      <button className="turn-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="turn-index">{index}</span>
        <span className="turn-query">{turn.queryRedacted ?? "(no query recorded)"}</span>
        <span className="turn-chips">
          <span className={`chip ${statusClass(turn.status)}`}>{turn.status.toLowerCase()}</span>
          {turn.status === "GROUNDED" && turn.evidence.length > 0 && turn.confidence != null && (
            <span className="chip chip-muted">
              Evidence match {(turn.confidence * 100).toFixed(0)}%
            </span>
          )}
          {turn.repairAttempts > 0 && <span className="chip chip-warn">repaired</span>}
        </span>
      </button>

      {open && (
        <div className="turn-body">
          {turn.queryRewritten && turn.queryRewritten !== turn.queryRedacted && (
            <Section label="Interpreted as">
              <p className="muted">{turn.queryRewritten}</p>
            </Section>
          )}

          <Section label="Answer">
            <p className="turn-answer">{turn.answerRedacted}</p>
          </Section>

          {turn.evidence.length > 0 && (
            <Section label={`Evidence (${turn.evidence.length})`}>
              <div className="table-scroll" role="region"
                aria-label={`Retrieved evidence for turn ${index}`} tabIndex={0}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Document</th>
                      <th>Section</th>
                      <th>Page</th>
                      <th>Vector</th>
                      <th>Lexical</th>
                      <th>Fused</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turn.evidence.map((e) => (
                      <tr key={e.handle}>
                        <td className="mono">{e.handle}</td>
                        <td>
                          <strong>{e.documentCode}</strong>
                        </td>
                        <td>{e.section}</td>
                        <td>{e.page ?? "—"}</td>
                        <td>{fmt(e.vectorScore)}</td>
                        <td>{fmt(e.lexicalScore)}</td>
                        <td>{fmt(e.fusedScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {turn.toolCalls.length > 0 && (
            <Section label={`Tool calls (${turn.toolCalls.length})`}>
              {turn.toolCalls.map((t, i) => (
                <div key={i} className="trace-item">
                  <span className={`trace-icon ${t.status === "SUCCESS" ? "ok" : "err"}`}>
                    {t.status === "SUCCESS" ? "✓" : "!"}
                  </span>
                  <div className="trace-body">
                    <strong>{t.toolName}</strong>
                    <p>
                      {t.dispatchPattern ?? "—"} · {t.durationMs ?? 0} ms
                      {t.errorMessage ? ` · ${t.errorMessage}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {turn.validations.length > 0 && (
            <Section label="Validation">
              {turn.validations.map((v, i) => (
                <div key={i} className="validation-row">
                  <span className={`chip ${v.verdict === "PASSED" ? "chip-ok" : "chip-danger"}`}>
                    attempt {v.attemptNo} · {v.verdict.toLowerCase()}
                  </span>
                  {v.failedGates && <span className="muted">{v.failedGates}</span>}
                  {v.citationCoverage != null && (
                    <span className="muted">
                      coverage {(v.citationCoverage * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </Section>
          )}

          <p className="muted mono" style={{ fontSize: 11 }}>
            trace {turn.traceId} · {turn.intent ?? "—"} · lane {turn.lane ?? "—"}
          </p>
        </div>
      )}
    </article>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="turn-section">
      <div className="metric-label">{label}</div>
      {children}
    </div>
  );
}

function statusClass(status: string): string {
  if (status === "ESCALATED") return "chip-warn";
  if (status === "EMPTY_CONTEXT") return "chip-danger";
  return "chip-ok";
}

function fmt(value: number | null): string {
  return value == null ? "—" : value.toFixed(3);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
