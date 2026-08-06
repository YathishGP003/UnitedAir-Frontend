import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperationsDashboard from "./OperationsDashboard";

const mocks = vi.hoisted(() => ({ operationsSummary: vi.fn() }));
vi.mock("../api/client", () => ({ api: mocks }));

describe("OperationsDashboard", () => {
  beforeEach(() => {
    mocks.operationsSummary.mockResolvedValue({
      departures: 8,
      delayed: 1,
      cancelled: 0,
      openEscalations: [],
      fareRules: [{
        code: "Z",
        brand: "Corporate Flex",
        cabin: "ECONOMY",
        changeable: true,
        refundable: true,
        changeFee: 750,
        cancelFee: 1250,
        ffpAccrualPct: 80,
      }],
    });
  });

  it("renders published fare rules returned by the backend instead of UI constants", async () => {
    render(<OperationsDashboard />);

    expect(await screen.findByText("Corporate Flex")).toBeInTheDocument();
    expect(screen.getByText("INR 750")).toBeInTheDocument();
    expect(screen.queryByText("Super Saver")).not.toBeInTheDocument();
  });
});
