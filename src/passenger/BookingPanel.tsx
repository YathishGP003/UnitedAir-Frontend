import { useEffect, useState } from "react";
import { api, ApiError, downloadFile } from "../api/client";
import {
  AlertIcon,
  BookIcon,
  CheckIcon,
  CloseIcon,
  PlaneIcon,
  SearchIcon,
} from "../components/Icons";
import type {
  ActionView,
  BookingView,
  FlightSearchResult,
  OwnedBookingView,
  ProposeActionInput,
  RefundCaseView,
  RefundQuote,
  SeatOption,
} from "../types";
import SeatMap from "./SeatMap";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * FR-004, FR-005, FR-007 — retrieve a booking, see its fare conditions, and act on it.
 *
 * <p>Cancelling and checking in go through the two-phase flow of SRS 4.2.3: the card shows
 * exactly what will happen and which policy governs it, and nothing changes until the
 * confirm button is pressed.
 */
export default function BookingPanel() {
  const [pnr, setPnr] = useState("");
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [pending, setPending] = useState<ActionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seats, setSeats] = useState<SeatOption[] | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<SeatOption | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(
    new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10),
  );
  const [rescheduleOptions, setRescheduleOptions] = useState<FlightSearchResult | null>(null);
  const [owned, setOwned] = useState<OwnedBookingView[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [refundCases, setRefundCases] = useState<RefundCaseView[]>([]);

  async function loadOwned() {
    setOwnedLoading(true);
    try {
      setOwned(await api.ownedBookings());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your bookings.");
    } finally {
      setOwnedLoading(false);
    }
  }

  async function loadRefunds() {
    try {
      setRefundCases(await api.passengerRefundCases());
    } catch {
      setRefundCases([]);
    }
  }

  useEffect(() => {
    void loadOwned();
    void loadRefunds();
  }, []);

  async function lookup(reference: string) {
    const clean = reference.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("A booking reference is six characters, for example B6X9K2.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setPending(null);
    try {
      const found = await api.booking(clean);
      setBooking(found);
      setQuote(await api.refundQuote(clean).catch(() => null));
    } catch (e) {
      setBooking(null);
      setQuote(null);
      setError(e instanceof ApiError ? e.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function propose(
    type: ProposeActionInput["type"],
    details: Partial<ProposeActionInput> = {},
  ) {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api.createSession("booking-actions");
      setPending(await api.proposeAction({
        type,
        pnr: booking.pnr,
        sessionId: session.sessionUuid,
        ...details,
      }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That action is not available.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSeats() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const flights = await api.searchFlights(
        booking.origin,
        booking.destination,
        booking.flightDate,
      );
      const instance = flights.flights.find((flight) => flight.flightNo === booking.flightNo);
      if (!instance) throw new Error("The seat map for this booking is unavailable.");
      setSeats(await api.seatMap(instance.flightInstanceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the seat map.");
    } finally {
      setBusy(false);
    }
  }

  async function searchReschedule() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      setRescheduleOptions(await api.searchFlights(
        booking.origin,
        booking.destination,
        rescheduleDate,
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find alternate flights.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const settled = await api.confirmAction(pending.actionUuid);
      setPending(null);
      await lookup(booking!.pnr);
      await loadOwned();
      await loadRefunds();
      setNotice(String(settled.result?.message ?? "Done."));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not complete that action.");
    } finally {
      setBusy(false);
    }
  }

  const refundCase = booking
    ? refundCases.find((item) => item.pnr === booking.pnr) ?? null
    : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My bookings</h1>
          <p>Your tickets, journey documents and secure self-service actions.</p>
        </div>
      </div>

      <section className="owned-trips" aria-label="Your bookings">
        {ownedLoading && <div className="owned-trip-loading"><span className="spinner" /> Loading your trips…</div>}
        {!ownedLoading && owned.length === 0 && (
          <div className="panel-empty"><PlaneIcon size={22} /> You have no bookings yet.</div>
        )}
        {owned.map((trip) => (
          <button key={trip.pnr} className={`owned-trip ${booking?.pnr === trip.pnr ? "active" : ""}`}
            onClick={() => { setPnr(trip.pnr); void lookup(trip.pnr); }}>
            <span className="owned-trip-date">
              <strong>{new Date(`${trip.flightDate}T00:00:00`).toLocaleDateString([], { day: "2-digit" })}</strong>
              <small>{new Date(`${trip.flightDate}T00:00:00`).toLocaleDateString([], { month: "short" })}</small>
            </span>
            <span className="owned-trip-main">
              <strong>{trip.origin} <i>→</i> {trip.destination}</strong>
              <small>{trip.flightNo} · {trip.fareBrand} · {trip.pnr}</small>
            </span>
            <span className={`chip ${trip.status === "CONFIRMED" ? "chip-ok" : "chip-muted"}`}>{trip.status.replace("_", " ")}</span>
          </button>
        ))}
      </section>

      <div className="search-bar">
        <div className="field" style={{ flex: 1 }}>
          <label className="label">Booking reference (PNR)</label>
          <input
            className="input mono"
            placeholder="B6X9K2"
            maxLength={6}
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void lookup(pnr)}
          />
        </div>
        <button className="btn btn-primary search-go" onClick={() => void lookup(pnr)} disabled={busy}>
          {busy ? <span className="spinner" /> : <SearchIcon size={15} />} Find
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <CheckIcon size={15} />
          <span>{notice}</span>
        </div>
      )}

      {!booking && !error && (
        <div className="panel-empty">
          <BookIcon size={24} />
          <p style={{ marginTop: 10 }}>Enter a reference above to see an itinerary.</p>
        </div>
      )}

      {booking && (
        <>
          <article className="booking-card">
            <header className="booking-head">
              <div>
                <span className="booking-pnr mono">{booking.pnr}</span>
                <h2>{booking.passengerName}</h2>
              </div>
              <StatusBadge status={booking.status} />
            </header>

            <div className="booking-route">
              <div>
                <strong>{booking.departureTime.slice(0, 5)}</strong>
                <span>{booking.origin}</span>
              </div>
              <div className="booking-line">
                <span className="chip chip-muted">{booking.flightNo}</span>
              </div>
              <div>
                <strong>{booking.arrivalTime.slice(0, 5)}</strong>
                <span>{booking.destination}</span>
              </div>
            </div>

            <dl className="kv booking-kv">
              <dt>Date</dt>
              <dd>{booking.flightDate}</dd>
              <dt>Cabin and fare</dt>
              <dd>
                {booking.cabin} &middot; {booking.fareBrand} ({booking.fareClass})
              </dd>
              <dt>Flight status</dt>
              <dd>
                {booking.flightStatus}
                {booking.delayMinutes > 0 && ` · delayed ${booking.delayMinutes} min`}
                {booking.gate && ` · gate ${booking.gate}`}
              </dd>
              <dt>Seat</dt>
              <dd>{booking.seatNumber ?? "Not selected"}</dd>
              <dt>Checked baggage</dt>
              <dd>{booking.checkedBaggageKg} kg</dd>
              <dt>Refundable</dt>
              <dd>{booking.refundable ? "Yes" : "No"}</dd>
              <dt>Paid</dt>
              <dd>{inr.format(booking.amountPaid)}</dd>
              {booking.refundAmount != null && (
                <>
                  <dt>Refund due</dt>
                  <dd>{inr.format(booking.refundAmount)}</dd>
                </>
              )}
            </dl>

            {booking.status === "CONFIRMED" && (
              <div className="booking-actions">
                <button className="btn btn-primary" onClick={() => void downloadFile(
                  `/commerce/bookings/${booking.pnr}/ticket.pdf`,
                  `UnitedAir-${booking.flightNo}-${booking.pnr}-ticket.pdf`,
                )}>Download ticket</button>
                {!booking.checkedIn && (
                  <button className="btn btn-ghost" onClick={() => void propose("CHECK_IN")}>
                    Check in
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => void loadSeats()}>
                  Choose seat
                </button>
                <button className="btn btn-danger" onClick={() => void propose("CANCEL_BOOKING")}>
                  Cancel booking
                </button>
                <button className="btn btn-ghost" onClick={async () => {
                  try {
                    const callback = await api.requestSupportCallback(booking.pnr);
                    setNotice(`Human callback requested. Case ${callback.caseUuid}. Your booking is still confirmed.`);
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : "Could not request a callback.");
                  }
                }}>Request human help</button>
              </div>
            )}
            {booking.status !== "CONFIRMED" && (
              <div className="booking-actions">
                <button className="btn btn-primary" onClick={() => void downloadFile(
                  `/commerce/bookings/${booking.pnr}/cancellation-receipt.pdf`,
                  `UnitedAir-${booking.pnr}-cancellation-receipt.pdf`,
                )}>Cancellation receipt</button>
                <button className="btn btn-ghost" onClick={() => void downloadFile(
                  `/commerce/bookings/${booking.pnr}/ticket.pdf`,
                  `UnitedAir-${booking.flightNo}-${booking.pnr}-ticket.pdf`,
                )}>Original ticket</button>
              </div>
            )}
          </article>

          {refundCase && (
            <section className="card passenger-refund-card" aria-label="Refund tracking">
              <div className="passenger-refund-head">
                <div>
                  <span className="metric-label mono">
                    RFD-{refundCase.caseUuid.slice(0, 8).toUpperCase()}
                  </span>
                  <h3>Refund tracking</h3>
                </div>
                <span className={`chip refund-${refundCase.status.toLowerCase()}`}>
                  {refundStatusLabel(refundCase.status)}
                </span>
              </div>
              <div className="passenger-refund-grid">
                <span><small>Estimated refund</small><strong>{inr.format(refundCase.refundAmount)}</strong></span>
                <span><small>Cancellation fee</small><strong>{inr.format(refundCase.cancellationFee)}</strong></span>
                <span><small>Payment destination</small><strong>{refundCase.maskedPayment ?? refundCase.paymentMethod ?? "Original payment method"}</strong></span>
                <span><small>Expected by</small><strong>{new Date(refundCase.dueAt).toLocaleDateString()}</strong></span>
              </div>
              <p className="muted">{refundCase.cancellationBasis}</p>
              <div className="booking-actions">
                <button className="btn btn-primary" onClick={() => void downloadFile(
                  `/commerce/bookings/${refundCase.pnr}/cancellation-receipt.pdf`,
                  `UnitedAir-${refundCase.pnr}-cancellation-receipt.pdf`,
                )}>Download cancellation receipt</button>
                {refundCase.callbackStatus ? (
                  <span className="chip chip-muted">
                    Support request: {refundCase.callbackStatus.toLowerCase()}
                  </span>
                ) : (
                  <button className="btn btn-ghost" onClick={async () => {
                    try {
                      const callback = await api.requestSupportCallback(refundCase.pnr);
                      await loadRefunds();
                      setNotice(`Callback requested. Support case ${callback.caseUuid} is pending.`);
                    } catch (reason) {
                      setError(reason instanceof Error ? reason.message : "Could not request a callback.");
                    }
                  }}>Request a callback</button>
                )}
              </div>
            </section>
          )}

          <div className="booking-timeline" aria-label="Booking timeline">
            <div className="timeline-step done"><i /><span><strong>Booked</strong><small>{new Date(booking.bookedAt).toLocaleDateString()}</small></span></div>
            <div className={`timeline-step ${booking.status === "CONFIRMED" ? "done" : ""}`}><i /><span><strong>Confirmed</strong><small>Reservation secured</small></span></div>
            <div className={`timeline-step ${booking.checkedIn ? "done" : ""}`}><i /><span><strong>Checked in</strong><small>{booking.checkedIn ? "Ready to board" : "Pending"}</small></span></div>
            <div className="timeline-step"><i /><span><strong>Departure</strong><small>{booking.flightDate}</small></span></div>
          </div>

          {booking.checkedIn && <BoardingPass booking={booking} />}

          {seats && booking.status === "CONFIRMED" && (
            <div
              className="modal-backdrop seat-dialog-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a seat"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) {
                  setSeats(null);
                  setSelectedSeat(null);
                }
              }}
            >
              <div className="seat-dialog">
                <header className="seat-dialog-head">
                  <div>
                    <span className="metric-label">{booking.flightNo}</span>
                    <h2>Seat selection</h2>
                    <p>{booking.origin} to {booking.destination}</p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setSeats(null);
                      setSelectedSeat(null);
                    }}
                    aria-label="Close seat map"
                  >
                    <CloseIcon size={18} />
                  </button>
                </header>
                <div className="seat-dialog-scroll">
                  <SeatMap
                    seats={seats}
                    selected={selectedSeat?.seatNumber}
                    onSelect={setSelectedSeat}
                  />
                </div>
                <footer className="selection-bar">
                  {selectedSeat ? (
                    <span>
                      <strong>{selectedSeat.seatNumber}</strong> · {selectedSeat.seatType.toLowerCase()}
                      {selectedSeat.extraLegroom ? " · extra legroom" : ""}
                      {" · "}
                      <span data-testid="seat-change-price">
                        {selectedSeat.feeInr > 0
                          ? `Additional charge ${inr.format(selectedSeat.feeInr)}`
                          : "Included with your fare"}
                      </span>
                    </span>
                  ) : (
                    <span className="muted">Select an available seat to continue.</span>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={!selectedSeat}
                    onClick={() => {
                      if (!selectedSeat) return;
                      setSeats(null);
                      void propose("SEAT_CHANGE", { seatNumber: selectedSeat.seatNumber });
                    }}
                  >
                    Review seat change
                  </button>
                </footer>
              </div>
            </div>
          )}

          {booking.status === "CONFIRMED" && booking.changeable && (
            <article className="card reschedule-card">
              <div>
                <span className="metric-label">Change this journey</span>
                <h3>Find another departure</h3>
                <p className="muted">Your change fee and any higher fare are shown before confirmation.</p>
              </div>
              <div className="reschedule-search">
                <input className="input" type="date" value={rescheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setRescheduleDate(event.target.value)} />
                <button className="btn btn-ghost" onClick={() => void searchReschedule()} disabled={busy}>
                  <SearchIcon size={14} /> Find flights
                </button>
              </div>
              {rescheduleOptions?.flights.map((flight) => (
                <div className="reschedule-option" key={flight.flightInstanceId}>
                  <span className="flight-no">{flight.flightNo}</span>
                  <span><strong>{flight.departureTime.slice(0, 5)}</strong> → {flight.arrivalTime.slice(0, 5)}</span>
                  <div className="reschedule-fares">
                    {flight.fares
                      .filter((fare) =>
                        fare.changeable &&
                        fare.seatsAvailable > 0 &&
                        fare.cabin.toUpperCase() === booking.cabin.toUpperCase())
                      .slice(0, 3)
                      .map((fare) => (
                        <button
                          key={fare.fareClass}
                          className="btn btn-ghost btn-sm"
                          onClick={() => void propose("RESCHEDULE_BOOKING", {
                            targetFlightInstanceId: flight.flightInstanceId,
                            targetFareClass: fare.fareClass,
                          })}
                        >
                          {fare.fareBrand} · {inr.format(fare.totalFare)}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              {rescheduleOptions && rescheduleOptions.flights.length === 0 && (
                <div className="panel-empty"><PlaneIcon size={20} /> No alternate departures found.</div>
              )}
            </article>
          )}

          {quote && booking.status === "CONFIRMED" && (
            <article className="card quote-card">
              <h3>If you cancelled now</h3>
              <dl className="kv">
                <dt>Fee band</dt>
                <dd>{quote.timingBand}</dd>
                <dt>Cancellation fee</dt>
                <dd>{inr.format(quote.cancellationFee)}</dd>
                <dt>Estimated refund</dt>
                <dd className="quote-refund">{inr.format(quote.estimatedRefund)}</dd>
              </dl>
              <p className="muted quote-basis">{quote.refundTimeline}</p>
            </article>
          )}
        </>
      )}

      {pending && (
        <ConfirmDialog
          action={pending}
          busy={busy}
          onConfirm={() => void confirm()}
          onDismiss={() => {
            void api.cancelAction(pending.actionUuid).catch(() => undefined);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function BoardingPass({ booking }: { booking: BookingView }) {
  return (
    <article className="boarding-pass" aria-label={`Simulation boarding pass for ${booking.flightNo}`}>
      <div className="boarding-main">
        <span className="metric-label">UnitedAir · boarding pass simulation</span>
        <h3>{booking.passengerName}</h3>
        <div className="boarding-route">
          <strong>{booking.origin}</strong><span>→</span><strong>{booking.destination}</strong>
        </div>
        <div className="boarding-facts">
          <span><small>Flight</small><strong>{booking.flightNo}</strong></span>
          <span><small>Date</small><strong>{booking.flightDate}</strong></span>
          <span><small>Gate</small><strong>{booking.boardingGate ?? booking.gate ?? "—"}</strong></span>
          <span><small>Seat</small><strong>{booking.seatNumber ?? "—"}</strong></span>
        </div>
      </div>
      <div className="boarding-stub"><span className="barcode" aria-hidden="true" /><strong>{booking.pnr}</strong></div>
      <p>Simulation — not a legally binding travel document.</p>
    </article>
  );
}

/** SRS 4.2.3 — the confirmation step. Nothing mutates before this is accepted. */
function ConfirmDialog({
  action,
  busy,
  onConfirm,
  onDismiss,
}: {
  action: ActionView;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const entries = Object.entries(action.summary).filter(([k]) => k !== "warning");
  const warning = action.summary.warning as string | undefined;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <h3>Please confirm</h3>
          <p>Nothing has changed yet. This is what will happen.</p>
        </div>

        <div className="modal-body">
          <dl className="kv">
            {entries.map(([key, value]) => (
              <div key={key} style={{ display: "contents" }}>
                <dt>{humanise(key)}</dt>
                <dd>{formatActionValue(key, value)}</dd>
              </div>
            ))}
          </dl>

          {warning && (
            <div className="alert alert-warn" style={{ marginTop: 14 }}>
              <AlertIcon size={15} />
              <span>{warning}</span>
            </div>
          )}

          {action.citations && action.citations.length > 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
              Governed by{" "}
              {action.citations.map((c) => `${c.documentCode} ${c.section ?? ""}`.trim()).join("; ")}
            </p>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
            Keep my booking
          </button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" /> : null} Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "chip-ok",
    REFUND_PENDING: "chip-warn",
    REFUNDED: "chip-muted",
    CANCELLED: "chip-danger",
    FLOWN: "chip-muted",
    NO_SHOW: "chip-danger",
  };
  return (
    <span className={`chip ${map[status] ?? "chip-muted"}`}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

function humanise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function formatActionValue(key: string, value: unknown): string {
  if (key === "additionalCharge" && Number(value) === 0) {
    return "Included with your fare";
  }
  if (key === "includedWithFare" && typeof value === "boolean") {
    return value ? "Yes, included with this fare" : "No, an additional charge applies";
  }
  if (typeof value === "number") return inr.format(value);
  return String(value);
}

function refundStatusLabel(status: RefundCaseView["status"]): string {
  return `Refund ${status.replaceAll("_", " ").toLowerCase()}`;
}
