import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingPanel, { formatActionValue } from "./BookingPanel";

const mocks = vi.hoisted(() => ({
  ownedBookings: vi.fn(),
  booking: vi.fn(),
  refundQuote: vi.fn(),
  searchFlights: vi.fn(),
  seatMap: vi.fn(),
  createSession: vi.fn(),
  proposeAction: vi.fn(),
  confirmAction: vi.fn(),
  passengerRefundCases: vi.fn(),
  requestSupportCallback: vi.fn(),
}));

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      ownedBookings: mocks.ownedBookings,
      booking: mocks.booking,
      refundQuote: mocks.refundQuote,
      searchFlights: mocks.searchFlights,
      seatMap: mocks.seatMap,
      createSession: mocks.createSession,
      proposeAction: mocks.proposeAction,
      confirmAction: mocks.confirmAction,
      passengerRefundCases: mocks.passengerRefundCases,
      requestSupportCallback: mocks.requestSupportCallback,
    },
  };
});

describe("BookingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passengerRefundCases.mockResolvedValue([]);
  });

  it("formats included seat proposals without unexplained zero or boolean values", () => {
    expect(formatActionValue("additionalCharge", 0)).toBe("Included with your fare");
    expect(formatActionValue("includedWithFare", true)).toBe("Yes, included with this fare");
    expect(formatActionValue("updatedAmountPaid", 4246)).toContain("4,246");
  });

  it("loads bookings owned by the signed-in passenger", async () => {
    mocks.ownedBookings.mockResolvedValue([{
      pnr: "ABC123",
      ticketNumber: "016-1234567890",
      passengerName: "Maya Singh",
      status: "CONFIRMED",
      flightNo: "UA101",
      origin: "BLR",
      destination: "DEL",
      flightDate: "2026-07-30",
      seatNumber: "8A",
      cabin: "ECONOMY",
      fareBrand: "Super Saver",
      amountPaid: 3446,
      bookedAt: "2026-07-27T10:00:00Z",
    }]);
    render(<BookingPanel />);
    expect(await screen.findByText(/ABC123/)).toBeInTheDocument();
    expect(screen.getByText(/UA101/)).toBeInTheDocument();
  });

  it("opens the seat map in a contained dialog that can be closed", async () => {
    const trip = {
      pnr: "ABC123",
      ticketNumber: "016-1234567890",
      passengerName: "Maya Singh",
      status: "CONFIRMED",
      flightNo: "UA101",
      origin: "BLR",
      destination: "DEL",
      flightDate: "2026-07-30",
      seatNumber: "8A",
      cabin: "ECONOMY",
      fareBrand: "Super Saver",
      amountPaid: 3446,
      bookedAt: "2026-07-27T10:00:00Z",
    };
    mocks.ownedBookings.mockResolvedValue([trip]);
    mocks.booking.mockResolvedValue({
      ...trip,
      departureTime: "06:15:00",
      arrivalTime: "09:05:00",
      flightStatus: "ON_TIME",
      delayMinutes: 0,
      terminal: "T1",
      gate: "A3",
      fareClass: "S",
      refundable: false,
      changeable: true,
      changeFee: 1500,
      cancelFee: 2000,
      refundAmount: null,
      checkedBaggageKg: 15,
      ffpTier: null,
      checkedIn: false,
      boardingGate: null,
    });
    mocks.refundQuote.mockResolvedValue(null);
    mocks.searchFlights.mockResolvedValue({
      origin: "BLR",
      destination: "DEL",
      departureDate: "2026-07-30",
      resultCount: 1,
      retrievedAt: "2026-07-27T10:00:00Z",
      flights: [{ flightInstanceId: 101, flightNo: "UA101", fares: [] }],
    });
    mocks.seatMap.mockResolvedValue([{
      seatNumber: "12A",
      cabin: "ECONOMY",
      seatType: "WINDOW",
      extraLegroom: false,
      exitRow: false,
      feeInr: 0,
      available: true,
    }]);

    render(<BookingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /BLR.*DEL/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Choose seat" }));

    const dialog = await screen.findByRole("dialog", { name: "Choose a seat" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", {
      name: /12A.*included with your fare/i,
    })[0]);
    expect(screen.getByTestId("seat-change-price"))
      .toHaveTextContent("Included with your fare");
    expect(screen.getByTestId("seat-change-price")).not.toHaveTextContent("₹0");
    fireEvent.click(screen.getByRole("button", { name: "Close seat map" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Choose a seat" })).not.toBeInTheDocument());
  });

  it("closes confirmation and keeps the completion message after cancellation", async () => {
    const trip = {
      pnr: "ABC123",
      ticketNumber: "016-1234567890",
      passengerName: "Maya Singh",
      status: "CONFIRMED",
      flightNo: "UA101",
      origin: "BLR",
      destination: "DEL",
      flightDate: "2026-07-30",
      seatNumber: "8A",
      cabin: "ECONOMY",
      fareBrand: "Super Saver",
      amountPaid: 3446,
      bookedAt: "2026-07-27T10:00:00Z",
    };
    const confirmed = {
      ...trip,
      departureTime: "06:15:00",
      arrivalTime: "09:05:00",
      flightStatus: "ON_TIME",
      delayMinutes: 0,
      terminal: "T1",
      gate: "A3",
      fareClass: "S",
      refundable: false,
      changeable: true,
      changeFee: 1500,
      cancelFee: 2000,
      refundAmount: null,
      checkedBaggageKg: 15,
      ffpTier: null,
      checkedIn: false,
      boardingGate: null,
    };
    mocks.ownedBookings.mockResolvedValue([trip]);
    mocks.booking
      .mockResolvedValueOnce(confirmed)
      .mockResolvedValueOnce({ ...confirmed, status: "REFUND_PENDING", refundAmount: 1446 });
    mocks.refundQuote.mockResolvedValue(null);
    mocks.createSession.mockResolvedValue({ sessionUuid: "session-1" });
    mocks.proposeAction.mockResolvedValue({
      actionUuid: "action-1",
      type: "CANCEL_BOOKING",
      status: "PENDING",
      pnr: "ABC123",
      summary: { warning: "This cannot be undone." },
      citations: [],
      result: null,
      createdAt: "2026-07-27T10:00:00Z",
      expiresAt: "2026-07-27T10:15:00Z",
      failureReason: null,
    });
    mocks.confirmAction.mockResolvedValue({
      actionUuid: "action-1",
      type: "CANCEL_BOOKING",
      status: "CONFIRMED",
      pnr: "ABC123",
      summary: {},
      citations: [],
      result: { message: "Booking ABC123 is cancelled. Refund INR 1,446 is pending." },
      createdAt: "2026-07-27T10:00:00Z",
      expiresAt: "2026-07-27T10:15:00Z",
      failureReason: null,
    });
    mocks.passengerRefundCases
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        caseUuid: "30df6a3f-dfb3-4c0a-96d4-52da5a5822f9",
        pnr: "ABC123",
        passengerUserId: 7,
        passengerName: "Maya Singh",
        flightNo: "UA101",
        origin: "BLR",
        destination: "DEL",
        flightDate: "2026-07-30",
        fareBrand: "Super Saver",
        cancellationBasis: "Non-refundable fare",
        amountPaid: 3446,
        cancellationFee: 2000,
        refundAmount: 1446,
        paymentMethod: "CARD",
        maskedPayment: "•••• 4242",
        dueAt: "2026-08-03T10:00:00Z",
        status: "PENDING",
        callbackStatus: null,
        staffNote: null,
        createdAt: "2026-07-27T10:00:00Z",
        updatedAt: "2026-07-27T10:00:00Z",
        completedAt: null,
        history: [],
      }]);

    render(<BookingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /BLR.*DEL/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel booking" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Booking ABC123 is cancelled. Refund INR 1,446 is pending."))
      .toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText(/RFD-30DF6A3F/i)).toBeInTheDocument();
    expect(screen.getByText("Refund pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request a callback" })).toBeInTheDocument();
  });
});
