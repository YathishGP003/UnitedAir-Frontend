import { useMemo, useState } from "react";
import { BookIcon } from "../components/Icons";

const allowance: Record<string, { checked: number; cabin: number }> = {
  ECONOMY_DOMESTIC: { checked: 15, cabin: 7 },
  ECONOMY_INTERNATIONAL: { checked: 25, cabin: 7 },
  BUSINESS_DOMESTIC: { checked: 35, cabin: 10 },
  BUSINESS_INTERNATIONAL: { checked: 35, cabin: 10 },
};

export default function BaggageCalculator() {
  const [cabin, setCabin] = useState("ECONOMY");
  const [route, setRoute] = useState("DOMESTIC");
  const [weight, setWeight] = useState(15);
  const [special, setSpecial] = useState("NONE");
  const policy = useMemo(() => allowance[`${cabin}_${route}`], [cabin, route]);
  const excess = Math.max(0, weight - policy.checked);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Baggage planner</h1>
          <p>Check your published allowance before you travel. No unlisted fee is estimated.</p>
        </div>
      </div>
      <div className="baggage-layout">
        <section className="baggage-form card">
          <div className="field">
            <label className="label" htmlFor="bag-cabin">Cabin</label>
            <select id="bag-cabin" className="select" value={cabin} onChange={(event) => setCabin(event.target.value)}>
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="bag-route">Route</label>
            <select id="bag-route" className="select" value={route} onChange={(event) => setRoute(event.target.value)}>
              <option value="DOMESTIC">Domestic India</option>
              <option value="INTERNATIONAL">International</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="bag-weight">Planned checked weight</label>
            <input id="bag-weight" className="input" type="number" min={0} max={250}
              value={weight} onChange={(event) => setWeight(Number(event.target.value))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="bag-special">Special item</label>
            <select id="bag-special" className="select" value={special} onChange={(event) => setSpecial(event.target.value)}>
              <option value="NONE">None</option>
              <option value="SPORT">Sports equipment</option>
              <option value="MEDICAL">Mobility or medical equipment</option>
              <option value="BATTERY">Battery-powered device</option>
            </select>
          </div>
        </section>
        <section
          className="baggage-result"
          role="status"
          aria-live="polite"
          aria-label="Baggage allowance result"
        >
          <span className="baggage-icon"><BookIcon size={20} /></span>
          <span className="metric-label">Published allowance</span>
          <strong>{policy.checked} kg checked</strong>
          <p>Plus one cabin bag up to {policy.cabin} kg.</p>
          {excess > 0 ? (
            <div className="alert alert-warn">
              Your plan is {excess} kg above this allowance. Ask the assistant for the
              applicable excess-baggage policy; this calculator will not invent a fee.
            </div>
          ) : (
            <div className="alert alert-info">Your planned weight is within the published allowance.</div>
          )}
          {special !== "NONE" && (
            <p className="baggage-note">
              {special === "BATTERY"
                ? "Battery-powered items have dangerous-goods restrictions and may need cabin carriage."
                : "Special items may require advance notice or separate handling approval."}
            </p>
          )}
          <p className="policy-source">Source: KB-AIR-003 · Baggage Allowance and Handling</p>
        </section>
      </div>
    </div>
  );
}
