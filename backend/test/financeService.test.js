import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const { default: db } = await import("../database/db.js");
const {
  approveTransaction,
  createTransaction,
  exportTransactionsCsv,
  getFinanceSummary,
  listTransactions,
  reverseTransaction,
  submitTransaction,
  updateTransaction,
} = await import("../services/financeService.js");

const unitLeader = { id: "12", role: "UNIT_LEADER", unit: "أشبال و زهرات" };
const admin = { id: "99", role: "ADMIN", unit: null };

function input(overrides = {}) {
  return {
    unit: "أشبال و زهرات",
    transactionType: "EXPENSE",
    category: "Equipment",
    description: "Tent repair",
    vendorPaidTo: "Camp Supply",
    amount: "25.00",
    paymentMethod: "Cash",
    transactionDate: "2026-09-11",
    referenceNumber: "R-001",
    notes: "Safety repair",
    ...overrides,
  };
}

function transactionRow(overrides = {}) {
  return {
    id: 8,
    unit: "أشبال و زهرات",
    transaction_type: "EXPENSE",
    category: "Equipment",
    description: "Tent repair",
    vendor_paid_to: "Camp Supply",
    amount: "25.00",
    payment_method: "Cash",
    status: "DRAFT",
    transaction_date: new Date("2026-09-11T00:00:00Z"),
    reference_number: "R-001",
    notes: "Safety repair",
    created_by: 12,
    created_at: new Date("2026-09-11T10:00:00Z"),
    updated_by: 12,
    updated_at: new Date("2026-09-11T10:00:00Z"),
    created_by_name: "Ahmad",
    created_by_username: "ahmad",
    updated_by_name: "Ahmad",
    updated_by_username: "ahmad",
    ...overrides,
  };
}

function installTransactionalMock(resolver) {
  const originalExecute = db.execute;
  const originalGetConnection = db.getConnection;
  const calls = [];
  const execute = async (sql, values) => {
    calls.push({ sql, values });
    return resolver(sql, values);
  };
  db.execute = execute;
  db.getConnection = async () => ({
    execute,
    async beginTransaction() { calls.push({ sql: "BEGIN" }); },
    async commit() { calls.push({ sql: "COMMIT" }); },
    async rollback() { calls.push({ sql: "ROLLBACK" }); },
    release() {},
  });
  return {
    calls,
    restore() {
      db.execute = originalExecute;
      db.getConnection = originalGetConnection;
    },
  };
}

test("finance queries permanently scope Unit Leaders to their assigned unit", async () => {
  const originalExecute = db.execute;
  const calls = [];
  db.execute = async (sql, values) => {
    calls.push({ sql, values });
    return [[]];
  };

  try {
    await listTransactions(unitLeader);
    assert.match(calls[0].sql, /WHERE t\.unit = \?/);
    assert.deepEqual(calls[0].values, ["أشبال و زهرات"]);
    await assert.rejects(
      () => listTransactions(unitLeader, { unit: "مبتدئ" }),
      (error) => error.status === 403,
    );
  } finally {
    db.execute = originalExecute;
  }
});

test("finance queries support all assigned units for a multi-unit leader", async () => {
  const originalExecute = db.execute;
  const calls = [];
  db.execute = async (sql, values) => {
    calls.push({ sql, values });
    return [[]];
  };
  const multiUnitLeader = {
    ...unitLeader,
    assignedUnits: [
      { id: 1, name: "أشبال و زهرات" },
      { id: 2, name: "مبتدئ" },
    ],
  };
  try {
    await listTransactions(multiUnitLeader);
    assert.match(calls[0].sql, /WHERE t\.unit IN \(\?, \?\)/);
    assert.deepEqual(calls[0].values, ["أشبال و زهرات", "مبتدئ"]);
    await listTransactions(multiUnitLeader, { unit: "مبتدئ" });
    assert.match(calls[1].sql, /WHERE t\.unit = \?/);
    assert.deepEqual(calls[1].values, ["مبتدئ"]);
  } finally {
    db.execute = originalExecute;
  }
});

test("a Unit Leader cannot forge another unit on transaction creation", async () => {
  const originalExecute = db.execute;
  db.execute = async () => {
    throw new Error("The write must not reach the database.");
  };

  try {
    await assert.rejects(
      () => createTransaction(input({ unit: "مبتدئ" }), unitLeader),
      (error) => error.status === 403,
    );
  } finally {
    db.execute = originalExecute;
  }
});

test("an Admin correction preserves created_by and records the authenticated updater", async () => {
  const originalExecute = db.execute;
  const originalGetConnection = db.getConnection;
  const calls = [];
  const execute = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT t.*")) return [[transactionRow()]];
    if (sql.includes("UPDATE finance_transactions")) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  db.execute = execute;
  db.getConnection = async () => ({
    execute,
    async beginTransaction() { calls.push({ sql: "BEGIN" }); },
    async commit() { calls.push({ sql: "COMMIT" }); },
    async rollback() { calls.push({ sql: "ROLLBACK" }); },
    release() {},
  });

  try {
    await updateTransaction(8, input({ unit: "مبتدئ", amount: "25.00" }), admin);
    const update = calls.find((call) => call.sql.includes("UPDATE finance_transactions"));
    assert.ok(update);
    assert.doesNotMatch(update.sql, /created_by/);
    assert.equal(update.values.at(-2), 99);
    assert.equal(update.values.at(-1), 8);
  } finally {
    db.execute = originalExecute;
    db.getConnection = originalGetConnection;
  }
});

