import db from "./db.js";

export const financeTransactionTypes = ["EXPENSE", "INCOME"];
export const financeStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"];

async function columnRecord(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT column_name, column_type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [tableName, columnName],
  );
  return rows[0] || null;
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

async function addColumnIfMissing(name, definition) {
  if (!(await columnRecord("finance_transactions", name))) {
    await db.execute(`ALTER TABLE finance_transactions ADD COLUMN ${definition}`);
  }
}

async function ensureStatusModel() {
  const status = await columnRecord("finance_transactions", "status");
  const type = String(status?.column_type || "").toLowerCase();
  const currentValues = [...type.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const expectedValues = financeStatuses.map((value) => value.toLowerCase());
  if (type.startsWith("enum(") && JSON.stringify(currentValues) === JSON.stringify(expectedValues)) return;

  // VARCHAR is a restart-safe bridge for ENUM, VARCHAR, and partially migrated production schemas.
  await db.execute(`
    ALTER TABLE finance_transactions
    MODIFY COLUMN status VARCHAR(20) NULL
  `);
  await db.execute(`
    UPDATE finance_transactions
    SET status = CASE UPPER(TRIM(COALESCE(status, '')))
      WHEN 'COMPLETED' THEN 'APPROVED'
      WHEN 'PENDING' THEN 'SUBMITTED'
      WHEN 'DRAFT' THEN 'DRAFT'
      WHEN 'SUBMITTED' THEN 'SUBMITTED'
      WHEN 'APPROVED' THEN 'APPROVED'
      WHEN 'REJECTED' THEN 'REJECTED'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      ELSE 'DRAFT'
    END
  `);
  await db.execute(`
    ALTER TABLE finance_transactions
    MODIFY COLUMN status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')
    NOT NULL DEFAULT 'DRAFT'
  `);
}

export async function ensureFinanceSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id INT NOT NULL AUTO_INCREMENT,
      unit VARCHAR(50) NOT NULL,
      transaction_type ENUM('EXPENSE', 'INCOME') NOT NULL DEFAULT 'EXPENSE',
      category VARCHAR(80) NOT NULL,
      description VARCHAR(255) NOT NULL,
      vendor_paid_to VARCHAR(150) NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
      transaction_date DATE NOT NULL,
      reference_number VARCHAR(80) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by INT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      approved_by INT NULL,
      approved_at DATETIME NULL,
      rejection_reason VARCHAR(500) NULL,
      reversal_of_id INT NULL,
      PRIMARY KEY (id),
      INDEX idx_finance_transactions_unit_date (unit, transaction_date),
      INDEX idx_finance_transactions_status (status),
      INDEX idx_finance_transactions_category (category),
      INDEX idx_finance_transactions_created_by (created_by),
      INDEX idx_finance_transactions_updated_by (updated_by),
      INDEX idx_finance_transactions_approved_by (approved_by),
      UNIQUE KEY uq_finance_transactions_reversal (reversal_of_id),
      CONSTRAINT fk_finance_transactions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_finance_transactions_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_finance_transactions_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_finance_transactions_reversal
        FOREIGN KEY (reversal_of_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await ensureStatusModel();
  await addColumnIfMissing("approved_by", "approved_by INT NULL AFTER updated_at");
  await addColumnIfMissing("approved_at", "approved_at DATETIME NULL AFTER approved_by");
  await addColumnIfMissing("rejection_reason", "rejection_reason VARCHAR(500) NULL AFTER approved_at");
  await addColumnIfMissing("reversal_of_id", "reversal_of_id INT NULL AFTER rejection_reason");
  await db.execute(`
    UPDATE finance_transactions
    SET approved_by = COALESCE(approved_by, updated_by, created_by),
        approved_at = COALESCE(approved_at, updated_at, created_at)
    WHERE status = 'APPROVED' AND (approved_by IS NULL OR approved_at IS NULL)
  `);

  if (!(await indexExists("finance_transactions", "idx_finance_transactions_approved_by"))) {
    await db.execute("ALTER TABLE finance_transactions ADD INDEX idx_finance_transactions_approved_by (approved_by)");
  }
  if (!(await indexExists("finance_transactions", "uq_finance_transactions_reversal"))) {
    await db.execute("ALTER TABLE finance_transactions ADD UNIQUE KEY uq_finance_transactions_reversal (reversal_of_id)");
  }
  if (!(await constraintExists("finance_transactions", "fk_finance_transactions_approved_by"))) {
    await db.execute(`ALTER TABLE finance_transactions ADD CONSTRAINT fk_finance_transactions_approved_by
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL`);
  }
  if (!(await constraintExists("finance_transactions", "fk_finance_transactions_reversal"))) {
    await db.execute(`ALTER TABLE finance_transactions ADD CONSTRAINT fk_finance_transactions_reversal
      FOREIGN KEY (reversal_of_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT`);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS finance_status_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      transaction_id INT NOT NULL,
      from_status VARCHAR(20) NULL,
      to_status VARCHAR(20) NOT NULL,
      reason VARCHAR(500) NULL,
      changed_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_finance_history_transaction (transaction_id, created_at),
      INDEX idx_finance_history_actor (changed_by),
      CONSTRAINT fk_finance_history_transaction
        FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_finance_history_actor
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
    INSERT INTO finance_status_history
      (transaction_id, from_status, to_status, reason, changed_by, created_at)
    SELECT finance_record.id, NULL, finance_record.status, 'Existing record imported into status history',
           COALESCE(finance_record.updated_by, finance_record.created_by), finance_record.created_at
    FROM finance_transactions finance_record
    WHERE NOT EXISTS (
      SELECT 1 FROM finance_status_history history WHERE history.transaction_id = finance_record.id
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS finance_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      transaction_id INT NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(80) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      file_data MEDIUMBLOB NOT NULL,
      uploaded_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status ENUM('active', 'deleted') NOT NULL DEFAULT 'active',
      deleted_by INT NULL,
      deleted_at DATETIME NULL,
      PRIMARY KEY (id),
      INDEX idx_finance_attachments_transaction (transaction_id, status, created_at),
      INDEX idx_finance_attachments_uploader (uploaded_by),
      CONSTRAINT fk_finance_attachments_transaction
        FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_finance_attachments_uploader
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_finance_attachments_deleter
        FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
