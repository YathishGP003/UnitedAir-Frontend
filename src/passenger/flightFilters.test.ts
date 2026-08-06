import { describe, expect, it } from "vitest";
import { prepareFlights } from "./FlightSearchPanel";
import type { FlightOption } from "../types";

function flight(no: string, departure: string, duration: number, price: number, refundable: boolean): FlightOption {
  return {
    flightInstanceId: Number(no.slice(2)),
    flightNo: no,
    origin: "BLR",
    originCity: "Bengaluru",
    destination: "DEL",
    destinationCity: "New Delhi",
    flightDate: "2026-08-01",
    departureTime: departure,
    arrivalTime: "12:00:00",
    durationMinutes: duration,
    aircraft: "A320",
    international: false,
    status: "ON_TIME",
    delayMinutes: 0,
    terminal: "T1",
    gate: "A1",
    fares: [{
      fareId: Number(no.slice(2)), fareClass: "M", cabin: "ECONOMY", fareBrand: "Value",
      baseFare: price, taxes: 0, totalFare: price, refundable, changeable: true,
      changeFee: 0, cancelFee: 0, checkedBaggageKg: 15, cabinBaggageKg: 7,
      seatsAvailable: 3, ffpAccrualPct: 50,
    }],
  };
}

describe("prepareFlights", () => {
  const input = [
    flight("UA102", "13:40:00", 170, 3000, true),
    flight("UA101", "06:15:00", 190, 5000, false),
  ];

  it("sorts by lowest available fare", () => {
    expect(prepareFlights(input, "price", false).map((item) => item.flightNo))
      .toEqual(["UA102", "UA101"]);
  });

  it("filters to departures with a refundable fare", () => {
    expect(prepareFlights(input, "departure", true).map((item) => item.flightNo))
      .toEqual(["UA102"]);
  });
});
