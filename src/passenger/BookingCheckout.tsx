import { useEffect, useRef, useState } from "react";
import { api, ApiError, downloadFile } from "../api/client";
import { AlertIcon, CheckIcon, PlaneIcon } from "../components/Icons";
import type {
  BookingDraft, FareOption, FlightOption, PaymentView, SeatOption, TicketView,
} from "../types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

export default function BookingCheckout({
  flight, fare, draft: suppliedDraft, onClose,
}: {
  flight: FlightOption;
  fare: FareOption;
  draft?: BookingDraft | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BookingDraft | null>(suppliedDraft ?? null);
  const [seats, setSeats] = useState<SeatOption[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatOption | null>(null);
  const [step, setStep] = useState<"seat" | "traveller" | "payment" | "done">("seat");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [ticket, setTicket] = useState<TicketView | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"CARD" | "UPI">("CARD");
  const [cardNumber, setCardNumber] = useState("4242424242424242");
  const [cvv, setCvv] = useState("123");
  const [upi, setUpi] = useState("success@unitedair");
  const checkoutInit = useRef<{
    key: string;
    promise: Promise<{ selected: BookingDraft; available: SeatOption[] }>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setBusy(true);
      try {
        const initKey = [
          suppliedDraft?.draftUuid ?? "new",
          suppliedDraft?.version ?? 0,
          flight.flightInstanceId,
          fare.fareId,
        ].join(":");
        if (checkoutInit.current?.key !== initKey) {
          checkoutInit.current = {
            key: initKey,
            promise: (async () => {
              const started = suppliedDraft ?? await api.startBookingDraft();
              const selection = {
                origin: flight.origin, destination: flight.destination,
                travelDate: flight.flightDate, cabin: fare.cabin,
                flightInstanceId: flight.flightInstanceId, fareId: fare.fareId,
              };
              let selected: BookingDraft;
              try {
                selected = await api.updateBookingDraft(
                  started.draftUuid, selection, started.version,
                );
              } catch (reason) {
                if (!(reason instanceof ApiError) || reason.status !== 409 || !suppliedDraft) {
                  throw reason;
                }
                // A restored chat card carries the version it had when it was rendered.
                // Refresh once before applying the user's current fare choice.
                const latest = await api.bookingDraft(started.draftUuid);
                selected = await api.updateBookingDraft(
                  latest.draftUuid, selection, latest.version,
                );
              }
              const available = await api.bookingDraftSeats(selected.draftUuid);
              return { selected, available };
            })(),
          };
        }
        const { selected, available } = await checkoutInit.current.promise;
        if (active) {
          setDraft(selected);
          setSeats(available);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Checkout could not start.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [fare.cabin, fare.fareId, flight, suppliedDraft]);

  async function update(patch: Parameters<typeof api.updateBookingDraft>[1]) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(await api.updateBookingDraft(draft.draftUuid, patch, draft.version));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The booking draft changed.");
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  async function saveSeat() {
    if (!selectedSeat) {
      setError("Choose an available seat to continue.");
      return;
    }
    await update({ seatNumber: selectedSeat.seatNumber });
    setStep("traveller");
  }

  async function saveTraveller() {
    if (!fullName.trim() || !dateOfBirth || !email.trim() || !phone.trim()) {
      setError("Complete the traveller and contact details.");
      return;
    }
    await update({
      traveller: { fullName: fullName.trim(), dateOfBirth, nationality: nationality.trim() },
      contact: { email: email.trim(), phone: phone.trim() },
    });
    setStep("payment");
  }

  async function payAndConfirm() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const authorized = await api.authorizePayment({
        draftUuid: draft.draftUuid, method,
        ...(method === "CARD" ? { cardNumber, cvv } : { upi }),
        amount: fare.totalFare + (selectedSeat?.feeInr ?? 0),
        idempotencyKey: crypto.randomUUID(),
      });
      setPayment(authorized);
      if (authorized.status !== "AUTHORIZED") {
        setError(authorized.statusMessage);
        return;
      }
      const confirmed = await api.confirmBooking({
        draftUuid: draft.draftUuid, paymentUuid: authorized.paymentUuid,
        idempotencyKey: crypto.randomUUID(),
      });
      setTicket(confirmed);
      setStep("done");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = ["seat", "traveller", "payment", "done"].indexOf(step);
  const total = fare.totalFare + (selectedSeat?.feeInr ?? 0);
  return (
    <div className="checkout-backdrop" role="dialog" aria-modal="true"
      aria-label={`Book ${flight.flightNo}`}>
      <section className="checkout">
        <header className="checkout-head">
          <div>
            <span className="checkout-kicker">Secure simulated checkout</span>
            <h2>{flight.origin} <span>→</span> {flight.destination}</h2>
            <p>{flight.flightNo} · {flight.flightDate} · {fare.fareBrand}</p>
          </div>
          <button className="checkout-close" onClick={onClose} aria-label="Close checkout">×</button>
        </header>
        <ol className="checkout-steps">
          {["Seat", "Traveller", "Payment", "Ticket"].map((label, index) => (
            <li className={index <= stepIndex ? "active" : ""} key={label}>
              <span>{index < stepIndex ? <CheckIcon size={12} /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>
        {error && <div className="alert alert-error"><AlertIcon size={15} />{error}</div>}
        {busy && <div className="checkout-loading"><span className="spinner" /> Securing your selection…</div>}

        {!busy && step === "seat" && (
          <div className="checkout-body">
            <Title title="Choose your seat" detail={`Only available ${fare.cabin.toLowerCase()} seats are shown.`} />
            <div className="checkout-seat-grid">
              {seats.map((seat) => (
                <button key={seat.seatNumber}
                  aria-label={`Seat ${seat.seatNumber}, ${seat.seatType.toLowerCase()}`}
                  className={selectedSeat?.seatNumber === seat.seatNumber ? "selected" : ""}
                  onClick={() => setSelectedSeat(seat)}>
                  <strong>{seat.seatNumber}</strong><small>{seat.seatType.toLowerCase()}</small>
                  <span>{seat.feeInr
                    ? `+${inr.format(seat.feeInr)}`
                    : "Included with your fare"}</span>
                </button>
              ))}
            </div>
            <Footer fare={fare} seatFee={selectedSeat?.feeInr ?? null}
              total={total} action="Continue with seat"
              disabled={!selectedSeat} onAction={() => void saveSeat()} />
          </div>
        )}

        {!busy && step === "traveller" && (
          <form className="checkout-body" onSubmit={(event) => { event.preventDefault(); void saveTraveller(); }}>
            <Title title="Traveller details" detail="Use the name shown on government identification." />
            <div className="checkout-form-grid">
              <Field label="Full name" wide><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
              <Field label="Date of birth"><input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></Field>
              <Field label="Nationality"><input className="input" value={nationality} onChange={(e) => setNationality(e.target.value)} required /></Field>
              <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
              <Field label="Phone"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
            </div>
            <Footer fare={fare} seatFee={selectedSeat?.feeInr ?? null}
              total={total} action="Review payment" />
          </form>
        )}

        {!busy && step === "payment" && (
          <div className="checkout-body">
            <Title title="Simulated payment" detail="No real charge is made and raw payment details are never stored." />
            <div className="payment-methods">
              <button className={method === "CARD" ? "active" : ""} onClick={() => setMethod("CARD")}>Card</button>
              <button className={method === "UPI" ? "active" : ""} onClick={() => setMethod("UPI")}>UPI</button>
            </div>
            {method === "CARD" ? (
              <div className="checkout-form-grid">
                <Field label="Demo card number" wide><input className="input mono" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} /></Field>
                <Field label="CVV"><input className="input mono" type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} /></Field>
                <div className="demo-payment-tip">4242 succeeds · 0002 declines</div>
              </div>
            ) : (
              <Field label="Demo UPI ID"><input className="input" value={upi} onChange={(e) => setUpi(e.target.value)} /><small>success@unitedair succeeds</small></Field>
            )}
            <Footer fare={fare} seatFee={selectedSeat?.feeInr ?? null}
              total={total} action="Pay and issue ticket"
              onAction={() => void payAndConfirm()} />
          </div>
        )}

        {!busy && step === "done" && ticket && (
          <div className="checkout-body ticket-success">
            <span className="ticket-success-icon"><PlaneIcon size={24} /></span>
            <p className="checkout-kicker">Booking confirmed</p>
            <h3>{ticket.pnr}</h3>
            <p>{ticket.ticketNumber} · {ticket.flightNo} · Seat {ticket.seatNumber}</p>
            <div className="ticket-route"><strong>{ticket.origin}</strong><span>→</span><strong>{ticket.destination}</strong></div>
            <div className="ticket-actions">
              <button className="btn btn-primary" onClick={() => void downloadFile(
                `/commerce/bookings/${ticket.pnr}/ticket.pdf`,
                `UnitedAir-${ticket.flightNo}-${ticket.pnr}-ticket.pdf`,
              )}>Download e-ticket</button>
              <button className="btn btn-ghost" onClick={() => void downloadFile(
                `/commerce/bookings/${ticket.pnr}/payment-receipt.pdf`,
                `UnitedAir-${ticket.pnr}-payment-receipt.pdf`,
              )}>Payment receipt</button>
              <button className="btn btn-ghost" onClick={onClose}>Done</button>
            </div>
            {payment && <small>Paid with {payment.maskedAccount} · {payment.providerReference}</small>}
          </div>
        )}
      </section>
    </div>
  );
}

function Title({ title, detail }: { title: string; detail: string }) {
  return <div className="checkout-title"><h3>{title}</h3><p>{detail}</p></div>;
}

function Field({ label, wide, children }: {
  label: string; wide?: boolean; children: React.ReactNode;
}) {
  return <label className={`field${wide ? " span-2" : ""}`}><span className="label">{label}</span>{children}</label>;
}

function Footer({ fare, seatFee, total, action, disabled, onAction }: {
  fare: FareOption;
  seatFee: number | null;
  total: number;
  action: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  return <footer className="checkout-footer">
    <dl className="checkout-price-breakdown" aria-label="Price summary">
      <div data-testid="base-fare">
        <dt>Base fare</dt><dd>{inr.format(fare.baseFare)}</dd>
      </div>
      <div data-testid="taxes">
        <dt>Taxes</dt><dd>{inr.format(fare.taxes)}</dd>
      </div>
      <div data-testid="seat-fee">
        <dt>Seat fee</dt>
        <dd>{seatFee === null
          ? "Select a seat"
          : seatFee === 0 ? "Included" : inr.format(seatFee)}</dd>
      </div>
      <div data-testid="payable-total" className="checkout-total">
        <dt>Total</dt><dd>{inr.format(total)}</dd>
      </div>
    </dl>
    <button className="btn btn-primary" type={onAction ? "button" : "submit"}
      disabled={disabled} onClick={onAction}>{action} <span>→</span></button>
  </footer>;
}
