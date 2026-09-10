import db from "../database/db.js";
import { financeStatuses, financeTransactionTypes } from "../database/financeMigration.js";

const units = new Set(["أشبال و زهرات", "مبتدئ", "متقدم", "جوالة", "قيادة"]);
const transactionTypes = new Set(financeTransactionTypes);
const statuses = new Set(financeStatuses);
const paymentMethods = new Set(["Cash", "Bank Transfer", "Card", "Mobile Wallet", "Other"]);

export function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1) throw createHttpError(400, "Invalid transaction ID.");
  return value;
}

function trimRequired(value, fieldName, maxLength) {
  const result = String(value || "").trim();
  if (result.length < 2 || result.length > maxLength) {
    throw createHttpError(400, `${fieldName} must be between 2 and ${maxLength} characters.`);
  }
  return result;
}

function trimOptional(value, fieldName, maxLength) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const result = String(value).trim();
  if (result.length > maxLength) throw createHttpError(400, `${fieldName} must be at most ${maxLength} characters.`);
  return result;
}

function normalizeDate(value, fieldName) {
  const result = String(value || "").trim();
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }
  return result;
}

function formatDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function normalizeAmount(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    throw createHttpError(400, "Amount must be a positive value with no more than two decimal places.");
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    throw createHttpError(400, "Amount must be between 0.01 and 99,999,999.99.");
  }
  return amount.toFixed(2);
}

function normalizeTransactionInput(body) {
  const transactionType = String(body?.transactionType || "").trim().toUpperCase();
  const status = String(body?.status || "").trim().toUpperCase();
  const paymentMethod = String(body?.paymentMethod || "").trim();

  if (!transactionTypes.has(transactionType)) throw createHttpError(400, "Transaction type is invalid.");
  if (!statuses.has(status)) throw createHttpError(400, "Transaction status is invalid.");
  if (!paymentMethods.has(paymentMethod)) throw createHttpError(400, "Payment method is invalid.");

  return {
    transactionType,
    category: trimRequired(body?.category, "Category", 80),
    description: trimRequired(body?.description, "Description", 255),
    vendorPaidTo: trimOptional(body?.vendorPaidTo, "Vendor / paid to", 150),
    amount: normalizeAmount(body?.amount),
    paymentMethod,
    status,
    transactionDate: normalizeDate(body?.transactionDate, "Transaction date"),
    referenceNumber: trimOptional(body?.referenceNumber, "Reference number", 80),
    notes: trimOptional(body?.notes, "Notes", 4000),
  };
}

function requestedUnit(body, fallback = null) {
  const value = body?.unit;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const unit = String(value).trim();
  if (!units.has(unit)) throw createHttpError(400, "Unit is invalid.");
  return unit;
}

function isUnrestricted(user) {
  // Existing ScoutOS semantics: a Group Leader manages the whole scout group.
  return user.role === "ADMIN" || user.role === "GROUP_LEADER";
}

function assertScope(user) {
  if (isUnrestricted(user)) return;
  if (user.role !== "UNIT_LEADER" || !units.has(user.unit)) {
    throw createHttpError(403, "Your account does not have an assigned finance unit.");
  }
}

function assertCanAccessUnit(user, unit) {
  assertScope(user);
  if (!isUnrestricted(user) && unit !== user.unit) {
    throw createHttpError(403, "You can only access transactions for your assigned unit.");
  }
}

function resolveWriteUnit(user, body, existingUnit = null) {
  assertScope(user);
  const suppliedUnit = requestedUnit(body, existingUnit);

  if (!isUnrestricted(user)) {
    if (suppliedUnit && suppliedUnit !== user.unit) {
      throw createHttpError(403, "You cannot create or move a transaction outside your assigned unit.");
    }
    return user.unit;
  }

  if (!suppliedUnit) throw createHttpError(400, "Unit is required.");
  return suppliedUnit;
}

function mapActor(row, prefix) {
  const id = row[`${prefix}_by`];
  if (!id) return null;
  return {
    id: String(id),
    fullName: row[`${prefix}_by_name`] || row[`${prefix}_by_username`] || "Former ScoutOS user",
    username: row[`${prefix}_by_username`] || "",
  };
}

function mapTransaction(row) {
  return {
    id: Number(row.id),
    unit: row.unit,
    transactionType: row.transaction_type,
    category: row.category,
    description: row.description,
    vendorPaidTo: row.vendor_paid_to || "",
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    status: row.status,
    transactionDate: formatDate(row.transaction_date),
    referenceNumber: row.reference_number || "",
    notes: row.notes || "",
    createdBy: mapActor(row, "created"),
    createdAt: row.created_at,
    updatedBy: mapActor(row, "updated"),
    updatedAt: row.updated_at,
  };
}

const transactionSelect = `
  SELECT t.*,
    created_user.full_name AS created_by_name,
    created_user.username AS created_by_username,
    updated_user.full_name AS updated_by_name,
    updated_user.username AS updated_by_username
  FROM finance_transactions t
  LEFT JOIN users created_user ON created_user.id = t.created_by
  LEFT JOIN users updated_user ON updated_user.id = t.updated_by
`;

