import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import "./Login.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token");
  const [token, setToken] = useState(urlToken || sessionStorage.getItem("resetToken") || "");

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      sessionStorage.setItem("resetToken", urlToken);
    }
  }, [urlToken]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("This reset link is invalid or incomplete.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await api.resetPassword(token, password, confirmPassword);
      setSuccess(true);
      sessionStorage.removeItem("resetToken");
      setPassword("");
      setConfirmPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page-simple">
      <section className="auth-content">
        <div className="auth-mobile-brand always-visible">
          <span className="auth-brand-mark"><Icon name="shield" size={24} /></span>
          <strong>ScoutOS</strong>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-heading">
            <span className="auth-heading-icon"><Icon name="shield" size={25} /></span>
            <span className="eyebrow">Account recovery</span>
            <h2>Choose a new password</h2>
            <p>Your reset link expires after 30 minutes and can only be used once.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          {success ? (
            <div className="success-message">
              <span><Icon name="check" /></span>
              <div><strong>Password updated</strong><p>Your password has been changed. Sign in with your new password.</p></div>
            </div>
          ) : (
            <>
              <label className="field">
                <span>New password</span>
                <input autoComplete="new-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="At least 8 characters" />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} placeholder="Repeat your new password" />
              </label>
              <button className="button button-primary button-full" disabled={loading || !token} type="submit">
                {loading ? "Updating..." : "Reset password"}
                <Icon name="chevron" size={18} />
              </button>
            </>
          )}

          <p className="auth-switch"><Link to="/">Back to sign in</Link></p>
        </form>
      </section>
    </main>
  );
}

export default ResetPassword;
