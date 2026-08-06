import { useMemo } from "react";
import type { SeatOption } from "../types";

interface Props {
  seats: SeatOption[];
  selected?: string | null;
  onSelect?: (seat: SeatOption) => void;
}

export default function SeatMap({ seats, selected, onSelect }: Props) {
  const rows = useMemo(() => {
    const grouped = new Map<string, SeatOption[]>();
    seats.forEach((seat) => {
      const row = seat.seatNumber.replace(/\D/g, "");
      grouped.set(row, [...(grouped.get(row) ?? []), seat]);
    });
    return [...grouped.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [seats]);

  if (seats.length === 0) {
    return <div className="panel-empty">No seat map is available for this flight.</div>;
  }

  return (
    <section className="seat-map-card" aria-label="Aircraft seat map">
      <header className="seat-map-head">
        <div>
          <span className="metric-label">Front of aircraft</span>
          <h3>Choose a seat</h3>
        </div>
        <div className="seat-legend" aria-label="Seat legend">
          <span><i className="seat-swatch available" /> Available</span>
          <span><i className="seat-swatch occupied" /> Occupied</span>
          <span><i className="seat-swatch extra" /> Extra legroom</span>
        </div>
      </header>

      <div className="seat-map-scroll">
        <div className="aircraft">
          {rows.map(([row, rowSeats], rowIndex) => {
            const cabin = rowSeats[0]?.cabin ?? "";
            const priorCabin = rows[rowIndex - 1]?.[1][0]?.cabin;
            return (
              <div key={row} className="seat-row-wrap">
                {cabin !== priorCabin && (
                  <div className="cabin-divider"><span>{cabin.replaceAll("_", " ")}</span></div>
                )}
                <div className="seat-row">
                  <span className="row-number">{row}</span>
                  {["A", "B", "C", "D", "E", "F"].map((letter) => {
                    const seat = rowSeats.find((item) => item.seatNumber.endsWith(letter));
                    if (!seat) {
                      return <span key={letter}
                        className={`seat-space ${letter === "D" ? "aisle" : ""}`} />;
                    }
                    const price = seatPriceLabel(seat.feeInr);
                    return (
                      <button
                        key={seat.seatNumber}
                        className={[
                          "seat",
                          seat.available ? "available" : "occupied",
                          seat.extraLegroom ? "extra" : "",
                          selected === seat.seatNumber ? "selected" : "",
                          letter === "D" ? "aisle" : "",
                        ].filter(Boolean).join(" ")}
                        disabled={!seat.available}
                        onClick={() => onSelect?.(seat)}
                        aria-label={`${seat.seatNumber}, ${seat.seatType.toLowerCase()}, ${
                          seat.extraLegroom ? "extra legroom, " : ""
                        }${seat.available ? `available, ${price}` : "occupied"}`}
                        title={`${seat.seatNumber} · ${seat.seatType} · ${price}`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                  <span className="row-number">{row}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="seat-list-alternative">
        <summary>Accessible seat list</summary>
        <ul>
          {seats.filter((seat) => seat.available).map((seat) => (
            <li key={seat.seatNumber}>
              <button onClick={() => onSelect?.(seat)}>
                {seat.seatNumber} · {seat.cabin.replaceAll("_", " ")} · {seat.seatType}
                {seat.extraLegroom ? " · extra legroom" : ""} · {seatPriceLabel(seat.feeInr)}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function seatPriceLabel(feeInr: number): string {
  return feeInr > 0 ? `INR ${feeInr}` : "Included with your fare";
}
