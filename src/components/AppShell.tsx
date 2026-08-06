import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LogoutIcon, PlaneIcon } from "./Icons";
import MobileNav from "./MobileNav";

export interface ShellTab {
  to: string;
  label: string;
  icon: ReactNode;
}

/**
 * Header, role-scoped navigation and sign-out.
 *
 * <p>Navigation lists only what this role owns. An Admin sees Knowledge Base sections and
 * nothing else; there is no route into the passenger workspace for them to find.
 */
export default function AppShell({
  tabs,
  children,
}: {
  tabs: ShellTab[];
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <PlaneIcon size={16} />
          </span>
          <span className="brand-text">
            UnitedAir <span className="brand-ai">AI</span>
          </span>
        </div>

        <nav className="topnav" aria-label="Primary navigation">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="user-identity" title={user.email}>
            <span className="user-avatar">{initials(user.displayName)}</span>
            <span className="user-identity-text">
              <strong>{user.displayName}</strong>
              <span>{user.roleDisplayName}</span>
            </span>
          </div>
          <button
            className="topbar-signout"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => {
              void signOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogoutIcon size={15} />
          </button>
        </div>
      </header>

      <main id="main-content">{children}</main>
      <MobileNav tabs={tabs} />
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
