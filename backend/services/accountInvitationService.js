import { createHash, randomBytes } from "node:crypto";

export const ACCOUNT_INVITATION_TTL_HOURS = 24;

export function createAccountInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAccountInvitationToken(token) };
}

export function hashAccountInvitationToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function isValidAccountInvitationToken(token) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(token));
}

export function buildAccountInvitationUrl(frontendUrl, token) {
  const url = new URL("/accept-invitation", frontendUrl);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("FRONTEND_URL must use http or https.");
  }
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

const accountStateSql = `
  CASE
    WHEN account.active = 1 THEN 'ACTIVE'
    WHEN invitation.delivery_failed_at IS NOT NULL THEN 'INVITATION_FAILED'
    WHEN invitation.revoked_at IS NOT NULL OR invitation.used_at IS NOT NULL THEN 'INACTIVE'
    WHEN invitation.expires_at <= NOW() THEN 'EXPIRED'
    WHEN invitation.id IS NOT NULL THEN 'INVITED'
    ELSE 'INACTIVE'
  END AS account_state,
  invitation.expires_at AS invitation_expires_at
`;

const latestInvitationJoin = `
  LEFT JOIN account_invitations invitation ON invitation.id = (
    SELECT candidate.id
    FROM account_invitations candidate
    WHERE candidate.user_id = account.id
    ORDER BY candidate.id DESC
    LIMIT 1
  )
`;

export async function listAccountsWithInvitationState(database) {
  const [rows] = await database.execute(`
    SELECT account.*, ${accountStateSql}
    FROM users account
    ${latestInvitationJoin}
    ORDER BY account.created_at DESC
  `);
  return rows;
}

export async function getAccountWithInvitationState(database, userId) {
  const [rows] = await database.execute(`
    SELECT account.*, ${accountStateSql}
    FROM users account
    ${latestInvitationJoin}
    WHERE account.id = ?
    LIMIT 1
  `, [userId]);
  return rows[0] || null;
}
