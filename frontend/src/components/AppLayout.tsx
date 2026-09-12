import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { api, clearSession, getStoredUser, updateStoredUser, type AuthUser } from "../lib/api";

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(({ user: currentUser }) => {
      updateStoredUser(currentUser);
      setUser(currentUser);
    }).catch(() => {
      clearSession();
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      <div className="app-main">
        <Navbar onMenu={() => setSidebarOpen(true)} user={user} />

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
