import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityIcon, AlertIcon, CheckIcon } from "../components/Icons";
import type { IngestionAttempt, KbQualityReport } from "../types";

const ISSUE_LABELS: Record<string, string> = {
  EMPTY_CONTENT: "Empty",
  HEADER_ONLY: "Header only",
  METADATA_ONLY: "Metadata only",
  EXACT_DUPLICATE: "Duplicates",
  MISSING_METADATA: "Missing metadata",
  MISSING_VECTOR: "Missing vectors",
  WRONG_VECTOR_DIMENSION: "Wrong vector size",
};

export default function KbQualityPanel() {
  const [report, setReport] = useState<KbQualityReport | null>(null);
  const [attempts, setAttempts] = useState<IngestionAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [quality, recentAttempts] = await Promise.all([
        api.kbQuality(),
        api.ingestionAttempts(),
      ]);
      setReport(quality);
      setAttempts(recentAttempts);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Knowledge diagnostics are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return <section className="card kb-quality-panel"><span className="spinner" /> Inspecting the active corpus…</section>;
  }

  if (error && !report) {
    return (
      <section className="card kb-quality-panel">
        <div className="alert alert-error"><AlertIcon size={15} />{error}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Retry diagnostics</button>
      </section>
    );
  }

  if (!report) return null;

  const totalIssues = Object.values(report.issueCounts).reduce((sum, count) => sum + count, 0);
  const unsafeProbeCount = report.probes.filter((probe) => probe.audienceViolation).length;

  return (
    <section className="card ops-section kb-quality-panel" aria-label="Knowledge quality">
      <div className="page-head kb-quality-head">
        <div>
          <span className="metric-label">Read-only diagnostics</span>
          <h2>Knowledge quality</h2>
          <p>Corpus shape, vector readiness and role-filtered retrieval probes. No policy content is changed.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <ActivityIcon size={14} /> Refresh
        </button>
      </div>

      <div className="grid-cards kb-quality-stats">
        <QualityStat label="Active documents" value={report.activeDocuments} />
        <QualityStat label="Active passages" value={report.activeChunks} />
        <QualityStat label="Corpus issues" value={totalIssues} warn={totalIssues > 0} />
        <QualityStat label="Audience violations" value={unsafeProbeCount} warn={unsafeProbeCount > 0} />
      </div>

      <div className="kb-issue-summary">
        {Object.entries(report.issueCounts).map(([type, count]) => (
          <span className={`chip ${count > 0 ? "chip-warn" : "chip-ok"}`} key={type}>
            {ISSUE_LABELS[type] ?? type}: {count}
          </span>
        ))}
        <span className="chip chip-muted">Vector dimensions: {report.expectedVectorDimensions}</span>
      </div>

      <h3>Actionable passage issues</h3>
      {report.issues.length === 0 ? (
        <div className="panel-empty"><CheckIcon size={20} /> No corpus-shape issues detected.</div>
      ) : (
        <div className="table-scroll" role="region" aria-label="Knowledge passage issues" tabIndex={0}>
          <table className="data kb-quality-table">
            <thead><tr><th>Type</th><th>Document</th><th>Chunk</th><th>Detail</th></tr></thead>
            <tbody>{report.issues.map((issue) => (
              <tr key={`${issue.type}-${issue.chunkId}`}>
                <td><span className="chip chip-warn">{ISSUE_LABELS[issue.type] ?? issue.type}</span></td>
                <td><strong className="mono">{issue.documentCode}</strong></td>
                <td className="mono">{issue.chunkId}</td>
                <td>{issue.detail}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <h3>Role-filtered retrieval probes</h3>
      <div className="kb-probe-grid">
        {report.probes.map((probe) => (
          <article className="kb-probe" key={`${probe.role}-${probe.name}`}>
            <div className="kb-probe-head">
              <div><span className="metric-label">{probe.role.replaceAll("_", " ")}</span><strong>{probe.name}</strong></div>
              <span className={`chip ${probe.audienceViolation ? "chip-danger" : "chip-ok"}`}>
                {probe.audienceViolation ? "Audience violation" : "Audience safe"}
              </span>
            </div>
            <p>{probe.query}</p>
            <div className="kb-probe-result">
              <strong>{Math.round(probe.topRelevance * 100)}%</strong>
              <span>{probe.evidenceCount} passages</span>
              <span>{probe.selectedDocumentCodes.join(", ") || "No passage cleared the threshold"}</span>
            </div>
          </article>
        ))}
      </div>

      <h3>Embedding provenance</h3>
      <div className="table-scroll" role="region" aria-label="Active embedding provenance" tabIndex={0}>
        <table className="data kb-quality-table">
          <thead><tr><th>Document</th><th>Source</th><th>Model</th><th>Dimensions</th><th>Checksum</th></tr></thead>
          <tbody>
            {report.embeddingProvenance.length === 0 ? (
              <tr><td colSpan={5}>No embedding provenance is available.</td></tr>
            ) : report.embeddingProvenance.map((item) => (
              <tr key={`${item.documentCode}-${item.versionId}`}>
                <td><strong className="mono">{item.documentCode}</strong></td>
                <td><span className={`chip ${item.generationSource ? "chip-ok" : "chip-danger"}`}>
                  {item.generationSource?.toLowerCase() ?? "missing"}
                </span></td>
                <td>{item.modelIdentifier ?? "Not recorded"}</td>
                <td>{item.dimensions ?? "Not recorded"}</td>
                <td className="mono">{item.contentChecksum?.slice(0, 12) ?? "Missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Recent ingestion governance</h3>
      <div className="table-scroll" role="region" aria-label="Recent knowledge ingestion attempts" tabIndex={0}>
        <table className="data kb-quality-table">
          <thead><tr><th>File</th><th>Status</th><th>Phase</th><th>Passages</th><th>Result</th></tr></thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr><td colSpan={5}>No ingestion attempts have been recorded yet.</td></tr>
            ) : attempts.map((attempt) => (
              <tr key={attempt.attemptUuid}>
                <td><strong>{attempt.sourceFilename}</strong></td>
                <td>
                  <span className={`chip ${attempt.status === "FAILED" ? "chip-danger" : attempt.status === "SUCCEEDED" ? "chip-ok" : "chip-warn"}`}>
                    {attempt.status.toLowerCase()}
                  </span>
                </td>
                <td>{attempt.failurePhase?.replaceAll("_", " ").toLowerCase() ?? "Complete pipeline"}</td>
                <td>{attempt.chunksCreated}</td>
                <td>{attempt.failureReason ?? `${attempt.ingestionTimeMs ?? 0} ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QualityStat({ label, value, warn = false }: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={`stat-card ${warn ? "stat-warn" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
