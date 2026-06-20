import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import "./Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.includes("@")) setSent(true);
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

          {sent ? (
            <div className="success-message">
              <span><Icon name="check" /></span>
              <div><strong>Check your inbox</strong><p>Reset instructions were sent to {email}.</p></div>
            </div>
          ) : (
            <>
              <label className="field">
                <span>Email address</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <button className="button button-primary button-full" type="submit">Send reset link <Icon name="chevron" size={18} /></button>
            </>
          )}

          <p className="auth-switch"><Link to="/">← Back to sign in</Link></p>
        </form>
      </section>
    </main>
  );
}

export default ForgotPassword;
