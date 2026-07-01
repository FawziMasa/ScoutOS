import db from "./db.js";
import { ensureAttendanceSchema } from "./attendanceMigration.js";

async function tableExists(tableName) {
  const [rows] = await db.execute(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    `,
    [tableName],
  );

  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows.length > 0;
}

async function ensureUsersTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      full_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'UNIT_LEADER',
      unit VARCHAR(50) NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (!(await columnExists("users", "unit"))) {
    await db.execute("ALTER TABLE users ADD COLUMN unit VARCHAR(50) NULL AFTER role");
  }

  if (!(await columnExists("users", "active"))) {
    await db.execute("ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
  }

  if (!(await columnExists("users", "created_at"))) {
    await db.execute("ALTER TABLE users ADD COLUMN created_at DATETIME NULL");
  }
}

async function ensureScoutsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scouts (
      id VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL,
      age INT NOT NULL,
      unit VARCHAR(50) NOT NULL,
      phone VARCHAR(30) NULL,
      guardian VARCHAR(100) NULL,
      joined_at DATE NULL,
      status VARCHAR(20) NULL DEFAULT 'Active',
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      PRIMARY KEY (id),
      INDEX idx_scouts_unit (unit),
      INDEX idx_scouts_status (status),
      INDEX idx_scouts_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const expectedColumns = [
    ["phone", "ALTER TABLE scouts ADD COLUMN phone VARCHAR(30) NULL AFTER unit"],
    ["guardian", "ALTER TABLE scouts ADD COLUMN guardian VARCHAR(100) NULL AFTER phone"],
    ["joined_at", "ALTER TABLE scouts ADD COLUMN joined_at DATE NULL AFTER guardian"],
    ["status", "ALTER TABLE scouts ADD COLUMN status VARCHAR(20) NULL DEFAULT 'Active' AFTER joined_at"],
    ["created_at", "ALTER TABLE scouts ADD COLUMN created_at DATETIME NULL"],
    ["updated_at", "ALTER TABLE scouts ADD COLUMN updated_at DATETIME NULL"],
  ];

  for (const [columnName, sql] of expectedColumns) {
    if (!(await columnExists("scouts", columnName))) {
      await db.execute(sql);
    }
  }
}

export async function ensureCoreSchema() {
  if (!(await tableExists("users"))) {
    await ensureUsersTable();
  } else {
    await ensureUsersTable();
  }

  if (!(await tableExists("scouts"))) {
    await ensureScoutsTable();
  } else {
    await ensureScoutsTable();
  }

  await ensureAttendanceSchema();
}