test("a creator cannot self-approve by submitting a forged status", async () => {
  const mock = installTransactionalMock(async (sql) => {
    if (sql.includes("INSERT INTO finance_transactions")) return [{ insertId: 8 }];
    if (sql.includes("SELECT t.*")) return [[transactionRow({ status: "DRAFT" })]];
    return [{ affectedRows: 1 }];
  });
  try {
    const result = await createTransaction(input({ status: "APPROVED" }), unitLeader);
    assert.equal(result.status, "DRAFT");
    const insert = mock.calls.find((call) => call.sql.includes("INSERT INTO finance_transactions"));
    assert.match(insert.sql, /'DRAFT'/);
    assert.equal(insert.values.includes("APPROVED"), false);
  } finally {
    mock.restore();
  }
});

test("submitting a draft writes append-only history and never deletes the record", async () => {
  let selectCount = 0;
  const mock = installTransactionalMock(async (sql) => {
    if (sql.includes("SELECT t.*")) {
      selectCount += 1;
      return [[transactionRow({ status: selectCount === 1 ? "DRAFT" : "SUBMITTED" })]];
    }
    return [{ affectedRows: 1 }];
  });
  try {
    const result = await submitTransaction(8, unitLeader);
    assert.equal(result.status, "SUBMITTED");
    assert.ok(mock.calls.some((call) => call.sql.includes("INSERT INTO finance_status_history")));
    assert.ok(mock.calls.some((call) => call.sql.includes("SET status = ?") && call.values[0] === "SUBMITTED"));
    assert.equal(mock.calls.some((call) => call.sql.includes("DELETE FROM finance_transactions")), false);
  } finally {
    mock.restore();
  }
});

test("only an Admin can approve a submitted transaction", async () => {
  await assert.rejects(
    () => approveTransaction(8, unitLeader),
    (error) => error.status === 403,
  );

  let selectCount = 0;
  const mock = installTransactionalMock(async (sql) => {
    if (sql.includes("SELECT t.*")) {
      selectCount += 1;
      return [[transactionRow({
        status: selectCount === 1 ? "SUBMITTED" : "APPROVED",
        approved_by: selectCount === 1 ? null : 99,
        approved_at: selectCount === 1 ? null : new Date("2026-09-12T10:00:00Z"),
      })]];
    }
    return [{ affectedRows: 1 }];
  });
  try {
    const result = await approveTransaction(8, admin);
    assert.equal(result.status, "APPROVED");
    const update = mock.calls.find((call) => call.sql.includes("approved_by = ?"));
    assert.ok(update);
    assert.equal(update.values[2], 99);
  } finally {
    mock.restore();
  }
});

test("reversal creates one opposite approved entry and preserves the original", async () => {
  let selectCount = 0;
  const mock = installTransactionalMock(async (sql) => {
    if (sql.includes("SELECT t.*")) {
      selectCount += 1;
      if (selectCount === 1) return [[transactionRow({ status: "APPROVED", approved_by: 99 })]];
      return [[transactionRow({
        id: 19,
        transaction_type: "INCOME",
        status: "APPROVED",
        reversal_of_id: 8,
        approved_by: 99,
      })]];
    }
    if (sql.includes("INSERT INTO finance_transactions")) return [{ insertId: 19 }];
    return [{ affectedRows: 1 }];
  });
  try {
    const result = await reverseTransaction(8, "Duplicate expense", admin);
    assert.equal(result.id, 19);
    assert.equal(result.transactionType, "INCOME");
    assert.equal(result.reversalOfId, 8);
    const insert = mock.calls.find((call) => call.sql.includes("INSERT INTO finance_transactions"));
    assert.ok(insert);
    assert.equal(insert.values[1], "INCOME");
    assert.equal(insert.values.at(-1), 8);
    assert.equal(mock.calls.some((call) => call.sql.includes("DELETE FROM finance_transactions")), false);
  } finally {
    mock.restore();
  }
});

test("CSV export preserves authorization filters and neutralizes spreadsheet formulas", async () => {
  const originalExecute = db.execute;
  const calls = [];
  db.execute = async (sql, values) => {
    calls.push({ sql, values });
    return [[transactionRow({ description: "=HYPERLINK(\"bad\")", status: "APPROVED" })]];
  };
  try {
    const csv = await exportTransactionsCsv(unitLeader, { status: "APPROVED" });
    assert.equal(csv.startsWith("\uFEFF"), true);
    assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
    assert.match(calls[0].sql, /t\.unit = \?/);
    assert.deepEqual(calls[0].values, ["أشبال و زهرات", "APPROVED"]);
  } finally {
    db.execute = originalExecute;
  }
});

test("financial summary reports the whole balance and debt from income minus expenses", async () => {
  const originalExecute = db.execute;
  let query = "";
  db.execute = async (sql) => {
    query = sql;
    return [[{
    total_income: "3.00",
    total_expenses: "0.00",
    this_month: "0.00",
    pending: 0,
    transactions: 1,
    }]];
  };

  try {
    const summary = await getFinanceSummary(admin);
    assert.match(query, /status = 'APPROVED'/);
    assert.match(query, /status = 'SUBMITTED'/);
    assert.deepEqual(summary, {
      totalIncome: 3,
      totalExpenses: 0,
      balance: 3,
      debt: 0,
      thisMonth: 0,
      pending: 0,
      transactions: 1,
    });
  } finally {
    db.execute = originalExecute;
  }
});
