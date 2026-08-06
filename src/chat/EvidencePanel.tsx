import { useEffect, useRef, useState } from "react";
import { LayersIcon } from "../components/Icons";
import type { EvidencePreview } from "../types";

/**
 * The passages the answer was built from.
 *
 * SRS 4.1.2 requires document, section and page on every citation, so those are
 * shown for each passage along with its relevance. Clicking a citation in the
 * answer scrolls the matching entry into view and highlights it.
 */
export default function EvidencePanel({
  evidence,
  focusedHandle,
}: {
  evidence: EvidencePreview[];
  focusedHandle: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusedHandle) return;
    const node = refs.current[focusedHandle];
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedHandle]);

  if (evidence.length === 0) {
    return (
      <div className="panel-empty">
        <LayersIcon size={22} />
        <p style={{ marginTop: 10 }}>
          Ask a question and the passages behind the answer will appear here, with their
          document, section and page.
        </p>
      </div>
    );
  }

  return (
    <>
      {evidence.map((item) => {
        const isOpen = expanded.has(item.handle);
        return (
          <div
            key={item.handle}
            ref={(node) => {
              refs.current[item.handle] = node;
            }}
            className={`evidence ${focusedHandle === item.handle ? "highlight" : ""}`}
          >
            <div className="evidence-head">
              <span className="evidence-handle">{item.handle}</span>
              <span className="evidence-doc">
                {item.documentTitle || item.documentCode}
              </span>
            </div>

            <div className="evidence-sub">
              {item.section && <span>{item.section}</span>}
              {item.toolName ? (
                <>
                  {item.toolOperation && <span>{item.toolOperation}</span>}
                  {item.provider && (
                    <span className={`evidence-provider ${item.providerLive ? "live" : "simulated"}`}>
                      {item.providerLive
                        ? `${item.provider.replaceAll("_", " ")} sandbox`
                        : `${item.provider.replaceAll("_", " ")} simulator`}
                    </span>
                  )}
                  {item.retrievedAt && (
                    <time dateTime={item.retrievedAt}>
                      {new Date(item.retrievedAt).toLocaleTimeString()}
                    </time>
                  )}
                </>
              ) : (
                <>
                  <span>page {item.page}</span>
                  <span>relevance {(Math.max(0, item.relevance) * 100).toFixed(0)}%</span>
                </>
              )}
            </div>

            <div className={`evidence-text ${isOpen ? "open" : ""}`}>{item.excerpt}</div>

            {item.excerpt.length > 260 && (
              <button
                className="evidence-more"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.handle)) next.delete(item.handle);
                    else next.add(item.handle);
                    return next;
                  })
                }
              >
                {isOpen ? "Show less" : "Show the full passage"}
              </button>
            )}

            {!item.toolName && (
              <div className="score-bar">
                <div
                  className="score-fill"
                  style={{ width: `${Math.min(100, Math.round(item.relevance * 100))}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
