import db from "./db.js";

export async function ensurePointsSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      scout_id VARCHAR(36) NOT NULL,
      points_change INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      leader_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_points_scout (scout_id),
      CONSTRAINT fk_points_scout
        FOREIGN KEY (scout_id) REFERENCES scouts(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_points_leader
        FOREIGN KEY (leader_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
