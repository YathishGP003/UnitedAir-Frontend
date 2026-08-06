import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./auth/LoginPage";
import RequireRole from "./auth/RequireRole";
import { useAuth } from "./auth/AuthContext";
import AdminWorkspace from "./admin/AdminWorkspace";
import PassengerWorkspace from "./passenger/PassengerWorkspace";
import StaffWorkspace from "./staff/StaffWorkspace";
import { useTheme } from "./theme/useTheme";

/**
 * Routing.
 *
 * <p>Each role owns exactly one workspace. SRS 2.3 defines Admin as the knowledge
 * administrator — KB upload, ingestion monitoring and access management — not as a
 * super-user who can also hold passenger conversations. Letting Admin roam the passenger
 * and staff workspaces blurred a boundary the SRS draws deliberately, so the routes are
 * now exclusive rather than cumulative.
 *
 * <p>Airline Staff retain the passenger view, because FR-016…FR-030 describe staff
 * *supporting* passengers and they need to see what a passenger would be told.
 */
export default function App() {
  useTheme();
  const { isAuthenticated, user, homeFor } = useAuth();
  const home = isAuthenticated && user ? homeFor(user.role) : "/login";

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={home} replace /> : <LoginPage />}
      />

      <Route
        path="/passenger/*"
        element={
          <RequireRole allow={["PASSENGER", "AIRLINE_STAFF"]}>
            <PassengerWorkspace />
          </RequireRole>
        }
      />

      <Route
        path="/staff/*"
        element={
          <RequireRole allow={["AIRLINE_STAFF"]}>
            <StaffWorkspace />
          </RequireRole>
        }
      />

      <Route
        path="/governance/*"
        element={
          <RequireRole allow={["ADMIN"]}>
            <AdminWorkspace />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </>
  );
}
