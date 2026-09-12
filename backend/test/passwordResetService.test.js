import assert from "node:assert/strict";
import test from "node:test";
import {
  configuredMailer,
  createPasswordResetEmail,
  parseSmtpConfiguration,
  safeEmailError,
  sendPasswordResetEmail,
  verifyEmailConfiguration,
} from "../services/emailService.js";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidPasswordResetToken,
  normalizeEmail,
  validateResetPassword,
} from "../services/passwordResetService.js";

test("reset tokens are random, valid, and stored as a hash", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.notEqual(first.token, second.token);
  assert.equal(isValidPasswordResetToken(first.token), true);
  assert.equal(first.tokenHash, hashPasswordResetToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.tokenHash.length, 64);
});

test("email and password input validation rejects unsafe values", () => {
  assert.equal(normalizeEmail("  Admin@ScoutOS.test "), "admin@scoutos.test");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(validateResetPassword("short"), "Password must be at least 8 characters.");
  assert.equal(validateResetPassword("valid-password"), null);
});

test("reset links and both email formats carry the expiration notice", () => {
  const { token } = createPasswordResetToken();
  const resetUrl = buildPasswordResetUrl("https://scoutos.example", token);
  const message = createPasswordResetEmail(resetUrl);

  assert.equal(new URL(resetUrl).pathname, "/reset-password");
  assert.equal(new URL(resetUrl).searchParams.get("token"), token);
  assert.match(message.text, /expires in 30 minutes/i);
  assert.match(message.html, /expires in 30 minutes/i);
  assert.match(message.html, /Reset Password/i);
});

const smtpEnv = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USER: "mailer@example.test",
  SMTP_PASS: "test-only-password",
  EMAIL_FROM: "ScoutOS <mailer@example.test>",
};

test("SMTP configuration requires every delivery setting and derives TLS safely", () => {
  assert.equal(parseSmtpConfiguration(smtpEnv).secure, false);
  assert.equal(parseSmtpConfiguration(smtpEnv).family, 4);
  assert.equal(parseSmtpConfiguration({ ...smtpEnv, SMTP_PORT: "465" }).secure, true);
  assert.equal(parseSmtpConfiguration({ ...smtpEnv, SMTP_SECURE: "YES" }).secure, true);
  assert.equal(parseSmtpConfiguration({ ...smtpEnv, SMTP_FAMILY: "6" }).family, 6);
  assert.throws(
    () => parseSmtpConfiguration({ ...smtpEnv, SMTP_PORT: "not-a-port" }),
    /SMTP_PORT/,
  );
  assert.throws(
    () => parseSmtpConfiguration({ ...smtpEnv, SMTP_PASS: "" }),
    /SMTP_PASS is required/,
  );
  assert.throws(
    () => parseSmtpConfiguration({ ...smtpEnv, SMTP_FAMILY: "5" }),
    /SMTP_FAMILY/,
  );
});

test("SMTP transport has bounded timeouts and never exposes credentials in summaries", () => {
  let transportOptions;
  configuredMailer({
    env: smtpEnv,
    createTransport(options) {
      transportOptions = options;
      return {};
    },
  });

  assert.equal(transportOptions.host, smtpEnv.SMTP_HOST);
  assert.equal(transportOptions.port, 587);
  assert.equal(transportOptions.secure, false);
  assert.equal(transportOptions.family, 4);
  assert.equal(transportOptions.connectionTimeout, 15_000);
  assert.equal(transportOptions.greetingTimeout, 10_000);
  assert.equal(transportOptions.socketTimeout, 30_000);
  assert.equal(JSON.stringify(safeEmailError(new Error("secret detail"))).includes("secret detail"), false);
});

test("SMTP verification checks authentication and closes its transport", async () => {
  let verified = false;
  let closed = false;
  const summary = await verifyEmailConfiguration({
    env: smtpEnv,
    createTransport: () => ({
      async verify() { verified = true; },
      close() { closed = true; },
    }),
  });

  assert.equal(verified, true);
  assert.equal(closed, true);
  assert.equal(summary.host, smtpEnv.SMTP_HOST);
  assert.equal(JSON.stringify(summary).includes(smtpEnv.SMTP_PASS), false);
  assert.equal(JSON.stringify(summary).includes(smtpEnv.SMTP_USER), false);
});

test("email sending rejects missing config and recipients not accepted by SMTP", async () => {
  await assert.rejects(
    sendPasswordResetEmail(
      { to: "recipient@example.test", resetUrl: "https://scoutos.example/reset-password?token=test" },
      { env: {} },
    ),
    /SMTP_HOST is required/,
  );

  await assert.rejects(
    sendPasswordResetEmail(
      { to: "recipient@example.test", resetUrl: "https://scoutos.example/reset-password?token=test" },
      {
        env: smtpEnv,
        createTransport: () => ({
          async sendMail() { return { accepted: [], rejected: ["recipient@example.test"] }; },
          close() {},
        }),
      },
    ),
    (error) => error.code === "SMTP_RECIPIENT_NOT_ACCEPTED",
  );
});
