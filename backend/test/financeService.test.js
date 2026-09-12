import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const { default: db } = await import("../database/db.js");
const { createTransaction, getFinanceSummary, listTransactions, updateTransaction } = await import("../services/financeService.js");

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
    status: "COMPLETED",
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
    status: "COMPLETED",
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
  const calls = [];
  db.execute = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT t.*")) return [[transactionRow()]];
    if (sql.includes("UPDATE finance_transactions")) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  try {
    await updateTransaction(8, input({ unit: "مبتدئ", amount: "25.00" }), admin);
    const update = calls.find((call) => call.sql.includes("UPDATE finance_transactions"));
    assert.ok(update);
    assert.doesNotMatch(update.sql, /created_by/);
    assert.equal(update.values.at(-2), 99);
    assert.equal(update.values.at(-1), 8);
  } finally {
    db.execute = originalExecute;
  }
});

test("financial summary reports the whole balance and debt from income minus expenses", async () => {
  const originalExecute = db.execute;
  db.execute = async () => [[{
    total_income: "3.00",
    total_expenses: "0.00",
    this_month: "0.00",
    pending: 0,
    transactions: 1,
  }]];

  try {
    const summary = await getFinanceSummary(admin);
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
