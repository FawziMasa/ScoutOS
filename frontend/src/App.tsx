import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import AppLayout from "./components/AppLayout";
import AttendanceHistory from "./pages/AttendanceHistory";
import Attendance from "./pages/Attendance";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Finance from "./pages/Finance";
import ForgotPassword from "./pages/ForgotPassword";
import Gallery from "./pages/Gallery";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Scouts from "./pages/Scouts";
import Users from "./pages/Users";
import ScoutPortal from "./pages/ScoutPortal";
import { getStoredUser, getToken, type UserRole } from "./lib/api";
import type { ReactNode } from "react";

function ProtectedRoute() {
  return getToken() ? <AppLayout /> : <Navigate to="/" replace />;
}

function RolePage({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const user = getStoredUser();
  return user && allowed.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scouts" element={<RolePage allowed={["ADMIN", "GROUP_LEADER", "UNIT_LEADER"]}><Scouts /></RolePage>} />
          <Route path="/my-profile" element={<RolePage allowed={["SCOUT"]}><ScoutPortal /></RolePage>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/finance" element={<RolePage allowed={["ADMIN", "GROUP_LEADER", "UNIT_LEADER"]}><Finance /></RolePage>} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/attendance" element={<RolePage allowed={["ADMIN", "GROUP_LEADER", "UNIT_LEADER"]}><Attendance /></RolePage>} />
          <Route path="/attendance-history" element={<RolePage allowed={["ADMIN", "GROUP_LEADER", "UNIT_LEADER"]}><AttendanceHistory /></RolePage>} />
          <Route path="/users" element={<RolePage allowed={["ADMIN"]}><Users /></RolePage>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
