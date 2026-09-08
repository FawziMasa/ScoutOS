import { createHash, createHmac, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_IP_LIMIT = 10;

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null;
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function hashRateLimitValue(value, secret) {
  return createHmac("sha256", secret).update(String(value)).digest("hex");
}

export function isValidPasswordResetToken(token) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(token));
}

export function validateResetPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (password.length > 256) {
    return "Password is too long.";
  }

  return null;
}

export function buildPasswordResetUrl(frontendUrl, token) {
  const url = new URL("/reset-password", frontendUrl);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("FRONTEND_URL must use http or https.");
  }
  url.searchParams.set("token", token);
  return url.toString();
}
