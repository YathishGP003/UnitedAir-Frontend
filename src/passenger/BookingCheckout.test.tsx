import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FareOption, FlightOption } from "../types";
import BookingCheckout from "./BookingCheckout";

const apiMocks = vi.hoisted(() => ({
  startBookingDraft: vi.fn(),
  updateBookingDraft: vi.fn(),
  bookingDraftSeats: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: apiMocks,
}));

describe("BookingCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraft([{
      seatNumber: "8A",
      cabin: "ECONOMY",
      seatType: "WINDOW",
      extraLegroom: false,
      exitRow: false,
      feeInr: 200,
      available: true,
    }]);
  });

  it("creates a draft from the selected live fare and offers available seats", async () => {
    render(<BookingCheckout flight={flight} fare={fare} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(apiMocks.updateBookingDraft).toHaveBeenCalledWith(
        "draft-1",
        expect.objectContaining({
          flightInstanceId: 44,
          fareId: 102,
          origin: "BLR",
          destination: "DEL",
        }),
        0,
      ),
    );
    expect(await screen.findByRole("button", { name: /seat 8a/i })).toBeInTheDocument();
  });

  it("shows base fare taxes and paid seat fee and updates the payable total", async () => {
    render(<BookingCheckout flight={flight} fare={fare} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /seat 8a/i }));

    expect(screen.getByTestId("base-fare")).toHaveTextContent("₹2,200");
    expect(screen.getByTestId("taxes")).toHaveTextContent("₹1,246");
    expect(screen.getByTestId("seat-fee")).toHaveTextContent("₹200");
    expect(screen.getByTestId("payable-total")).toHaveTextContent("₹3,646");
  });

  it("describes a zero-fee Business seat as included with the fare", async () => {
    mockDraft([{
      seatNumber: "2A",
      cabin: "BUSINESS",
      seatType: "WINDOW",
      extraLegroom: true,
      exitRow: false,
      feeInr: 0,
      available: true,
    }], "BUSINESS");
    const businessFare: FareOption = {
      ...fare,
      fareId: 202,
      cabin: "BUSINESS",
      fareBrand: "Business Flex",
      baseFare: 12000,
      taxes: 3000,
      totalFare: 15000,
    };

    render(<BookingCheckout flight={flight} fare={businessFare} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /seat 2a/i }));

    expect(screen.getByText("Included with your fare")).toBeInTheDocument();
    expect(screen.getByTestId("seat-fee")).toHaveTextContent("Included");
    expect(screen.getByTestId("payable-total")).toHaveTextContent("₹15,000");
    expect(screen.queryByText("₹0")).not.toBeInTheDocument();
  });
});

function mockDraft(seats: unknown[], cabin = "ECONOMY") {
  apiMocks.startBookingDraft.mockResolvedValue({
    draftUuid: "draft-1",
    state: "COLLECTING",
    version: 0,
  });
  apiMocks.updateBookingDraft.mockResolvedValue({
    draftUuid: "draft-1",
    state: "CHECKOUT",
    version: 1,
    flightInstanceId: 44,
    fareId: 102,
    cabin,
  });
  apiMocks.bookingDraftSeats.mockResolvedValue(seats);
}

const fare: FareOption = {
  fareId: 102,
  fareClass: "Q",
  cabin: "ECONOMY",
  fareBrand: "Super Saver",
  baseFare: 2200,
  taxes: 1246,
  totalFare: 3446,
  refundable: false,
  changeable: false,
  changeFee: 0,
  cancelFee: 2200,
  checkedBaggageKg: 15,
  cabinBaggageKg: 7,
  seatsAvailable: 9,
  ffpAccrualPct: 10,
};

const flight: FlightOption = {
  flightInstanceId: 44,
  flightNo: "UA101",
  origin: "BLR",
  originCity: "Bengaluru",
  destination: "DEL",
  destinationCity: "New Delhi",
  flightDate: "2026-07-29",
  departureTime: "06:15:00",
  arrivalTime: "09:05:00",
  durationMinutes: 170,
  aircraft: "A320neo",
  international: false,
  status: "ON_TIME",
  delayMinutes: 0,
  terminal: "T1",
  gate: "A4",
  fares: [fare],
};
