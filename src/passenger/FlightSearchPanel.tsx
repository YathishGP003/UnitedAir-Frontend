import { useMemo, useState } from "react";
import { api } from "../api/client";
import { AlertIcon, PlaneIcon, SearchIcon } from "../components/Icons";
import type { FareOption, FlightOption, FlightSearchResult, SeatOption } from "../types";
import BookingCheckout from "./BookingCheckout";
import SeatMap from "./SeatMap";

const AIRPORTS = [
  { code: "BLR", city: "Bengaluru" },
  { code: "DEL", city: "New Delhi" },
  { code: "BOM", city: "Mumbai" },
  { code: "MAA", city: "Chennai" },
  { code: "HYD", city: "Hyderabad" },
  { code: "CCU", city: "Kolkata" },
  { code: "DXB", city: "Dubai" },
  { code: "SIN", city: "Singapore" },
  { code: "LHR", city: "London" },
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** FR-001, FR-002, FR-009 — availability, fares, baggage and seat counts. */
export default function FlightSearchPanel() {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const [origin, setOrigin] = useState("BLR");
  const [destination, setDestination] = useState("DEL");
  const [date, setDate] = useState(tomorrow);
  const [cabin, setCabin] = useState("");
  const [result, setResult] = useState<FlightSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<FlightSort>("departure");
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [checkout, setCheckout] = useState<{ flight: FlightOption; fare: FareOption } | null>(null);
  const flights = useMemo(
    () => prepareFlights(result?.flights ?? [], sort, refundableOnly),
    [result, sort, refundableOnly],
  );

  async function search() {
    if (origin === destination) {
      setError("Origin and destination must be different.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await api.searchFlights(origin, destination, date, cabin || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Find a flight</h1>
          <p>Live availability and fares, straight from the reservations system.</p>
        </div>
      </div>

      <div className="search-bar">
        <div className="field">
          <label className="label">From</label>
          <select className="select" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <button
          className="swap-btn"
          title="Swap"
          aria-label="Swap origin and destination"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
        >
          ⇄
        </button>

        <div className="field">
          <label className="label">To</label>
          <select
            className="select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Departure</label>
          <input
            className="input"
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">Cabin</label>
          <select className="select" value={cabin} onChange={(e) => setCabin(e.target.value)}>
            <option value="">Any</option>
            <option value="Economy">Economy</option>
            <option value="Business">Business</option>
          </select>
        </div>

        <button className="btn btn-primary search-go" onClick={() => void search()} disabled={busy}>
          {busy ? <span className="spinner" /> : <SearchIcon size={15} />}
          Search
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {result && flights.length === 0 && (
        <div className="panel-empty">
          <PlaneIcon size={24} />
          <p style={{ marginTop: 10 }}>
            No UnitedAir departures on this route for {result.departureDate}.
          </p>
        </div>
      )}

      {result && result.flights.length > 0 && (
        <div className="results-toolbar" aria-label="Flight result controls">
          <span>{flights.length} departure{flights.length === 1 ? "" : "s"}</span>
          <label>
            <input type="checkbox" checked={refundableOnly}
              onChange={(event) => setRefundableOnly(event.target.checked)} />
            Refundable fares only
          </label>
          <label>
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as FlightSort)}>
              <option value="departure">Departure</option>
              <option value="price">Lowest price</option>
              <option value="duration">Shortest duration</option>
            </select>
          </label>
        </div>
      )}

      {flights.map((flight) => (
        <FlightCard key={flight.flightInstanceId} flight={flight}
          onBook={(fare) => setCheckout({ flight, fare })} />
      ))}
      {checkout && <BookingCheckout flight={checkout.flight} fare={checkout.fare}
        onClose={() => setCheckout(null)} />}
    </div>
  );
}

export type FlightSort = "departure" | "price" | "duration";

export function prepareFlights(
  source: FlightOption[],
  sort: FlightSort,
  refundableOnly: boolean,
): FlightOption[] {
  const filtered = source
    .map((flight) => ({
      ...flight,
      fares: refundableOnly ? flight.fares.filter((fare) => fare.refundable) : flight.fares,
    }))
    .filter((flight) => flight.fares.length > 0);
  return [...filtered].sort((a, b) => {
    if (sort === "price") {
      return Math.min(...a.fares.map((fare) => fare.totalFare))
        - Math.min(...b.fares.map((fare) => fare.totalFare));
    }
    if (sort === "duration") return a.durationMinutes - b.durationMinutes;
    return a.departureTime.localeCompare(b.departureTime);
  });
}

function FlightCard({ flight, onBook }: {
  flight: FlightOption;
  onBook: (fare: FareOption) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [seats, setSeats] = useState<SeatOption[] | null>(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const fares = showAll ? flight.fares : flight.fares.slice(0, 4);
  const hours = Math.floor(flight.durationMinutes / 60);
  const minutes = flight.durationMinutes % 60;

  return (
    <article className="flight-card">
      <div className="flight-head">
        <span className="flight-no">{flight.flightNo}</span>

        <div className="flight-route">
          <span>
            {flight.departureTime.slice(0, 5)}
            <small>{flight.origin}</small>
          </span>
          <span className="flight-line" />
          <span className="flight-duration">
            {hours}h {minutes.toString().padStart(2, "0")}m
          </span>
          <span className="flight-line" />
          <span>
            {flight.arrivalTime.slice(0, 5)}
            <small>{flight.destination}</small>
          </span>
        </div>

        <div className="flight-tags">
          <StatusChip status={flight.status} delay={flight.delayMinutes} />
          <span className="chip chip-muted">{flight.aircraft}</span>
          {flight.gate && <span className="chip chip-muted">Gate {flight.gate}</span>}
          {flight.mealAvailability && (
            <span className="chip chip-muted">
              {flight.mealAvailability.mealService
                ? `${flight.mealAvailability.availableCodes.length} special meals`
                : "No meal service"}
            </span>
          )}
        </div>
      </div>

      <div className="fare-grid">
        {fares.map((fare) => (
          <div
            key={fare.fareClass}
            className={`fare ${fare.seatsAvailable === 0 ? "sold-out" : ""}`}
          >
            <div className="fare-brand">
              {fare.fareBrand}
              <span className="fare-class">{fare.fareClass}</span>
            </div>
            <div className="fare-price">{inr.format(fare.totalFare)}</div>
            <div className="fare-detail">
              {fare.checkedBaggageKg} kg checked &middot; {fare.cabinBaggageKg} kg cabin
              <br />
              {fare.refundable ? "Refundable" : "Non-refundable"}
              {fare.changeable ? "" : " · no changes"}
              <br />
              {fare.seatsAvailable === 0 ? (
                <span style={{ color: "var(--danger)" }}>Sold out</span>
              ) : (
                <span>{fare.seatsAvailable} seats left</span>
              )}
            </div>
            <button className="fare-book" disabled={fare.seatsAvailable === 0}
              onClick={() => onBook(fare)}>
              {fare.seatsAvailable === 0 ? "Unavailable" : "Select fare"}
            </button>
          </div>
        ))}
      </div>

      {flight.fares.length > 4 && (
        <button className="evidence-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer fares" : `Show all ${flight.fares.length} fares`}
        </button>
      )}
      <div className="flight-card-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            if (seats) {
              setSeats(null);
              return;
            }
            setSeatBusy(true);
            try {
              setSeats(await api.seatMap(flight.flightInstanceId));
            } finally {
              setSeatBusy(false);
            }
          }}
          disabled={seatBusy}
        >
          {seatBusy ? <span className="spinner" /> : null}
          {seats ? "Close seat map" : "View seats"}
        </button>
      </div>
      {seats && <SeatMap seats={seats} />}
    </article>
  );
}

function StatusChip({ status, delay }: { status: string; delay: number }) {
  if (status === "CANCELLED") return <span className="chip chip-danger">Cancelled</span>;
  if (status === "DELAYED") return <span className="chip chip-warn">Delayed {delay}m</span>;
  return <span className="chip chip-ok">On time</span>;
}
