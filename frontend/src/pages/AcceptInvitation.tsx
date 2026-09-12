import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import "./Login.css";

type InvitationDetails = {
  fullName: string;
  username: string;
  expiresAt: string;
};

function AcceptInvitation() {
  const [urlToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [token] = useState(() => urlToken || sessionStorage.getItem("invitationToken") || "");
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(() => token ? "" : "This invitation link is invalid or incomplete.");
  const [checking, setChecking] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (urlToken) {
      sessionStorage.setItem("invitationToken", urlToken);
      window.history.replaceState({}, document.title, "/accept-invitation");
    }
    if (!token) return;
    api.invitationStatus(token)
      .then(({ invitation }) => setDetails(invitation))
      .catch((statusError) => {
        sessionStorage.removeItem("invitationToken");
        setError(statusError instanceof Error ? statusError.message : "This invitation is invalid or has expired.");
      })
      .finally(() => setChecking(false));
  }, [token, urlToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    try {
      setSubmitting(true);
      await api.acceptInvitation(token, password, confirmPassword);
      sessionStorage.removeItem("invitationToken");
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to activate this account.");
    } finally {
      setSubmitting(false);
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
            <span className="auth-heading-icon"><Icon name="users" size={25} /></span>
            <span className="eyebrow">Scout invitation</span>
            <h2>{success ? "Account activated" : "Choose your password"}</h2>
            <p>{details ? `Welcome ${details.fullName}. Your username is ${details.username}.` : "Validate your invitation and activate your Scout account."}</p>
          </div>

          {error && <div className="form-error">{error}</div>}
          {checking ? (
            <p className="auth-switch">Checking invitation…</p>
          ) : success ? (
            <div className="success-message">
              <span><Icon name="check" /></span>
              <div><strong>Welcome to ScoutOS</strong><p>Your private password is set. You can sign in now.</p></div>
            </div>
          ) : details ? (
            <>
              <label className="field"><span>New password</span><input autoComplete="new-password" minLength={8} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label className="field"><span>Confirm new password</span><input autoComplete="new-password" minLength={8} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              <button className="button button-primary button-full" disabled={submitting} type="submit">{submitting ? "Activating…" : "Activate account"}<Icon name="chevron" size={18} /></button>
            </>
          ) : null}
          <p className="auth-switch"><Link to="/">Back to sign in</Link></p>
        </form>
      </section>
    </main>
  );
}

export default AcceptInvitation;
