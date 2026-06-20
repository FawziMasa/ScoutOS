import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { clearSession, getStoredUser, roleLabel } from "../lib/api";

type NavbarProps = {
  onMenu: () => void;
};

function Navbar({ onMenu }: NavbarProps) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.fullName || user?.username || "User";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const formattedDate = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  return (
    <header className="navbar">
      <div className="navbar-start">
        <button aria-label="Open navigation" className="menu-button" onClick={onMenu}>
          <Icon name="menu" />
        </button>
        <div>
          <span className="navbar-eyebrow">Al-Sweifieh Scout Group</span>
          <strong className="navbar-date">{formattedDate}</strong>
        </div>
      </div>

      <div className="navbar-actions">
        <div className="profile">
          <span className="avatar">{initials}</span>
          <span className="profile-copy">
            <strong>{displayName}</strong>
            <small>{user ? roleLabel(user.role) : "Signed-in user"}</small>
          </span>
        </div>

        <button className="icon-button logout-button" onClick={handleLogout} title="Log out">
          <Icon name="logout" />
          <span>Log out</span>
        </button>
      </div>
    </header>
  );
}

export default Navbar;