async function getTransactionRow(id) {
  const [rows] = await db.execute(`${transactionSelect} WHERE t.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function getAuthorizedTransaction(id, user) {
  const transactionId = normalizeId(id);
  const row = await getTransactionRow(transactionId);
  if (!row) throw createHttpError(404, "Transaction not found.");
  assertCanAccessUnit(user, row.unit);
  return row;
}

function appendFilters(user, filters) {
  assertScope(user);
  const conditions = [];
  const values = [];
  const unit = requestedUnit(filters, null);

  if (!isUnrestricted(user)) {
    if (unit && unit !== user.unit) throw createHttpError(403, "You can only filter your assigned unit.");
    conditions.push("t.unit = ?");
    values.push(user.unit);
  } else if (unit) {
    conditions.push("t.unit = ?");
    values.push(unit);
  }

  const transactionType = String(filters?.transactionType || "").trim().toUpperCase();
  if (transactionType) {
    if (!transactionTypes.has(transactionType)) throw createHttpError(400, "Transaction type filter is invalid.");
    conditions.push("t.transaction_type = ?");
    values.push(transactionType);
  }

  const category = String(filters?.category || "").trim();
  if (category) {
    if (category.length > 80) throw createHttpError(400, "Category filter is too long.");
    conditions.push("t.category = ?");
    values.push(category);
  }

  const status = String(filters?.status || "").trim().toUpperCase();
  if (status) {
    if (!statuses.has(status)) throw createHttpError(400, "Status filter is invalid.");
    conditions.push("t.status = ?");
    values.push(status);
  }

  const dateFrom = filters?.dateFrom ? normalizeDate(filters.dateFrom, "Date from") : null;
  const dateTo = filters?.dateTo ? normalizeDate(filters.dateTo, "Date to") : null;
  if (dateFrom && dateTo && dateFrom > dateTo) throw createHttpError(400, "Date from cannot be after date to.");
  if (dateFrom) { conditions.push("t.transaction_date >= ?"); values.push(dateFrom); }
  if (dateTo) { conditions.push("t.transaction_date <= ?"); values.push(dateTo); }

  const search = String(filters?.search || "").trim();
  if (search) {
    if (search.length > 120) throw createHttpError(400, "Search query is too long.");
    const like = `%${search}%`;
    conditions.push("(t.description LIKE ? OR t.category LIKE ? OR t.vendor_paid_to LIKE ? OR t.reference_number LIKE ?)");
    values.push(like, like, like, like);
  }

  return { where: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "", values };
}

export async function listTransactions(user, filters = {}) {
  const { where, values } = appendFilters(user, filters);
  const [rows] = await db.execute(`${transactionSelect}${where} ORDER BY t.transaction_date DESC, t.id DESC`, values);
  return rows.map(mapTransaction);
}

export async function getTransaction(id, user) {
  return mapTransaction(await getAuthorizedTransaction(id, user));
}

export async function createTransaction(body, user) {
  const input = normalizeTransactionInput(body);
  const unit = resolveWriteUnit(user, body);
  const [result] = await db.execute(`
    INSERT INTO finance_transactions
      (unit, transaction_type, category, description, vendor_paid_to, amount, payment_method, status, transaction_date, reference_number, notes, created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())
  `, [unit, input.transactionType, input.category, input.description, input.vendorPaidTo, input.amount, input.paymentMethod, input.status, input.transactionDate, input.referenceNumber, input.notes, Number(user.id), Number(user.id)]);
  return mapTransaction(await getTransactionRow(result.insertId));
}

export async function updateTransaction(id, body, user) {
  const existing = await getAuthorizedTransaction(id, user);
  const input = normalizeTransactionInput(body);
  const unit = resolveWriteUnit(user, body, existing.unit);

  await db.execute(`
    UPDATE finance_transactions
    SET unit = ?, transaction_type = ?, category = ?, description = ?, vendor_paid_to = ?, amount = ?, payment_method = ?, status = ?, transaction_date = ?, reference_number = ?, notes = ?, updated_by = ?, updated_at = NOW()
    WHERE id = ?
  `, [unit, input.transactionType, input.category, input.description, input.vendorPaidTo, input.amount, input.paymentMethod, input.status, input.transactionDate, input.referenceNumber, input.notes, Number(user.id), existing.id]);
  return mapTransaction(await getTransactionRow(existing.id));
}

export async function deleteTransaction(id, user) {
  const existing = await getAuthorizedTransaction(id, user);
  await db.execute("DELETE FROM finance_transactions WHERE id = ?", [existing.id]);
}

export async function getFinanceSummary(user, filters = {}) {
  const { where, values } = appendFilters(user, filters);
  const [rows] = await db.execute(`
    SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' AND t.status <> 'CANCELLED' THEN t.amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' AND t.status <> 'CANCELLED' THEN t.amount ELSE 0 END), 0) AS total_expenses,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' AND t.status <> 'CANCELLED' AND t.transaction_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND t.transaction_date <= CURDATE() THEN t.amount ELSE 0 END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN t.status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending,
      COUNT(*) AS transactions
    FROM finance_transactions t${where}
  `, values);
  const row = rows[0];
  const totalIncome = Number(row.total_income);
  const totalExpenses = Number(row.total_expenses);
  const balance = totalIncome - totalExpenses;
  return {
    totalIncome,
    totalExpenses,
    balance,
    debt: balance < 0 ? Math.abs(balance) : 0,
    thisMonth: Number(row.this_month),
    pending: Number(row.pending),
    transactions: Number(row.transactions),
  };
}
