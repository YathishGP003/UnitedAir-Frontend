import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, ApiError } from "../api/client";
import AppShell from "../components/AppShell";
import type { ShellTab } from "../components/AppShell";
import {
  ActivityIcon,
  AlertIcon,
  BookIcon,
  LayersIcon,
  SearchIcon,
  UploadIcon,
} from "../components/Icons";
import type { IngestionJob, KbDocument, KbStatistics, SearchHit } from "../types";
import QualityPanel from "./QualityPanel";

/**
 * Admin console — Knowledge Base governance only.
 *
 * <p>SRS 2.3 scopes Admin to KB ingestion, document versioning and access management. There
 * is deliberately no passenger or staff conversation here: an administrator who needs to
 * see what a passenger is told should look at the audit trail, not hold the conversation
 * themselves.
 */
const TABS: ShellTab[] = [
  { to: "/governance", label: "Documents", icon: <BookIcon size={14} /> },
  { to: "/governance/jobs", label: "Ingestion log", icon: <ActivityIcon size={14} /> },
  { to: "/governance/retrieval", label: "Retrieval check", icon: <SearchIcon size={14} /> },
  { to: "/governance/quality", label: "Quality", icon: <ActivityIcon size={14} /> },
];

export default function AdminWorkspace() {
  return (
    <AppShell tabs={TABS}>
      <Routes>
        <Route index element={<DocumentsView />} />
        <Route path="jobs" element={<JobsView />} />
        <Route path="retrieval" element={<RetrievalView />} />
        <Route path="quality" element={<QualityPanel />} />
        <Route path="*" element={<Navigate to="/governance" replace />} />
      </Routes>
    </AppShell>
  );
}

/* ----------------------------------------------------------- documents --- */

function DocumentsView() {
  const [stats, setStats] = useState<KbStatistics | null>(null);
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const [s, d] = await Promise.allSettled([api.kbStatistics(), api.kbDocuments()]);
    if (s.status === "fulfilled") setStats(s.value);
    if (d.status === "fulfilled") setDocuments(d.value);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Knowledge Base</h1>
          <p>
            Governance metadata is read from each document&rsquo;s own header table. Only active
            versions are retrievable.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid-cards" style={{ marginBottom: 22 }}>
          <Stat label="Documents" value={String(stats.documentCount)} />
          <Stat label="Active versions" value={String(stats.activeVersionCount)} />
          <Stat label="Indexed passages" value={stats.chunkCount.toLocaleString()} />
          <Stat
            label="Ingestions"
            value={`${stats.jobsSucceeded} ok`}
            sub={stats.jobsFailed > 0 ? `${stats.jobsFailed} failed` : "none failed"}
          />
        </div>
      )}

      <UploadCard
        onDone={(text, kind) => {
          setToast({ kind, text });
          void refresh();
        }}
      />

      <div className="table-wrap" style={{ marginTop: 22 }}>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Version</th>
                <th>Category</th>
                <th>Audience</th>
                <th>Effective</th>
                <th>Passages</th>
                <th>Serves</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.documentId}>
                  <td>
                    <strong className="mono">{doc.documentCode}</strong>
                  </td>
                  <td>{doc.title}</td>
                  <td>
                    {doc.activeVersionLabel ? (
                      <span className="chip chip-ok">{doc.activeVersionLabel}</span>
                    ) : (
                      <span className="chip chip-muted">none</span>
                    )}
                  </td>
                  <td>
                    <span className="chip chip-muted">{doc.category ?? "—"}</span>
                  </td>
                  <td>
                    {(doc.audience ?? "")
                      .split(",")
                      .filter(Boolean)
                      .map((a) => (
                        <span
                          key={a}
                          className={`chip ${a === "Airline Staff" ? "chip-warn" : "chip-muted"}`}
                          style={{ marginRight: 4 }}
                        >
                          {a}
                        </span>
                      ))}
                  </td>
                  <td>{doc.effectiveFrom ?? "—"}</td>
                  <td>{doc.chunkCount}</td>
                  <td className="mono" style={{ fontSize: 11, maxWidth: 180 }}>
                    {doc.servesFrs || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="toast-stack">
          <div className={`toast ${toast.kind}`}>{toast.text}</div>
        </div>
      )}
    </div>
  );
}

