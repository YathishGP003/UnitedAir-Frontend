import { ActivityIcon, AlertIcon, CheckIcon, ToolIcon } from "../components/Icons";
import type { ChatMessage, ChatResponse } from "../types";

/**
 * How the last answer was produced: the pipeline stages, each tool call and its
 * outcome, and the quality metrics the evaluator used to accept the answer.
 *
 * This is the SRS 4.1.4 traceability requirement made visible. The same data is
 * available over GET /audit/{sessionId} for anyone auditing after the fact.
 */
export default function TracePanel({ message }: { message?: ChatMessage }) {
  if (!message) {
    return (
      <div className="panel-empty">
        <ActivityIcon size={22} />
        <p style={{ marginTop: 10 }}>
          The pipeline trace for each answer appears here: routing, tool calls, retrieval and
          validation.
        </p>
      </div>
    );
  }

  const response = message.response;
  const showConfidence = response?.status === "GROUNDED"
    && (response.generationSource === "HOSTED_MODEL"
      || response.generationSource === "GROUNDED_EXTRACTIVE"
      || response.citations.some((citation) => !citation.toolName));

  return (
    <>
      {response && (
        <div className="metrics">
          <Metric
            label="Confidence"
            value={showConfidence && response.confidence != null
              ? `Evidence match ${(response.confidence * 100).toFixed(0)}%`
              : "—"}
          />
          <Metric
            label="Citation cover"
            value={
              response.citationCoverage != null
                ? `${(response.citationCoverage * 100).toFixed(0)}%`
                : "—"
            }
          />
          <Metric label="Route" value={friendlyIntent(response.intent)} />
          <Metric label="Lane" value={response.lane} />
        </div>
      )}

      {response && (
        <div className="card" style={{ padding: "12px 14px", marginBottom: 14 }}>
          <div className="metric-label" style={{ marginBottom: 8 }}>
            Identifiers
          </div>
          <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
            <Row label="Trace" value={response.traceId} />
            <Row label="Session" value={response.sessionId} />
            <Row
              label="Answer engine"
              value={friendlyGenerationSource(response.generationSource)}
            />
            {response.degradedReason && (
              <Row label="Degraded reason" value={response.degradedReason.replaceAll("_", " ")} />
            )}
          </div>
        </div>
      )}

      {(message.toolCalls?.length ?? 0) > 0 && (
        <>
          <div className="rail-label" style={{ padding: "4px 0 8px" }}>
            Tool calls
          </div>
          {message.toolCalls?.map((call, index) => (
            <div key={`${call.toolName}-${index}`} className="trace-item">
              <span className={`trace-icon ${call.success ? "ok" : "err"}`}>
                {call.success ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
              </span>
              <div className="trace-body">
                <strong>{call.toolName}</strong>
                <p>{call.success ? call.summary || "Completed." : call.error}</p>
                {call.durationMs > 0 && (
                  <p className="mono" style={{ color: "var(--text-faint)" }}>
                    {call.durationMs} ms
                  </p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {(message.stages?.length ?? 0) > 0 && (
        <>
          <div className="rail-label" style={{ padding: "14px 0 8px" }}>
            Pipeline
          </div>
          {message.stages?.map((stage, index) => (
            <div key={`${stage.type}-${index}`} className="trace-item">
              <span className="trace-icon">
                <ToolIcon size={12} />
              </span>
              <div className="trace-body">
                <strong>{stage.label}</strong>
                {stage.detail && <p>{stage.detail}</p>}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
      <span className="muted">{label}</span>
      <span className="mono" style={{ color: "var(--text-soft)" }}>
        {value.length > 20 ? `${value.slice(0, 18)}…` : value}
      </span>
    </div>
  );
}

function friendlyIntent(intent: string): string {
  switch (intent) {
    case "KB_LOOKUP":
      return "Policy";
    case "TOOL_CALL":
      return "Live data";
    case "TOOL_PLUS_KB":
      return "Live + policy";
    case "ESCALATION":
      return "Escalated";
    default:
      return intent;
  }
}

function friendlyGenerationSource(source: ChatResponse["generationSource"]): string {
  switch (source) {
    case "HOSTED_MODEL": return "hosted AI";
    case "GROUNDED_EXTRACTIVE": return "grounded local composition";
    case "STRUCTURED_TOOL": return "verified provider result";
    case "DETERMINISTIC_CONVERSATION": return "deterministic conversation";
    default: return "not recorded";
  }
}
