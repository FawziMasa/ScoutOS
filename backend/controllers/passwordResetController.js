import { maskedEmailReference, safeEmailError, sendPasswordResetEmail } from "../services/emailService.js";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  hashRateLimitValue,
  isValidPasswordResetToken,
  normalizeEmail,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  validateResetPassword,
} from "../services/passwordResetService.js";

const GENERIC_RESET_MESSAGE = "If an account matches that email, a reset link will arrive shortly.";

function requestIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 128);
  }
  return String(request.socket.remoteAddress || "unknown").slice(0, 128);
}

function genericResponse(response, send) {
  return send(response, 202, { message: GENERIC_RESET_MESSAGE });
}

export async function handleForgotPassword({
  request,
  response,
  db,
  send,
  readJson,
  tokenSecret,
  frontendUrl,
  deliverResetEmail = sendPasswordResetEmail,
  logger = console,
}) {
  const body = await readJson(request);
  const normalizedEmail = normalizeEmail(body.email);
  const identifierValue = normalizedEmail || String(body.email || "").slice(0, 254);
  const identifierHash = hashRateLimitValue(identifierValue, tokenSecret);
  const ipHash = hashRateLimitValue(requestIp(request), tokenSecret);
  let connection;
  let delivery;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.execute("DELETE FROM password_reset_rate_limits WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
    const [emailRequests] = await connection.execute(
      "SELECT id FROM password_reset_rate_limits WHERE identifier_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) FOR UPDATE",
      [identifierHash],
    );
    const [ipRequests] = await connection.execute(
      "SELECT id FROM password_reset_rate_limits WHERE ip_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) FOR UPDATE",
      [ipHash],
    );

    if (emailRequests.length < PASSWORD_RESET_EMAIL_LIMIT && ipRequests.length < PASSWORD_RESET_IP_LIMIT) {
      await connection.execute(
        "INSERT INTO password_reset_rate_limits (identifier_hash, ip_hash, created_at) VALUES (?, ?, NOW())",
        [identifierHash, ipHash],
      );

      if (normalizedEmail) {
        const [accounts] = await connection.execute(
          "SELECT id, email FROM users WHERE email = ? AND active = 1 LIMIT 1 FOR UPDATE",
          [normalizedEmail],
        );
        const account = accounts[0];
        if (account) {
          const { token, tokenHash } = createPasswordResetToken();
          await connection.execute(
            "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
            [account.id],
          );
          await connection.execute(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${PASSWORD_RESET_TOKEN_TTL_MINUTES} MINUTE), NOW())`,
            [account.id, tokenHash],
          );
          delivery = { userId: account.id, email: account.email, token, tokenHash };
        }
      }
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    logger.error("[Password reset] Request persistence failed.", {
      code: String(error?.code || "DB_UNKNOWN").slice(0, 80),
    });
    return genericResponse(response, send);
  } finally {
    connection?.release();
  }

  if (delivery) {
    const recipient = maskedEmailReference(delivery.email);
    try {
      const result = await deliverResetEmail({
        to: delivery.email,
        resetUrl: buildPasswordResetUrl(frontendUrl, delivery.token),
      });
      logger.info("[Password reset] Email accepted by SMTP.", { recipient, ...result });
    } catch (error) {
      try {
        await db.execute(
          "DELETE FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? AND used_at IS NULL",
          [delivery.userId, delivery.tokenHash],
        );
      } catch (cleanupError) {
        logger.error("[Password reset] Failed to remove an undelivered token.", {
          recipient,
          code: String(cleanupError?.code || "DB_UNKNOWN").slice(0, 80),
        });
      }
      logger.error("[Password reset] Email delivery failed.", {
        recipient,
        error: safeEmailError(error),
      });
    }
  }

  return genericResponse(response, send);
}

export async function handleResetPassword({ request, response, db, send, readJson, hashPassword }) {
  const body = await readJson(request);
  const token = String(body.token || "");
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");
  const passwordError = validateResetPassword(password);

  if (password !== confirmPassword) return send(response, 400, { error: "Passwords do not match." });
  if (passwordError) return send(response, 400, { error: passwordError });
  if (!isValidPasswordResetToken(token)) {
    return send(response, 400, { error: "This reset link is invalid or has expired." });
  }

  const tokenHash = hashPasswordResetToken(token);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [tokens] = await connection.execute(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [tokenHash],
    );
    const resetToken = tokens[0];
    if (!resetToken) {
      await connection.rollback();
      return send(response, 400, { error: "This reset link is invalid or has expired." });
    }

    await connection.execute(
      "UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
      [hashPassword(password), resetToken.user_id],
    );
    await connection.execute(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
      [resetToken.user_id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return send(response, 200, { message: "Your password has been reset. You can now sign in." });
}
