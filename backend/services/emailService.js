import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

const SMTP_CONNECTION_TIMEOUT_MS = 15_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 30_000;

export class EmailConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailConfigurationError";
    this.code = "SMTP_CONFIG_INVALID";
  }
}

function requiredValue(env, key) {
  const value = String(env[key] || "").trim();
  if (!value) throw new EmailConfigurationError(`${key} is required.`);
  return value;
}

function parseBoolean(value, key) {
  if (value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new EmailConfigurationError(`${key} must be true or false.`);
}

export function parseSmtpConfiguration(env = process.env) {
  const host = requiredValue(env, "SMTP_HOST");
  const port = Number(requiredValue(env, "SMTP_PORT"));
  const user = requiredValue(env, "SMTP_USER");
  const pass = requiredValue(env, "SMTP_PASS");
  const from = requiredValue(env, "EMAIL_FROM");
  const family = Number(String(env.SMTP_FAMILY || "4").trim());

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailConfigurationError("SMTP_PORT must be an integer from 1 to 65535.");
  }
  if (![4, 6].includes(family)) {
    throw new EmailConfigurationError("SMTP_FAMILY must be 4 or 6.");
  }

  const explicitSecure = parseBoolean(env.SMTP_SECURE, "SMTP_SECURE");
  return { host, port, secure: explicitSecure ?? port === 465, family, user, pass, from };
}

function emailDomain(value) {
  const address = String(value || "").match(/<([^<>]+)>/)?.[1] || String(value || "");
  const separator = address.lastIndexOf("@");
  return separator === -1 ? "invalid" : address.slice(separator + 1).trim().toLowerCase();
}

export function smtpConfigurationSummary(configuration) {
  return {
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    family: configuration.family,
    senderDomain: emailDomain(configuration.from),
    connectionTimeoutMs: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeoutMs: SMTP_GREETING_TIMEOUT_MS,
    socketTimeoutMs: SMTP_SOCKET_TIMEOUT_MS,
  };
}

export function safeEmailError(error) {
  return {
    name: String(error?.name || "Error").slice(0, 80),
    code: String(error?.code || "SMTP_UNKNOWN").slice(0, 80),
    detail: error instanceof EmailConfigurationError ? error.message : undefined,
    command: error?.command ? String(error.command).slice(0, 80) : undefined,
    responseCode: Number.isInteger(error?.responseCode) ? error.responseCode : undefined,
    errno: error?.errno ? String(error.errno).slice(0, 80) : undefined,
    syscall: error?.syscall ? String(error.syscall).slice(0, 80) : undefined,
  };
}

export function maskedEmailReference(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return {
    domain: emailDomain(normalized),
    fingerprint: createHash("sha256").update(normalized).digest("hex").slice(0, 10),
  };
}

export function configuredMailer({ env = process.env, createTransport = nodemailer.createTransport } = {}) {
  const configuration = parseSmtpConfiguration(env);
  const transporter = createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    family: configuration.family,
    auth: { user: configuration.user, pass: configuration.pass },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
  return { configuration, transporter };
}

export async function verifyEmailConfiguration(options) {
  const { configuration, transporter } = configuredMailer(options);
  try {
    await transporter.verify();
    return smtpConfigurationSummary(configuration);
  } finally {
    transporter.close?.();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createPasswordResetEmail(resetUrl) {
  const safeUrl = escapeHtml(resetUrl);
  const text = [
    "SCOUT OS",
    "",
    "Reset your password",
    "",
    "Use this link to choose a new ScoutOS password:",
    resetUrl,
    "",
    "This link expires in 30 minutes and can be used once.",
    "If you did not request a password reset, you can safely ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f4f7f4;color:#17231c;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe5dd;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 36px;background:#143c2d;color:#ffffff;"><div style="font-size:13px;font-weight:700;letter-spacing:1.5px;">SCOUT OS</div></td></tr>
          <tr><td style="padding:36px;">
            <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;color:#17231c;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#526158;">We received a request to reset your ScoutOS password. Choose a new password using the secure link below.</p>
            <p style="margin:0 0 26px;"><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;border-radius:6px;background:#216b4a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Reset Password</a></p>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#526158;">This link expires in 30 minutes and can be used once.</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#526158;">If you did not request a password reset, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendPasswordResetEmail({ to, resetUrl }, options) {
  const { configuration, transporter } = configuredMailer(options);
  const message = createPasswordResetEmail(resetUrl);
  try {
    const info = await transporter.sendMail({
      from: configuration.from,
      to,
      subject: "Reset your SCOUT OS password",
      text: message.text,
      html: message.html,
    });

    if (!Array.isArray(info.accepted) || info.accepted.length === 0) {
      const error = new Error("SMTP server did not accept the reset recipient.");
      error.code = "SMTP_RECIPIENT_NOT_ACCEPTED";
      throw error;
    }

    return { acceptedCount: info.accepted.length, rejectedCount: info.rejected?.length || 0 };
  } finally {
    transporter.close?.();
  }
}
