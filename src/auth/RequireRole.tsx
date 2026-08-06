import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldIcon } from "../components/Icons";
import type { RoleName } from "../types";
import { useAuth } from "./AuthContext";

/**
 * Route guard.
 *
 * <p>This keeps the interface coherent; it is not the security boundary. Every
 * protected endpoint is independently authorised on the server, so a user who
 * navigates straight to a protected workspace gains nothing beyond a refusal.
 */
export default function RequireRole({
  allow,
  children,
}: {
  allow: RoleName[];
  children: ReactNode;
}) {
  const { user, isAuthenticated, homeFor } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allow.includes(user.role)) {
    return (
      <div className="center-page">
        <ShieldIcon size={30} className="muted" />
        <h2 style={{ margin: 0 }}>Not available for your role</h2>
        <p className="muted" style={{ margin: 0, maxWidth: 420, textAlign: "center" }}>
          You are signed in as {user.roleDisplayName}. This area is limited to{" "}
          {allow.map(label).join(" and ")}.
        </p>
        <a className="btn btn-ghost" href={homeFor(user.role)}>
          Back to your workspace
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

function label(role: RoleName): string {
  if (role === "AIRLINE_STAFF") return "Airline Staff";
  if (role === "ADMIN") return "Admin";
  return "Passenger";
}
