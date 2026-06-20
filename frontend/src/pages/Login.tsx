import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import backgroundImage from "../assets/login-bg.png";
import Icon from "../components/Icon";
import { api, saveSession } from "../lib/api";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password to continue.");
      return;
    }

    try {
      setLoading(true);
      const result = await api.login(username, password);
      saveSession(result.token, result.user, rememberMe);
      navigate("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-photo-page" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="login-photo-overlay" />

      <section className="login-photo-card">
        <div className="auth-mobile-brand login-card-brand">
          <span className="auth-brand-mark"><Icon name="shield" size={24} /></span>
          <span>
            <strong>ScoutOS</strong>
            <small>Sweifieh Group</small>
          </span>
        </div>

        <form className="auth-card" onSubmit={handleLogin}>
          <div className="auth-heading">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to ScoutOS</h2>
            <p>Manage your group with clarity and confidence.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          <label className="field">
            <span>Username</span>
            <input autoComplete="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="Enter your username" />
          </label>

          <label className="field">
            <span>Password</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" />
          </label>

          <div className="auth-options">
            <label className="checkbox">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="button button-primary button-full" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
            <Icon name="chevron" size={18} />
          </button>

          <p className="auth-switch">New to ScoutOS? <Link to="/register">Create an account</Link></p>
          <p className="demo-note">Made By Fawzi Masannat.</p>
        </form>
      </section>
    </main>
  );
}

export default Login;
