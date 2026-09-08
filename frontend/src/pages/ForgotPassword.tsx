import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import "./Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request a password reset.");
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
            <h2>Reset your password</h2>
            <p>Enter your account email and we will send you instructions.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          {sent ? (
            <div className="success-message">
              <span><Icon name="check" /></span>
              <div><strong>Check your inbox</strong><p>If an account matches that email, a reset link will arrive shortly.</p></div>
            </div>
          ) : (
            <>
              <label className="field">
                <span>Email address</span>
                <input autoComplete="email" required type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" />
              </label>
              <button className="button button-primary button-full" disabled={loading} type="submit">
                {loading ? "Sending..." : "Send reset link"}
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

export default ForgotPassword;
