import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { api, saveSession } from "../lib/api";
import "./Login.css";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.setupStatus()
      .then(({ setupRequired: required }) => setSetupRequired(required))
      .catch((setupError) => {
        setError(setupError instanceof Error ? setupError.message : "Backend is unavailable.");
        setSetupRequired(false);
      });
  }, []);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (Object.values(form).some((value) => !value.trim())) {
      setError("Please complete every field.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const result = await api.setup({
        fullName: form.fullName,
        username: form.username,
        password: form.password,
      });
      saveSession(result.token, result.user, true);
      navigate("/dashboard");
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
    setError("");
  };

  return (
    <main className="auth-page auth-page-simple">
      <section className="auth-content auth-content-wide">
        <div className="auth-mobile-brand always-visible">
          <span className="auth-brand-mark"><Icon name="shield" size={24} /></span>
          <strong>ScoutOS</strong>
        </div>

        <form className="auth-card auth-card-wide" onSubmit={handleRegister}>
          <div className="auth-heading">
            <span className="eyebrow">Initial system setup</span>
            <h2>Create the Admin account</h2>
            <p>The first account controls ScoutOS and can later create Group Leader and Unit Leader accounts.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          {setupRequired === false ? (
            <div className="success-message">
              <span><Icon name="check" /></span>
              <div>
                <strong>ScoutOS is already configured</strong>
                <p>Ask your Administrator to create an account for you.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="auth-form-grid">
                <label className="field field-wide">
                  <span>Full name</span>
                  <input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="Administrator's full name" />
                </label>
                <label className="field field-wide">
                  <span>Username</span>
                  <input autoComplete="username" value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="Choose an admin username" />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input autoComplete="new-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" />
                </label>
                <label className="field">
                  <span>Confirm password</span>
                  <input autoComplete="new-password" type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} placeholder="Repeat your password" />
                </label>
              </div>

              <button className="button button-primary button-full" disabled={loading || setupRequired === null} type="submit">
                {loading ? "Creating Admin…" : "Create Admin account"}
                <Icon name="chevron" size={18} />
              </button>
            </>
          )}

          <p className="auth-switch"><Link to="/">← Back to sign in</Link></p>
        </form>
      </section>
    </main>
  );
}

export default Register;
