import db from "./db.js";

async function columnExists(columnName) {
  const [rows] = await db.execute(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'points_ledger' AND column_name = ? LIMIT 1`,
    [columnName],
  );
  return rows.length > 0;
}

async function indexExists(indexName) {
  const [rows] = await db.execute(
    `SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'points_ledger' AND index_name = ? LIMIT 1`,
    [indexName],
  );
  return rows.length > 0;
}

export async function ensurePointsSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      scout_id VARCHAR(36) NOT NULL,
      points_change INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      leader_id INT NOT NULL,
      request_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_points_scout (scout_id),
      UNIQUE KEY uq_points_request_actor (leader_id, request_id),
      CONSTRAINT fk_points_scout
        FOREIGN KEY (scout_id) REFERENCES scouts(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_points_leader
        FOREIGN KEY (leader_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (!(await columnExists("request_id"))) {
    await db.execute("ALTER TABLE points_ledger ADD COLUMN request_id VARCHAR(64) NULL AFTER leader_id");
  }
  if (!(await indexExists("uq_points_request_actor"))) {
    await db.execute("ALTER TABLE points_ledger ADD UNIQUE KEY uq_points_request_actor (leader_id, request_id)");
  }
}
