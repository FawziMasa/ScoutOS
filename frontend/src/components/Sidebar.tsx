import { NavLink } from "react-router-dom";

const links = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/scouts", label: "Scouts" },
    { path: "/events", label: "Events" },
    { path: "/attendance", label: "Attendance" },
];

function Sidebar() {
    return (
        <aside className="sidebar">
            <h1 className="sidebar-logo">ScoutOS</h1>

            <nav className="sidebar-nav">
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? "active" : ""}`
                        }
                    >
                        {link.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}

export default Sidebar;