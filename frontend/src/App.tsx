import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import AppLayout from "./components/AppLayout";
import AttendanceHistory from "./pages/AttendanceHistory";
import Attendance from "./pages/Attendance";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import ForgotPassword from "./pages/ForgotPassword";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Scouts from "./pages/Scouts";
import { getToken } from "./lib/api";

function ProtectedRoute() {
  return getToken() ? <AppLayout /> : <Navigate to="/" replace />;
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
          <Route path="/scouts" element={<Scouts />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/attendance-history" element={<AttendanceHistory />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
