import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordResetEmail } from "../services/emailService.js";
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
