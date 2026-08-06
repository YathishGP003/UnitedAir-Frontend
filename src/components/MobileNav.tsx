import { NavLink } from "react-router-dom";
import type { ShellTab } from "./AppShell";

export default function MobileNav({ tabs }: { tabs: ShellTab[] }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
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
  );
}