function UploadCard({ onDone }: { onDone: (text: string, kind: "ok" | "err") => void }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const result = await api.uploadKbDocument(file);
        onDone(
          `${result.documentCode} ingested — ${result.chunksCreated} passages in ${result.ingestionTimeMs} ms.`,
          "ok",
        );
      } catch (e) {
        onDone(`${file.name}: ${e instanceof ApiError ? e.message : "ingestion failed"}`, "err");
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      className={`dropzone ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void upload(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />
      {busy ? <span className="spinner" /> : <UploadIcon size={24} className="muted" />}
      <h3>{busy ? "Ingesting…" : "Add a Knowledge Base document"}</h3>
      <p>Drop a PDF, DOCX or TXT file here, or click to choose.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- jobs --- */

function JobsView() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api
      .ingestionJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setBusy(false));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Ingestion log</h1>
          <p>FR-032 — every ingestion with its administrator, status, chunk count and timing.</p>
        </div>
      </div>

      {jobs.length === 0 && !busy && <Empty text="No ingestion jobs recorded." />}

      {jobs.length > 0 && (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data jobs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Document</th>
                  <th>File</th>
                  <th>Passages</th>
                  <th>Duration</th>
                  <th>Triggered by</th>
                  <th>Finished</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobUuid}>
                    <td>
                      <span
                        className={`chip ${job.status === "SUCCEEDED" ? "chip-ok" : "chip-danger"}`}
                      >
                        {job.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <strong className="mono">{job.documentCode}</strong>
                    </td>
                    <td className="muted job-file">
                      <span title={job.sourceFilename}>{job.sourceFilename}</span>
                    </td>
                    <td>{job.chunksCreated}</td>
                    <td>{job.ingestionTimeMs != null ? `${job.ingestionTimeMs} ms` : "—"}</td>
                    <td className="muted">{job.triggeredByEmail ?? "system (startup seed)"}</td>
                    <td className="muted">
                      {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- retrieval --- */

function RetrievalView() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setHits(await api.kbSearch(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Retrieval check</h1>
          <p>
            Runs the real pipeline under your own audience filter — the quickest way to see what
            the assistant would be allowed to use.
          </p>
        </div>
      </div>

      <div className="search-bar">
        <div className="field" style={{ flex: 1 }}>
          <label className="label">Question</label>
          <input
            className="input"
            placeholder="denied boarding compensation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void run()}
          />
        </div>
        <button className="btn btn-primary search-go" onClick={() => void run()} disabled={busy}>
          {busy ? <span className="spinner" /> : <SearchIcon size={15} />} Search
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {hits && hits.length === 0 && (
        <Empty text="Nothing cleared the similarity threshold. The assistant would return the empty-context response for this question." />
      )}

      {hits?.map((hit) => (
        <div className="evidence" key={`${hit.documentCode}-${hit.rank}`}>
          <div className="evidence-head">
            <span className="evidence-handle">#{hit.rank}</span>
            <span className="evidence-doc">{hit.documentCode}</span>
            <span className="chip chip-muted" style={{ marginLeft: "auto" }}>
              {hit.category}
            </span>
          </div>
          <div className="evidence-sub">
            <span>{hit.section}</span>
            <span>page {hit.page}</span>
            <span>audience {hit.audience}</span>
            <span>
              vector {hit.vectorScore?.toFixed(3) ?? "—"} · lexical{" "}
              {hit.lexicalScore?.toFixed(3) ?? "—"} · relevance {(hit.relevance * 100).toFixed(0)}%
            </span>
          </div>
          <div className="evidence-text open">{hit.excerpt}</div>
          <div className="score-bar">
            <div className="score-fill" style={{ width: `${Math.round(hit.relevance * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ fragments --- */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="panel-empty">
      <LayersIcon size={24} />
      <p style={{ marginTop: 10, maxWidth: 460, marginInline: "auto" }}>{text}</p>
    </div>
  );
}
