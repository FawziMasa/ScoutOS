import { NavLink } from "react-router-dom";
import Icon from "./Icon";
import type { AuthUser } from "../lib/api";

const commonLinks = [
  { path: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { path: "/events", label: "Events", icon: "events" as const },
  { path: "/gallery", label: "Gallery", icon: "image" as const },
  { path: "/leaderboard", label: "Leaderboard", icon: "shield" as const },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
};

function Sidebar({ open, onClose, user }: SidebarProps) {
  const isScout = user?.role === "SCOUT";
  const isLeader = Boolean(user && user.role !== "SCOUT");
  const links = [
    ...commonLinks.slice(0, 1),
    ...(isScout
      ? [{ path: "/my-profile", label: "My Profile", icon: "scouts" as const }]
      : [{ path: "/scouts", label: "Scouts", icon: "scouts" as const }]),
    ...commonLinks.slice(1),
    ...(isLeader
      ? [
          { path: "/attendance", label: "Attendance", icon: "attendance" as const },
          { path: "/attendance-history", label: "Attendance History", icon: "calendar" as const },
          { path: "/finance", label: "Finance & Procurement", icon: "wallet" as const },
        ]
      : []),
  ];

  return (
    <>
      <button
        aria-label="Close navigation"
        className={`sidebar-overlay ${open ? "is-open" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Icon name="shield" size={25} />
          </span>
          <span>
            <strong>ScoutOS</strong>
            <small>Sweifieh Group</small>
          </span>
        </div>

        <p className="sidebar-label">Workspace</p>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
              <Icon name="chevron" size={15} />
            </NavLink>
          ))}
          {user?.role === "ADMIN" && (
            <NavLink
              to="/users"
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon name="users" />
              <span>Manage Accounts</span>
              <Icon name="chevron" size={15} />
            </NavLink>
          )}
        </nav>


        <div className="sidebar-card">
          <span className="sidebar-card-icon">
            <Icon name="sparkles" size={18} />
          </span>
          <strong>Shape tomorrow</strong>
          <p>Every meeting builds a stronger generation.</p>
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          All systems operational
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
