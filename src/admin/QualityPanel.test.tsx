import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QualityPanel from "./QualityPanel";

const mocks = vi.hoisted(() => ({
  feedbackStatistics: vi.fn(),
  adminHealth: vi.fn(),
  qualitySummary: vi.fn(),
  policyImpact: vi.fn(),
  kbQuality: vi.fn(),
}));

vi.mock("../api/client", () => ({ api: mocks }));

describe("QualityPanel", () => {
  beforeEach(() => {
    mocks.feedbackStatistics.mockResolvedValue({
      total: 0, up: 0, down: 0, helpfulRatio: 0, byRoleAndDay: [],
    });
    mocks.adminHealth.mockResolvedValue({
      database: "UP", aiMode: "LIVE", indexedPassages: 120, documents: 7, failedIngestions: 0,
    });
    mocks.qualitySummary.mockResolvedValue({
      windowAnswers: 20, hostedCompletions: 12, rateLimitFallbacks: 5,
      toolOnlyAnswers: 3, fallbackRate: 0.25, averageConfidence: 0.84,
      averageCitationCoverage: 0.96, averageDurationMs: 1400, escalations: 2,
      validationRepairs: 1,
    });
    mocks.policyImpact.mockResolvedValue({
      documents: 7, versionedDocuments: 2, inactiveCitationCount: 0,
      declaredFunctionalRequirements: ["FR-001", "FR-026"],
      documentImpact: [], authoritativeBoundaries: ["FR-026 requires approved WorldTracer content."],
    });
    mocks.kbQuality.mockResolvedValue({
      activeDocuments: 7, activeChunks: 120, expectedVectorDimensions: 1536,
      issueCounts: {
        EMPTY_CONTENT: 0, HEADER_ONLY: 0, METADATA_ONLY: 0, EXACT_DUPLICATE: 0,
        MISSING_METADATA: 0, MISSING_VECTOR: 0, WRONG_VECTOR_DIMENSION: 0,
      },
      issues: [], probes: [], inspectedAt: "2026-07-27T10:00:00Z",
    });
  });

  it("separates configured live mode from hosted completions and shows policy boundaries", async () => {
    render(<QualityPanel />);

    expect(await screen.findByText("Configured LIVE")).toBeInTheDocument();
    expect(screen.getByText("Hosted completed 12 / 20")).toBeInTheDocument();
    expect(screen.getByText(/WorldTracer content/)).toBeInTheDocument();
  });
});
