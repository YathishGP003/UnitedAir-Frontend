import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KbQualityPanel from "./KbQualityPanel";

const mocks = vi.hoisted(() => ({
  kbQuality: vi.fn(),
  ingestionAttempts: vi.fn(),
}));

vi.mock("../api/client", () => ({ api: mocks }));

describe("KbQualityPanel", () => {
  beforeEach(() => {
    mocks.kbQuality.mockResolvedValue({
      activeDocuments: 7,
      activeChunks: 120,
      expectedVectorDimensions: 1536,
      issueCounts: {
        EMPTY_CONTENT: 0,
        HEADER_ONLY: 2,
        METADATA_ONLY: 1,
        EXACT_DUPLICATE: 3,
        MISSING_METADATA: 0,
        MISSING_VECTOR: 0,
        WRONG_VECTOR_DIMENSION: 0,
      },
      issues: [{
        type: "HEADER_ONLY",
        chunkId: 42,
        versionId: 8,
        documentCode: "KB-AIR-004",
        detail: "The passage appears to contain only a heading.",
      }],
      probes: [{
        name: "Passenger cancellation",
        role: "PASSENGER",
        query: "What is the passenger cancellation and refund policy?",
        topRelevance: 0.84,
        selectedDocumentCodes: ["KB-AIR-004"],
        audienceViolation: false,
        evidenceCount: 3,
      }],
      embeddingProvenance: [{
        documentCode: "KB-AIR-004",
        versionId: 8,
        modelIdentifier: "deterministic-hashed-bow-v1",
        dimensions: 1536,
        generationSource: "DETERMINISTIC",
        embeddedAt: "2026-07-27T09:59:00Z",
        contentChecksum: "1234567890abcdef",
      }],
      inspectedAt: "2026-07-27T10:00:00Z",
    });
    mocks.ingestionAttempts.mockResolvedValue([{
      attemptUuid: "attempt-1",
      sourceFilename: "refund-policy.txt",
      status: "FAILED",
      failurePhase: "FRONT_MATTER",
      failureReason: "Missing approved_by",
      chunksCreated: 0,
      ingestionTimeMs: 12,
      startedAt: "2026-07-27T09:58:00Z",
      finishedAt: "2026-07-27T09:58:00Z",
    }]);
  });

  it("shows actionable corpus issues and role-filtered retrieval probes", async () => {
    render(<KbQualityPanel />);

    expect(await screen.findByText("Knowledge quality")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getAllByText("KB-AIR-004")).toHaveLength(3);
    expect(screen.getByText("Passenger cancellation")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("Audience safe")).toBeInTheDocument();
    expect(screen.getByText("deterministic-hashed-bow-v1")).toBeInTheDocument();
    expect(screen.getByText("refund-policy.txt")).toBeInTheDocument();
    expect(screen.getByText("front matter")).toBeInTheDocument();
  });
});
