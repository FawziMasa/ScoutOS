import db from "./db.js";

export const financeTransactionTypes = ["EXPENSE", "INCOME"];
export const financeStatuses = ["COMPLETED", "PENDING", "CANCELLED"];

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
      status ENUM('COMPLETED', 'PENDING', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
      transaction_date DATE NOT NULL,
      reference_number VARCHAR(80) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by INT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_finance_transactions_unit_date (unit, transaction_date),
      INDEX idx_finance_transactions_status (status),
      INDEX idx_finance_transactions_category (category),
      INDEX idx_finance_transactions_created_by (created_by),
      INDEX idx_finance_transactions_updated_by (updated_by),
      CONSTRAINT fk_finance_transactions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_finance_transactions_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
