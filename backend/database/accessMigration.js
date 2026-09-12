import db from "./db.js";

export const defaultUnitNames = [
  "أشبال و زهرات",
  "مبتدئ",
  "متقدم",
  "جوالة",
  "قيادة",
];

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.execute(
    `SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await db.execute(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
    [tableName, constraintName],
  );
  return rows.length > 0;
}

export async function ensureAccessSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS units (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(50) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_units_name (name),
      INDEX idx_units_active_order (active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  for (const [displayOrder, name] of defaultUnitNames.entries()) {
    await db.execute(
      `INSERT INTO units (name, active, display_order, created_at, updated_at)
       VALUES (?, 1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), updated_at = updated_at`,
      [name, displayOrder + 1],
    );
  }

  await db.execute(`
    INSERT IGNORE INTO units (name, active, display_order, created_at, updated_at)
    SELECT DISTINCT unit, 1, 100, NOW(), NOW() FROM users
    WHERE unit IS NOT NULL AND TRIM(unit) <> ''
  `);
  await db.execute(`
    INSERT IGNORE INTO units (name, active, display_order, created_at, updated_at)
    SELECT DISTINCT unit, 1, 100, NOW(), NOW() FROM scouts
    WHERE unit IS NOT NULL AND TRIM(unit) <> ''
  `);

  if (!(await columnExists("users", "scout_id"))) {
    await db.execute("ALTER TABLE users ADD COLUMN scout_id VARCHAR(36) NULL AFTER unit");
  }
  if (!(await indexExists("users", "uq_users_scout_id"))) {
    await db.execute("ALTER TABLE users ADD UNIQUE KEY uq_users_scout_id (scout_id)");
  }
  if (!(await constraintExists("users", "fk_users_scout"))) {
    await db.execute(`
      ALTER TABLE users ADD CONSTRAINT fk_users_scout
      FOREIGN KEY (scout_id) REFERENCES scouts(id) ON DELETE SET NULL
    `);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_units (
      user_id INT NOT NULL,
      unit_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, unit_id),
      INDEX idx_user_units_unit_user (unit_id, user_id),
      CONSTRAINT fk_user_units_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_units_unit
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
    INSERT IGNORE INTO user_units (user_id, unit_id, created_at)
    SELECT u.id, unit_record.id, NOW()
    FROM users u
    INNER JOIN units unit_record ON unit_record.name = u.unit
    WHERE u.unit IS NOT NULL AND TRIM(u.unit) <> ''
  `);
}
