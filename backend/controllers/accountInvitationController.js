import {
  maskedEmailReference,
  safeEmailError,
  sendScoutInvitationEmail,
} from "../services/emailService.js";
import {
  ACCOUNT_INVITATION_TTL_HOURS,
  buildAccountInvitationUrl,
  createAccountInvitationToken,
  hashAccountInvitationToken,
  isValidAccountInvitationToken,
} from "../services/accountInvitationService.js";
import { normalizeEmail, validateResetPassword } from "../services/passwordResetService.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function invalidInvitation(response, send) {
  return send(response, 400, { error: "This invitation is invalid or has expired." });
}

export async function handleInvitationStatus({ request, response, db, send, readJson }) {
  const token = String((await readJson(request)).token || "");
  if (!isValidAccountInvitationToken(token)) return invalidInvitation(response, send);

  const [rows] = await db.execute(
    `SELECT account.full_name, account.username, invitation.expires_at
     FROM account_invitations invitation
     INNER JOIN users account ON account.id = invitation.user_id
     INNER JOIN scouts scout ON scout.id = account.scout_id AND scout.status = 'Active'
     WHERE invitation.token_hash = ?
       AND invitation.used_at IS NULL
       AND invitation.revoked_at IS NULL
       AND invitation.expires_at > NOW()
       AND account.role = 'SCOUT'
       AND account.active = 0
     LIMIT 1`,
    [hashAccountInvitationToken(token)],
  );
  const invitation = rows[0];
  if (!invitation) return invalidInvitation(response, send);

  return send(response, 200, {
    invitation: {
      fullName: invitation.full_name,
      username: invitation.username,
      expiresAt: invitation.expires_at,
    },
  });
}

export async function handleAcceptInvitation({
  request,
  response,
  db,
  send,
  readJson,
  hashPassword,
}) {
  const body = await readJson(request);
  const token = String(body.token || "");
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");
  const passwordError = validateResetPassword(password);

  if (password !== confirmPassword) return send(response, 400, { error: "Passwords do not match." });
  if (passwordError) return send(response, 400, { error: passwordError });
  if (!isValidAccountInvitationToken(token)) return invalidInvitation(response, send);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT invitation.id, invitation.user_id
       FROM account_invitations invitation
       INNER JOIN users account ON account.id = invitation.user_id
       INNER JOIN scouts scout ON scout.id = account.scout_id AND scout.status = 'Active'
       WHERE invitation.token_hash = ?
         AND invitation.used_at IS NULL
         AND invitation.revoked_at IS NULL
         AND invitation.expires_at > NOW()
         AND account.role = 'SCOUT'
         AND account.active = 0
       LIMIT 1 FOR UPDATE`,
      [hashAccountInvitationToken(token)],
    );
    const invitation = rows[0];
    if (!invitation) {
      await connection.rollback();
      return invalidInvitation(response, send);
    }

    await connection.execute(
      `UPDATE users
       SET password_hash = ?, active = 1, session_version = session_version + 1
       WHERE id = ?`,
      [hashPassword(password), invitation.user_id],
    );
    await connection.execute(
      "UPDATE account_invitations SET used_at = NOW() WHERE id = ?",
      [invitation.id],
    );
    await connection.execute(
      `UPDATE account_invitations SET revoked_at = NOW()
       WHERE user_id = ? AND id <> ? AND used_at IS NULL AND revoked_at IS NULL`,
      [invitation.user_id, invitation.id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return send(response, 200, {
    message: "Your ScoutOS account is active. You can now sign in.",
  });
}

export async function handleIssueInvitation({
  response,
  db,
  send,
  userId,
  createdBy,
  frontendUrl,
  deliverInvitationEmail = sendScoutInvitationEmail,
  logger = console,
}) {
  const connection = await db.getConnection();
  let delivery;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT account.id, account.full_name, account.username, account.email,
              account.role, account.active, account.scout_id, scout.status AS scout_status
       FROM users account
       LEFT JOIN scouts scout ON scout.id = account.scout_id
       WHERE account.id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const account = rows[0];
    if (!account) throw httpError(404, "User account not found.");
    if (account.role !== "SCOUT") throw httpError(400, "Only Scout accounts can receive invitations.");
    if (Boolean(account.active)) throw httpError(409, "This Scout account is already active.");
    if (!account.scout_id || account.scout_status !== "Active") {
      throw httpError(400, "The account must be linked to an active Scout before it can be invited.");
    }
    const email = normalizeEmail(account.email);
    if (!email) throw httpError(400, "The Scout account needs a valid email address.");

    await connection.execute(
      `UPDATE account_invitations SET revoked_at = NOW()
       WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
      [userId],
    );
    const { token, tokenHash } = createAccountInvitationToken();
    const expiresAt = new Date(Date.now() + ACCOUNT_INVITATION_TTL_HOURS * 60 * 60 * 1000);
    await connection.execute(
      `INSERT INTO account_invitations
        (user_id, token_hash, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, tokenHash, expiresAt, createdBy],
    );
    delivery = {
      email,
      fullName: account.full_name,
      username: account.username,
      token,
      tokenHash,
      expiresAt,
    };
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const recipient = maskedEmailReference(delivery.email);
  try {
    const result = await deliverInvitationEmail({
      to: delivery.email,
      fullName: delivery.fullName,
      username: delivery.username,
      invitationUrl: buildAccountInvitationUrl(frontendUrl, delivery.token),
    });
    logger.info("[Account invitation] Email accepted by SMTP.", { recipient, ...result });
  } catch (error) {
    try {
      await db.execute(
        `UPDATE account_invitations
         SET delivery_failed_at = NOW(), revoked_at = NOW()
         WHERE token_hash = ? AND used_at IS NULL`,
        [delivery.tokenHash],
      );
    } catch (cleanupError) {
      logger.error("[Account invitation] Failed to revoke an undelivered invitation.", {
        recipient,
        code: String(cleanupError?.code || "DB_UNKNOWN").slice(0, 80),
      });
    }
    logger.error("[Account invitation] Email delivery failed.", {
      recipient,
      error: safeEmailError(error),
    });
    throw httpError(502, "The account was saved, but its invitation email could not be sent. Retry from Manage Accounts.");
  }

  try {
    await db.execute(
      "UPDATE account_invitations SET sent_at = NOW() WHERE token_hash = ?",
      [delivery.tokenHash],
    );
  } catch (error) {
    logger.error("[Account invitation] Delivery receipt could not be recorded.", {
      recipient,
      code: String(error?.code || "DB_UNKNOWN").slice(0, 80),
    });
  }

  return send(response, 201, {
    message: "Invitation email sent.",
    invitation: { state: "INVITED", expiresAt: delivery.expiresAt },
  });
}

export async function handleRevokeInvitation({ response, db, send, userId }) {
  const [accounts] = await db.execute(
    "SELECT id, role, active FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const account = accounts[0];
  if (!account) throw httpError(404, "User account not found.");
  if (account.role !== "SCOUT") throw httpError(400, "Only Scout invitations can be revoked.");
  if (Boolean(account.active)) throw httpError(409, "This Scout account is already active.");

  await db.execute(
    `UPDATE account_invitations SET revoked_at = NOW()
     WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    [userId],
  );
  return send(response, 200, { message: "Pending invitation revoked." });
}
