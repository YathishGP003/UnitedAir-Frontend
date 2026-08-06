import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionView } from "../types";
import { ChatActionCard } from "./ChatActionCard";

const confirmAction = vi.fn();
const cancelAction = vi.fn();

vi.mock("../api/client", () => ({
  api: {
    confirmAction: (...args: unknown[]) => confirmAction(...args),
    cancelAction: (...args: unknown[]) => cancelAction(...args),
  },
}));

const proposal: ActionView = {
  actionUuid: "action-1",
  type: "CANCEL_BOOKING",
  status: "PENDING",
  pnr: "B6X9K2",
  summary: {
    flight: "UA404 DEL-LHR on 2026-08-16",
    estimatedRefund: 0,
    warning: "This cannot be undone.",
  },
  citations: [{ documentCode: "KB-AIR-004", section: "2.1 Cancellation Fee Matrix" }],
  result: null,
  createdAt: "2026-07-27T00:00:00Z",
  expiresAt: "2026-07-27T00:15:00Z",
  failureReason: null,
};

describe("ChatActionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not cancel until the passenger explicitly confirms", async () => {
    const onSettled = vi.fn();
    confirmAction.mockResolvedValueOnce({
      ...proposal,
      status: "CONFIRMED",
      result: { message: "Booking B6X9K2 is cancelled." },
    });

    render(<ChatActionCard action={proposal} onSettled={onSettled} />);

    expect(screen.getByText("Nothing has changed yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));

    expect(await screen.findByText("Booking B6X9K2 is cancelled.")).toBeInTheDocument();
    expect(confirmAction).toHaveBeenCalledWith("action-1");
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({
      actionUuid: "action-1",
      status: "CONFIRMED",
    }));
  });

  it("dismisses a pending proposal without confirming it", async () => {
    cancelAction.mockResolvedValueOnce({ ...proposal, status: "CANCELLED" });

    render(<ChatActionCard action={proposal} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep my booking" }));

    await waitFor(() => expect(screen.queryByText("Nothing has changed yet.")).not.toBeInTheDocument());
    expect(confirmAction).not.toHaveBeenCalled();
  });
});
