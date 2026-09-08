import db from "./db.js";

export async function ensurePasswordResetSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_password_reset_token_hash (token_hash),
      INDEX idx_password_reset_tokens_user (user_id, created_at),
      INDEX idx_password_reset_tokens_expiry (expires_at),
      CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      identifier_hash CHAR(64) NOT NULL,
      ip_hash CHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_password_reset_rate_identifier (identifier_hash, created_at),
      INDEX idx_password_reset_rate_ip (ip_hash, created_at),
      INDEX idx_password_reset_rate_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
