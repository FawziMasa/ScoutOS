import assert from "node:assert/strict";
import test from "node:test";
import {
  handleForgotPassword,
  handleResetPassword,
} from "../controllers/passwordResetController.js";
import { createPasswordResetToken, hashPasswordResetToken } from "../services/passwordResetService.js";

function responseCapture() {
  const result = {};
  return {
    result,
    send(_response, status, body) {
      Object.assign(result, { status, body });
      return result;
    },
  };
}

function requestFor(body) {
  return {
    headers: { "x-forwarded-for": "203.0.113.10" },
    socket: { remoteAddress: "127.0.0.1" },
    body,
  };
}

function resetConnection(account) {
  const calls = [];
  return {
    calls,
    async beginTransaction() { calls.push(["begin"]); },
    async commit() { calls.push(["commit"]); },
    async rollback() { calls.push(["rollback"]); },
    release() { calls.push(["release"]); },
    async execute(sql, values) {
      calls.push([sql, values]);
      if (sql.includes("SELECT id FROM password_reset_rate_limits")) return [[]];
      if (sql.includes("SELECT id, email FROM users")) return [[account].filter(Boolean)];
      return [{ affectedRows: 1 }];
    },
  };
}

test("forgot-password stays generic and removes a token when delivery fails", async () => {
  const request = requestFor({ email: "registered@example.test" });
  const connection = resetConnection({ id: 7, email: "registered@example.test" });
  const cleanupCalls = [];
  const logs = [];
  let attemptedUrl;
  const db = {
    async getConnection() { return connection; },
    async execute(sql, values) { cleanupCalls.push([sql, values]); return [{ affectedRows: 1 }]; },
  };
  const { result, send } = responseCapture();

  await handleForgotPassword({
    request,
    response: {},
    db,
    send,
    readJson: async (incoming) => incoming.body,
    tokenSecret: "test-rate-limit-secret",
    frontendUrl: "https://scout-os-bay.vercel.app",
    async deliverResetEmail({ resetUrl }) {
      attemptedUrl = resetUrl;
      const error = new Error("provider detail that should not be logged");
      error.code = "EAUTH";
      error.command = "AUTH PLAIN";
      error.responseCode = 535;
      throw error;
    },
    logger: {
      info(message, details) { logs.push(["info", message, details]); },
      error(message, details) { logs.push(["error", message, details]); },
    },
  });

  assert.equal(result.status, 202);
  assert.match(result.body.message, /If an account matches/);
  assert.equal(new URL(attemptedUrl).origin, "https://scout-os-bay.vercel.app");
  assert.equal(new URL(attemptedUrl).pathname, "/reset-password");
  assert.equal(cleanupCalls.length, 1);
  assert.match(cleanupCalls[0][0], /DELETE FROM password_reset_tokens/);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("registered@example.test"), false);
  assert.equal(serializedLogs.includes(new URL(attemptedUrl).searchParams.get("token")), false);
  assert.equal(serializedLogs.includes("provider detail"), false);
  assert.match(serializedLogs, /EAUTH/);
  assert.match(serializedLogs, /535/);
});

test("forgot-password returns the same public response for an unknown account", async () => {
  const connection = resetConnection(null);
  let deliveryAttempted = false;
  const { result, send } = responseCapture();

  await handleForgotPassword({
    request: requestFor({ email: "unknown@example.test" }),
    response: {},
    db: { async getConnection() { return connection; } },
    send,
    readJson: async (incoming) => incoming.body,
    tokenSecret: "test-rate-limit-secret",
    frontendUrl: "https://scout-os-bay.vercel.app",
    async deliverResetEmail() { deliveryAttempted = true; },
  });

  assert.equal(result.status, 202);
  assert.match(result.body.message, /If an account matches/);
  assert.equal(deliveryAttempted, false);
});

test("reset-password hashes the token, changes the password, and consumes all user tokens", async () => {
  const { token } = createPasswordResetToken();
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push(["begin"]); },
    async commit() { calls.push(["commit"]); },
    async rollback() { calls.push(["rollback"]); },
    release() { calls.push(["release"]); },
    async execute(sql, values) {
      calls.push([sql, values]);
      if (sql.includes("SELECT id, user_id")) return [[{ id: 11, user_id: 7 }]];
      return [{ affectedRows: 1 }];
    },
  };
  const { result, send } = responseCapture();

  await handleResetPassword({
    request: requestFor({ token, password: "new-password", confirmPassword: "new-password" }),
    response: {},
    db: { async getConnection() { return connection; } },
    send,
    readJson: async (incoming) => incoming.body,
    hashPassword: (password) => `hashed:${password}`,
  });

  assert.equal(result.status, 200);
  const selectCall = calls.find(([sql]) => String(sql).includes("SELECT id, user_id"));
  assert.equal(selectCall[1][0], hashPasswordResetToken(token));
  assert.notEqual(selectCall[1][0], token);
  assert.ok(calls.some(([sql, values]) => String(sql).includes("UPDATE users") && values[0] === "hashed:new-password"));
  assert.ok(calls.some(([sql]) => String(sql).includes("UPDATE password_reset_tokens SET used_at")));
  assert.ok(calls.some(([name]) => name === "commit"));
});

test("reset-password rejects malformed tokens before opening a database connection", async () => {
  let connected = false;
  const { result, send } = responseCapture();
  await handleResetPassword({
    request: requestFor({ token: "not-valid", password: "new-password", confirmPassword: "new-password" }),
    response: {},
    db: { async getConnection() { connected = true; } },
    send,
    readJson: async (incoming) => incoming.body,
    hashPassword: () => "unused",
  });

  assert.equal(result.status, 400);
  assert.equal(connected, false);
});
