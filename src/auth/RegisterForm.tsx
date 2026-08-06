import { useState } from "react";
import { AlertIcon } from "../components/Icons";
import type { UserProfile } from "../types";
import { useAuth } from "./AuthContext";

export default function RegisterForm({
  onSuccess,
}: {
  onSuccess: (user: UserProfile) => void;
}) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (password !== passwordConfirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await register({
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        passwordConfirmation,
      });
      onSuccess(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account creation failed.");
      setBusy(false);
    }
  }

  return (
    <form
      className="login-form register-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="passenger-only-note">
        New accounts are Passenger accounts. Staff and Admin access is provisioned separately.
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          <AlertIcon size={15} />
          <span>{error}</span>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="register-name">Full name</label>
        <input id="register-name" className="input" autoComplete="name"
          value={displayName} onChange={(event) => setDisplayName(event.target.value)}
          minLength={2} required />
      </div>
      <div className="field">
        <label className="label" htmlFor="register-email">Email</label>
        <input id="register-email" className="input" type="email" autoComplete="email"
          value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <div className="field">
        <label className="label" htmlFor="register-phone">Phone</label>
        <input id="register-phone" className="input" type="tel" autoComplete="tel"
          value={phone} onChange={(event) => setPhone(event.target.value)} required />
      </div>
      <div className="register-passwords">
        <div className="field">
          <label className="label" htmlFor="register-password">Create password</label>
          <input id="register-password" className="input" type="password"
            autoComplete="new-password" value={password}
            onChange={(event) => setPassword(event.target.value)} minLength={10} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="register-confirm">Confirm password</label>
          <input id="register-confirm" className="input" type="password"
            autoComplete="new-password" value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            minLength={10} required />
        </div>
      </div>
      <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
        {busy ? <span className="spinner" /> : null}
        {busy ? "Creating account…" : "Create Passenger account"}
      </button>
    </form>
  );
}
