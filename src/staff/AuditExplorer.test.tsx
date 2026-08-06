import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditExplorer from "./AuditExplorer";

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  auditTrail: vi.fn(),
  operationalDecisions: vi.fn(),
}));

vi.mock("../api/client", () => ({ api: mocks }));

describe("AuditExplorer", () => {
  beforeEach(() => {
    mocks.listSessions.mockResolvedValue([]);
    mocks.operationalDecisions.mockResolvedValue([{
      decisionUuid: "decision-1",
      actionUuid: "action-1",
      decisionType: "REFUND_APPROVAL",
      outcome: "APPROVED",
      actorUserId: 2,
      actorRole: "AIRLINE_STAFF",
      pnrDisplay: "[AIR-PNR-REDACTED]",
      reason: null,
      sourcePolicyCode: "KB-AIR-004",
      sourcePolicySection: "2.1",
      traceId: "trace",
      sessionUuid: "session",
      detail: {},
      createdAt: "2026-07-27T12:00:00Z",
      decidedAt: "2026-07-27T12:01:00Z",
    }]);
  });

  it("filters and renders normalized operational decisions", async () => {
    render(<AuditExplorer />);
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "REFUND_APPROVAL" },
    });
    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "APPROVED" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Search decisions/i }));

    await waitFor(() => expect(mocks.operationalDecisions).toHaveBeenCalledWith({
      types: ["REFUND_APPROVAL"],
      outcome: "APPROVED",
      pnr: undefined,
    }));
    expect(await screen.findByText("refund approval")).toBeInTheDocument();
    expect(screen.getByText("KB-AIR-004")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Operational decision results" }))
      .toBeInTheDocument();
  });
});

