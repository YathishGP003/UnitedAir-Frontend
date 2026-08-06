import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityIcon, AlertIcon, CheckIcon, ThumbsDownIcon, ThumbsUpIcon } from "../components/Icons";
import type {
  AdminHealth,
  FeedbackStatistics,
  PolicyImpactSummary,
  QualitySummary,
} from "../types";
import KbQualityPanel from "./KbQualityPanel";

export default function QualityPanel() {
  const [feedback, setFeedback] = useState<FeedbackStatistics | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [quality, setQuality] = useState<QualitySummary | null>(null);
  const [impact, setImpact] = useState<PolicyImpactSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.feedbackStatistics(),
      api.adminHealth(),
      api.qualitySummary(),
      api.policyImpact(),
    ])
      .then(([nextFeedback, nextHealth, nextQuality, nextImpact]) => {
        setFeedback(nextFeedback);
        setHealth(nextHealth);
        setQuality(nextQuality);
        setImpact(nextImpact);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Quality data is unavailable."));
  }, []);

  return (
    <div className="page">
      <div className="page-head"><div><h1>Quality &amp; health</h1><p>Privacy-safe answer feedback and runtime readiness. No transcript text is stored here.</p></div></div>
      {error && <div className="alert alert-error"><AlertIcon size={15} />{error}</div>}

      <div className="grid-cards operations-stats">
        <QualityStat icon={<ThumbsUpIcon size={17} />} label="Helpful" value={feedback?.up ?? "—"} />
        <QualityStat icon={<ThumbsDownIcon size={17} />} label="Not helpful" value={feedback?.down ?? "—"} />
        <QualityStat icon={<ActivityIcon size={17} />} label="Helpful ratio" value={feedback ? `${Math.round(feedback.helpfulRatio * 100)}%` : "—"} />
        <QualityStat icon={<CheckIcon size={17} />} label="Database" value={health?.database ?? "—"} />
      </div>

      {health && (
        <section className="health-strip card">
          <div><span className="metric-label">Answer mode</span><strong>{health.aiMode.toLowerCase()}</strong></div>
          <div><span className="metric-label">Documents</span><strong>{health.documents}</strong></div>
          <div><span className="metric-label">Indexed passages</span><strong>{health.indexedPassages}</strong></div>
          <div><span className="metric-label">Failed ingestions</span><strong>{health.failedIngestions}</strong></div>
        </section>
      )}

      {health && quality && (
        <section className="card ops-section">
          <span className="metric-label">Provider transparency · latest {quality.windowAnswers} answers</span>
          <h2>Configured {health.aiMode}</h2>
          <p className="muted">Hosted completed {quality.hostedCompletions} / {quality.windowAnswers}</p>
          <div className="health-strip">
            <div><span className="metric-label">Rate-limit fallback</span><strong>{quality.rateLimitFallbacks}</strong></div>
            <div><span className="metric-label">Tool-only answers</span><strong>{quality.toolOnlyAnswers}</strong></div>
            <div><span className="metric-label">Citation coverage</span><strong>{Math.round(quality.averageCitationCoverage * 100)}%</strong></div>
            <div><span className="metric-label">Average latency</span><strong>{(quality.averageDurationMs / 1000).toFixed(1)}s</strong></div>
          </div>
        </section>
      )}

      {impact && (
        <section className="card ops-section">
          <span className="metric-label">Policy impact</span>
          <h2>{impact.documents} governed documents · {impact.declaredFunctionalRequirements.length} declared FRs</h2>
          <p className="muted">
            {impact.versionedDocuments} documents have version history; {impact.inactiveCitationCount} answers cite an inactive version.
          </p>
          {impact.authoritativeBoundaries.map((boundary) => (
            <div className="alert alert-info" key={boundary}>{boundary}</div>
          ))}
        </section>
      )}

      <KbQualityPanel />

      <section className="card ops-section">
        <span className="metric-label">Recent aggregate feedback</span>
        <h2>By day and role</h2>
        {!feedback || feedback.byRoleAndDay.length === 0 ? <p className="muted">No feedback submitted yet.</p> : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Day</th><th>Role</th><th>Helpful</th><th>Not helpful</th></tr></thead>
              <tbody>{feedback.byRoleAndDay.map((row) => (
                <tr key={`${row.day}-${row.actorRole}`}>
                  <td>{row.day}</td><td>{row.actorRole.replaceAll("_", " ").toLowerCase()}</td>
                  <td>{row.up}</td><td>{row.down}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function QualityStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><div><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div></div>;
}
