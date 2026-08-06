import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SeatMap from "./SeatMap";
import type { SeatOption } from "../types";

const seats: SeatOption[] = [
  {
    seatNumber: "12A",
    cabin: "ECONOMY",
    seatType: "WINDOW",
    extraLegroom: true,
    exitRow: true,
    feeInr: 900,
    available: true,
  },
  {
    seatNumber: "12B",
    cabin: "ECONOMY",
    seatType: "MIDDLE",
    extraLegroom: true,
    exitRow: true,
    feeInr: 900,
    available: false,
  },
];

describe("SeatMap", () => {
  it("groups seats spatially, disables occupied seats, and offers a list alternative", () => {
    const onSelect = vi.fn();
    render(<SeatMap seats={seats} onSelect={onSelect} />);

    const available = screen.getByRole("button", { name: /12A.*available.*INR 900/i });
    const occupied = screen.getByRole("button", { name: /12B.*occupied/i });
    expect(occupied).toBeDisabled();

    fireEvent.click(available);
    expect(onSelect).toHaveBeenCalledWith(seats[0]);

    fireEvent.click(screen.getByText("Accessible seat list"));
    expect(screen.getAllByRole("button", { name: /12A/i })).toHaveLength(2);
    expect(screen.queryAllByRole("button", { name: /12B/i })).toHaveLength(1);
  });

  it("describes a zero-fee seat as included instead of displaying INR zero", () => {
    render(<SeatMap seats={[{
      ...seats[0],
      seatNumber: "2A",
      cabin: "BUSINESS",
      feeInr: 0,
      extraLegroom: false,
      exitRow: false,
    }]} />);

    expect(screen.getAllByRole("button", { name: /2A.*included with your fare/i }))
      .toHaveLength(2);
    expect(screen.getByTitle(/2A.*included with your fare/i)).toBeInTheDocument();
    expect(screen.queryByText(/INR 0/i)).not.toBeInTheDocument();
  });
});
