import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const { default: db } = await import("../database/db.js");
const { ensureFinanceSchema } = await import("../database/financeMigration.js");

test("Finance migration widens, maps, then narrows legacy statuses without destructive SQL", async () => {
  const originalExecute = db.execute;
  const calls = [];
  db.execute = async (sql, values = []) => {
    calls.push({ sql: String(sql), values });
    if (String(sql).includes("information_schema.columns")) {
      if (values[1] === "status") {
        return [[{ column_name: "status", column_type: "enum('COMPLETED','PENDING','CANCELLED')" }]];
      }
      return [[]];
    }
    if (String(sql).includes("information_schema.statistics")) return [[]];
    if (String(sql).includes("information_schema.table_constraints")) return [[]];
    return [{ affectedRows: 1 }];
  };

  try {
    await ensureFinanceSchema();
    const statements = calls.map((call) => call.sql.replace(/\s+/g, " ").trim());
    const widen = statements.findIndex((sql) => sql.includes("'CANCELLED', 'COMPLETED', 'PENDING'"));
    const mapCompleted = statements.findIndex((sql) => sql.includes("SET status = 'APPROVED' WHERE status = 'COMPLETED'"));
    const mapPending = statements.findIndex((sql) => sql.includes("SET status = 'SUBMITTED' WHERE status = 'PENDING'"));
    const narrow = statements.findIndex((sql, index) => index > widen && sql.includes("ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')"));
    assert.ok(widen >= 0);
    assert.ok(mapCompleted > widen);
    assert.ok(mapPending > mapCompleted);
    assert.ok(narrow > mapPending);
    assert.ok(statements.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS finance_status_history")));
    assert.ok(statements.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS finance_attachments")));
    assert.ok(statements.some((sql) => sql.includes("Existing record imported into status history")));
    assert.equal(statements.some((sql) => /^(?:DROP|TRUNCATE|DELETE)\b/i.test(sql)), false);
  } finally {
    db.execute = originalExecute;
  }
});

test("Finance migration does not rebuild an already-current status enum", async () => {
  const originalExecute = db.execute;
  const calls = [];
  db.execute = async (sql, values = []) => {
    calls.push(String(sql));
    if (String(sql).includes("information_schema.columns")) {
      return [[{ column_name: values[1], column_type: values[1] === "status"
        ? "enum('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')"
        : "int" }]];
    }
    if (String(sql).includes("information_schema.statistics")) return [[{ index_name: values[1] }]];
    if (String(sql).includes("information_schema.table_constraints")) return [[{ constraint_name: values[1] }]];
    return [{ affectedRows: 1 }];
  };

  try {
    await ensureFinanceSchema();
    assert.equal(calls.some((sql) => String(sql).includes("ALTER TABLE finance_transactions\n      MODIFY COLUMN status")), false);
  } finally {
    db.execute = originalExecute;
  }
});
