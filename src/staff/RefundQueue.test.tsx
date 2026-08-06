import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefundCaseView } from "../types";
import RefundQueue from "./RefundQueue";

const mocks = vi.hoisted(() => ({
  staffRefundCases: vi.fn(),
  transitionRefund: vi.fn(),
}));

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      staffRefundCases: mocks.staffRefundCases,
      transitionRefund: mocks.transitionRefund,
    },
  };
});

describe("RefundQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows governed refund details and refreshes the state after Staff starts work", async () => {
    const pending = refundCase("PENDING");
    const processing = refundCase("PROCESSING");
    mocks.staffRefundCases.mockResolvedValueOnce([pending]).mockResolvedValueOnce([processing]);
    mocks.transitionRefund.mockResolvedValue(processing);

    render(<RefundQueue />);

    expect(await screen.findByRole("heading", { name: "Refund cases" })).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("Maya Singh")).toBeInTheDocument();
    expect(screen.getByText("₹3,000")).toBeInTheDocument();
    expect(screen.getByText("•••• 4242")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start processing" }));

    await waitFor(() =>
      expect(screen.getAllByText("processing").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "Mark completed" })).toBeInTheDocument();
  });

  it("has a useful empty state instead of an empty table", async () => {
    mocks.staffRefundCases.mockResolvedValue([]);

    render(<RefundQueue />);

    expect(await screen.findByText("No refund cases match this view.")).toBeInTheDocument();
  });
});

function refundCase(status: RefundCaseView["status"]): RefundCaseView {
  return {
    caseUuid: "30df6a3f-dfb3-4c0a-96d4-52da5a5822f9",
    pnr: "ABC123",
    passengerUserId: 7,
    passengerName: "Maya Singh",
    flightNo: "UA101",
    origin: "BLR",
    destination: "DEL",
    flightDate: "2026-08-10",
    fareBrand: "Value",
    cancellationBasis: "Value fare cancellation matrix",
    amountPaid: 5000,
    cancellationFee: 2000,
    refundAmount: 3000,
    paymentMethod: "CARD",
    maskedPayment: "•••• 4242",
    dueAt: "2026-08-03T10:00:00Z",
    status,
    callbackStatus: null,
    staffNote: null,
    createdAt: "2026-07-27T10:00:00Z",
    updatedAt: "2026-07-27T10:00:00Z",
    completedAt: null,
    history: [{
      fromStatus: null,
      toStatus: status,
      note: "Cancellation confirmed",
      changedBy: null,
      changedAt: "2026-07-27T10:00:00Z",
    }],
  };
}
