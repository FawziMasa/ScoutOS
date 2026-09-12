import assert from "node:assert/strict";
import test from "node:test";
import {
  handleAcceptInvitation,
  handleInvitationStatus,
  handleIssueInvitation,
  handleRevokeInvitation,
} from "../controllers/accountInvitationController.js";
import {
  buildAccountInvitationUrl,
  createAccountInvitationToken,
  hashAccountInvitationToken,
  isValidAccountInvitationToken,
} from "../services/accountInvitationService.js";
import { createScoutInvitationEmail } from "../services/emailService.js";

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
  return { body };
}

test("Scout invitation tokens are random, hashed, and placed only in the frontend link", () => {
  const first = createAccountInvitationToken();
  const second = createAccountInvitationToken();
  assert.equal(isValidAccountInvitationToken(first.token), true);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashAccountInvitationToken(first.token));
  assert.notEqual(first.tokenHash, first.token);

  const url = new URL(buildAccountInvitationUrl("https://scout.example", first.token));
  assert.equal(url.origin, "https://scout.example");
  assert.equal(url.pathname, "/accept-invitation");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), first.token);
});

test("invitation email escapes account data and carries activation instructions", () => {
  const content = createScoutInvitationEmail({
    fullName: "<Scout>",
    username: "scout&one",
    invitationUrl: "https://scout.example/accept-invitation?token=safe",
  });
  assert.match(content.text, /expires in 24 hours/);
  assert.match(content.html, /&lt;Scout&gt;/);
  assert.match(content.html, /scout&amp;one/);
  assert.equal(content.html.includes("<Scout>"), false);
});

test("invitation status rejects malformed tokens without a database query", async () => {
  let queried = false;
  const { result, send } = responseCapture();
  await handleInvitationStatus({
    request: requestFor({ token: "invalid" }),
    response: {},
    db: { async execute() { queried = true; } },
    send,
    readJson: async (request) => request.body,
  });
  assert.equal(result.status, 400);
  assert.equal(queried, false);
});

test("accepting an invitation activates the Scout and consumes all invitations", async () => {
  const { token } = createAccountInvitationToken();
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push(["begin"]); },
    async commit() { calls.push(["commit"]); },
    async rollback() { calls.push(["rollback"]); },
    release() { calls.push(["release"]); },
    async execute(sql, values) {
      calls.push([sql, values]);
      if (sql.includes("SELECT invitation.id")) return [[{ id: 4, user_id: 9 }]];
      return [{ affectedRows: 1 }];
    },
  };
  const { result, send } = responseCapture();

  await handleAcceptInvitation({
    request: requestFor({ token, password: "private-password", confirmPassword: "private-password" }),
    response: {},
    db: { async getConnection() { return connection; } },
    send,
    readJson: async (request) => request.body,
    hashPassword: (password) => `hashed:${password}`,
  });

  assert.equal(result.status, 200);
  assert.ok(calls.some(([sql, values]) => String(sql).includes("UPDATE users") && values[0] === "hashed:private-password"));
  assert.ok(calls.some(([sql]) => String(sql).includes("SET used_at = NOW()")));
  assert.ok(calls.some(([sql]) => String(sql).includes("id <> ?")));
  const select = calls.find(([sql]) => String(sql).includes("SELECT invitation.id"));
  assert.equal(select[1][0], hashAccountInvitationToken(token));
  assert.equal(JSON.stringify(calls).includes(token), false);
});

