import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BaggageCalculator from "./BaggageCalculator";

describe("BaggageCalculator", () => {
  it("shows the domestic Economy allowance and cites its policy source", () => {
    render(<BaggageCalculator />);
    expect(screen.getByText("15 kg checked")).toBeInTheDocument();
    expect(screen.getByText(/KB-AIR-003/)).toBeInTheDocument();
  });

  it("discloses excess weight without inventing a monetary fee", () => {
    render(<BaggageCalculator />);
    fireEvent.change(screen.getByLabelText("Planned checked weight"), {
      target: { value: "23" },
    });
    expect(screen.getByText(/8 kg above this allowance/i)).toBeInTheDocument();
    expect(screen.getByText(/will not invent a fee/i)).toBeInTheDocument();
  });

  it("warns about dangerous-goods restrictions for battery devices", () => {
    render(<BaggageCalculator />);
    fireEvent.change(screen.getByLabelText("Special item"), {
      target: { value: "BATTERY" },
    });
    expect(screen.getByText(/dangerous-goods restrictions/i)).toBeInTheDocument();
  });

  it("announces a large Business-cabin excess result with its policy source", () => {
    render(<BaggageCalculator />);
    fireEvent.change(screen.getByLabelText("Cabin"), {
      target: { value: "BUSINESS" },
    });
    fireEvent.change(screen.getByLabelText("Planned checked weight"), {
      target: { value: "190" },
    });

    const result = screen.getByRole("status", {
      name: "Baggage allowance result",
    });
    expect(result).toHaveTextContent("Published allowance");
    expect(result).toHaveTextContent("35 kg checked");
    expect(result).toHaveTextContent("155 kg above this allowance");
    expect(result).toHaveTextContent("KB-AIR-003");
  });
});
