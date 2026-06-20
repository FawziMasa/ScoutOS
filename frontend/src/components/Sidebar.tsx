import { NavLink } from "react-router-dom";
import Icon from "./Icon";

const links = [
  { path: "/dashboard", label: "Overview", icon: "dashboard" as const },
  { path: "/scouts", label: "Scouts", icon: "scouts" as const },
  { path: "/events", label: "Events", icon: "events" as const },
  { path: "/attendance", label: "Attendance", icon: "attendance" as const },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

function Sidebar({ open, onClose }: SidebarProps) {
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