test("issuing an invitation revokes older links and never logs the recipient or token", async () => {
  const connectionCalls = [];
  const databaseCalls = [];
  const logs = [];
  let delivered;
  const connection = {
    async beginTransaction() { connectionCalls.push(["begin"]); },
    async commit() { connectionCalls.push(["commit"]); },
    async rollback() { connectionCalls.push(["rollback"]); },
    release() { connectionCalls.push(["release"]); },
    async execute(sql, values) {
      connectionCalls.push([sql, values]);
      if (sql.includes("SELECT account.id")) {
        return [[{
          id: 9,
          full_name: "Scout One",
          username: "scout.one",
          email: "scout@example.test",
          role: "SCOUT",
          active: 0,
          scout_id: "scout-1",
          scout_status: "Active",
        }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  const db = {
    async getConnection() { return connection; },
    async execute(sql, values) { databaseCalls.push([sql, values]); return [{ affectedRows: 1 }]; },
  };
  const { result, send } = responseCapture();

  await handleIssueInvitation({
    response: {},
    db,
    send,
    userId: 9,
    createdBy: 1,
    frontendUrl: "https://scout.example",
    async deliverInvitationEmail(message) { delivered = message; return { acceptedCount: 1, rejectedCount: 0 }; },
    logger: {
      info(message, details) { logs.push([message, details]); },
      error(message, details) { logs.push([message, details]); },
    },
  });

  assert.equal(result.status, 201);
  assert.equal(new URL(delivered.invitationUrl).pathname, "/accept-invitation");
  assert.ok(connectionCalls.some(([sql]) => String(sql).includes("SET revoked_at = NOW()")));
  assert.ok(databaseCalls.some(([sql]) => String(sql).includes("SET sent_at = NOW()")));
  const rawToken = new URLSearchParams(new URL(delivered.invitationUrl).hash.slice(1)).get("token");
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("scout@example.test"), false);
  assert.equal(serializedLogs.includes(rawToken), false);
});

test("failed invitation delivery revokes the token without exposing secrets", async () => {
  const databaseCalls = [];
  const logs = [];
  let attemptedUrl;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes("SELECT account.id")) {
        return [[{
          id: 9,
          full_name: "Scout One",
          username: "scout.one",
          email: "scout@example.test",
          role: "SCOUT",
          active: 0,
          scout_id: "scout-1",
          scout_status: "Active",
        }]];
      }
      return [{ affectedRows: 1 }];
    },
  };
  const db = {
    async getConnection() { return connection; },
    async execute(sql, values) { databaseCalls.push([sql, values]); return [{ affectedRows: 1 }]; },
  };

  await assert.rejects(
    handleIssueInvitation({
      response: {},
      db,
      send() {},
      userId: 9,
      createdBy: 1,
      frontendUrl: "https://scout.example",
      async deliverInvitationEmail({ invitationUrl }) {
        attemptedUrl = invitationUrl;
        const error = new Error("provider secret detail");
        error.code = "EAUTH";
        throw error;
      },
      logger: {
        info(message, details) { logs.push([message, details]); },
        error(message, details) { logs.push([message, details]); },
      },
    }),
    /invitation email could not be sent/i,
  );

  assert.ok(databaseCalls.some(([sql]) => String(sql).includes("delivery_failed_at = NOW()")));
  const token = new URLSearchParams(new URL(attemptedUrl).hash.slice(1)).get("token");
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("scout@example.test"), false);
  assert.equal(serializedLogs.includes(token), false);
  assert.equal(serializedLogs.includes("provider secret detail"), false);
  assert.match(serializedLogs, /EAUTH/);
});

test("revoking an invitation leaves the inactive Scout account intact", async () => {
  const calls = [];
  const { result, send } = responseCapture();
  await handleRevokeInvitation({
    response: {},
    db: {
      async execute(sql, values) {
        calls.push([sql, values]);
        if (sql.includes("SELECT id, role")) return [[{ id: 9, role: "SCOUT", active: 0 }]];
        return [{ affectedRows: 1 }];
      },
    },
    send,
    userId: 9,
  });
  assert.equal(result.status, 200);
  assert.ok(calls.some(([sql]) => String(sql).includes("UPDATE account_invitations")));
  assert.equal(calls.some(([sql]) => String(sql).includes("DELETE FROM users")), false);
});
