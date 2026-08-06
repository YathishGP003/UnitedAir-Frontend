import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FlightStatusPanel from "./FlightStatusPanel";

const mocks = vi.hoisted(() => ({
  flightStatus: vi.fn(),
  subscribeFlightNotifications: vi.fn(),
  unsubscribeFlightNotifications: vi.fn(),
  flightNotifications: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: mocks,
  ApiError: class ApiError extends Error {},
}));

describe("FlightStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flightStatus.mockResolvedValue({
      flightNo: "UA102",
      flightDate: "2026-07-28",
      origin: "BLR",
      destination: "DEL",
      status: "ON_TIME",
      delayMinutes: 0,
      scheduledDeparture: "13:40:00",
      estimatedDeparture: "13:40:00",
      scheduledArrival: "16:30:00",
      terminal: "T1",
      gate: "A10",
      retrievedAt: "2026-07-27T12:00:00Z",
    });
    mocks.subscribeFlightNotifications.mockResolvedValue({
      subscriptionUuid: "sub-1",
      flightNo: "UA102",
      date: "2026-07-28",
      gate: "A10",
      terminal: "T1",
      active: true,
      createdAt: "2026-07-27T12:00:00Z",
    });
    mocks.flightNotifications.mockResolvedValue([{
      eventUuid: "event-1",
      flightNo: "UA102",
      date: "2026-07-28",
      previousGate: "A10",
      gate: "A12",
      previousTerminal: "T1",
      terminal: "T1",
      detectedAt: "2026-07-27T12:01:00Z",
    }]);
  });

  it("subscribes after an explicit lookup and announces gate changes accessibly", async () => {
    render(<FlightStatusPanel />);
    fireEvent.change(screen.getByLabelText("Flight number"), {
      target: { value: "UA102" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-28" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Notify me of gate changes")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Notify me of gate changes"));

    await waitFor(() => expect(mocks.subscribeFlightNotifications)
      .toHaveBeenCalledWith("UA102", "2026-07-28"));
    expect(await screen.findByText(/gate A10 to A12/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Flight change notifications" }))
      .toHaveAttribute("aria-live", "polite");
  });
});

