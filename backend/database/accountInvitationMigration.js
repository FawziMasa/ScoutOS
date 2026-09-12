import db from "./db.js";

export async function ensureAccountInvitationSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS account_invitations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      sent_at DATETIME NULL,
      delivery_failed_at DATETIME NULL,
      used_at DATETIME NULL,
      revoked_at DATETIME NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_account_invitations_token_hash (token_hash),
      INDEX idx_account_invitations_user_created (user_id, created_at),
      INDEX idx_account_invitations_expiry (expires_at),
      CONSTRAINT fk_account_invitations_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_account_invitations_creator
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
