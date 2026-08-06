import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AlertIcon, CheckIcon, PlaneIcon } from "../components/Icons";
import type { DemoUser } from "../types";
import { useAuth } from "./AuthContext";
import RegisterForm from "./RegisterForm";

const HIGHLIGHTS = [
  ["Grounded", "Every policy answer links back to an approved source."],
  ["Connected", "Live tools handle flights, bookings, check-in and operations."],
  ["Controlled", "Role boundaries and confirmation steps stay enforced."],
];

export default function LoginPage() {
  const { signIn, homeFor } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const visibleDemoUsers = demoUsers.filter(
    (demo, index, all) => all.findIndex((candidate) => candidate.role === demo.role) === index,
  );
  const passengerDemoUsers = demoUsers.filter((demo) => demo.role === "PASSENGER");

  useEffect(() => {
    api.demoUsers().then(setDemoUsers).catch(() => setDemoUsers([]));
  }, []);

  async function submit(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(nextEmail, nextPassword);
      navigate(homeFor(user.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  function fillDemo(demo: DemoUser) {
    setSelectedRole(demo.role);
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  }

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="brand">
          <span className="brand-mark"><PlaneIcon size={16} /></span>
          <span className="brand-text">
            UnitedAir <span className="brand-ai">AI</span>
          </span>
        </div>
        <span className="login-security">
          <span className="login-security-dot" />
          Secure demonstration workspace
        </span>
      </header>

      <main className="login-layout">
        <section className="login-hero">
          <div className="login-hero-body">
            <p className="login-eyebrow">Travel intelligence, grounded in policy</p>
            <h1 className="login-title">
              Clear answers for every <em>journey</em> and operation.
            </h1>
            <p className="login-sub">
              Search flights, service bookings and resolve airline-policy questions in one
              trusted workspace built for passengers and operations teams.
            </p>

            <div className="login-route-card" aria-hidden="true">
              <div className="route-airports">
                <span><strong>BLR</strong><small>Bengaluru</small></span>
                <span className="route-flight-line">
                  <i />
                  <PlaneIcon size={19} />
                  <i />
                </span>
                <span><strong>DEL</strong><small>New Delhi</small></span>
              </div>
              <div className="route-caption">
                <span>One assistant</span>
                <span>Verified live data</span>
                <span>Cited policy</span>
              </div>
            </div>

            <div className="login-highlights">
              {HIGHLIGHTS.map(([title, detail], index) => (
                <article key={title} style={{ animationDelay: `${120 + index * 80}ms` }}>
                  <span className="highlight-check"><CheckIcon size={14} /></span>
                  <div><strong>{title}</strong><p>{detail}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="login-access" aria-labelledby="sign-in-title">
          <div className="login-card">
            <div className="login-card-head">
              <p className="login-kicker">Welcome back</p>
              <h2 id="sign-in-title">Choose your workspace</h2>
              <p>Select a role to fill its demo credentials, then sign in.</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Passenger account access">
              <button type="button" role="tab" aria-selected={mode === "signin"}
                className={mode === "signin" ? "active" : ""}
                onClick={() => setMode("signin")}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}>Create Passenger account</button>
            </div>

            {mode === "register" ? (
              <RegisterForm onSuccess={(user) =>
                navigate(homeFor(user.role), { replace: true })} />
            ) : (
              <>
            {visibleDemoUsers.length > 0 && (
              <div className="demo-list" aria-label="Demonstration roles">
                {visibleDemoUsers.map((demo) => {
                  const selected = selectedRole === demo.role;
                  return (
                    <button
                      key={demo.email}
                      type="button"
                      className={`demo-btn ${selected ? "selected" : ""}`}
                      data-role={demo.role}
                      aria-label={`${roleLabel(demo.role)} demo: ${demo.displayName}`}
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => {
                        setSelectedRole(demo.role);
                        setError(null);
                        if (demo.role === "PASSENGER" && passengerDemoUsers.length > 1) {
                          setEmail("");
                          setPassword("");
                        } else {
                          fillDemo(demo);
                        }
                      }}
                    >
                      <span className="demo-avatar">{initials(demo.displayName)}</span>
                      <span className="demo-meta">
                        <strong>{roleLabel(demo.role)}</strong>
                        <span>{roleDescription(demo.role)}</span>
                      </span>
                      <span className="demo-select" aria-hidden="true">
                        {selected ? <CheckIcon size={14} /> : "→"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedRole === "PASSENGER" && passengerDemoUsers.length > 1 && (
              <div className="passenger-demo-accounts" aria-label="Passenger demo accounts">
                <span>Choose a demonstration Passenger</span>
                <div>
                  {passengerDemoUsers.map((demo) => (
                    <button key={demo.email} type="button"
                      className={email === demo.email ? "selected" : ""}
                      aria-pressed={email === demo.email}
                      onClick={() => fillDemo(demo)}>
                      <span className="demo-avatar">{initials(demo.displayName)}</span>
                      <span><strong>{demo.displayName}</strong><small>{demo.email}</small></span>
                      <span aria-hidden="true">
                        {email === demo.email ? <CheckIcon size={13} /> : "\u2192"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="login-divider"><span>or use your credentials</span></div>

            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(email, password);
              }}
            >
              {error && (
                <div className="alert alert-error" role="alert">
                  <AlertIcon size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="username"
                  placeholder="you@unitedair.demo"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRole(null);
                  }}
                  required
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedRole(null);
                  }}
                  required
                />
              </div>

              <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
                {busy ? <span className="spinner" /> : null}
                {busy ? "Signing in…" : "Continue to UnitedAir AI"}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="login-privacy">
              Demo credentials stay on this machine. Role access is enforced by the server.
            </p>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="login-foot">
        <span>UnitedAir AI</span>
        <span>Smart Flight Booking Assistant · SRS v1.0</span>
      </footer>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function roleLabel(role: string): string {
  if (role === "AIRLINE_STAFF") return "Airline staff";
  if (role === "ADMIN") return "Administrator";
  return "Passenger";
}

function roleDescription(role: string): string {
  if (role === "AIRLINE_STAFF") return "Operations, policy and servicing";
  if (role === "ADMIN") return "Knowledge, quality and governance";
  return "Travel, bookings and support";
}
