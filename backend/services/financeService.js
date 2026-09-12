import db from "../database/db.js";
import { financeStatuses, financeTransactionTypes } from "../database/financeMigration.js";
import {
  assignedUnitNames,
  isGlobalLeader,
  isOperationalLeader,
  userHasUnitAccess,
} from "./authorizationService.js";

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
  const paymentMethod = String(body?.paymentMethod || "").trim();

  if (!transactionTypes.has(transactionType)) throw createHttpError(400, "Transaction type is invalid.");
  if (!paymentMethods.has(paymentMethod)) throw createHttpError(400, "Payment method is invalid.");

  return {
    transactionType,
    category: trimRequired(body?.category, "Category", 80),
    description: trimRequired(body?.description, "Description", 255),
    vendorPaidTo: trimOptional(body?.vendorPaidTo, "Vendor / paid to", 150),
    amount: normalizeAmount(body?.amount),
    paymentMethod,
    transactionDate: normalizeDate(body?.transactionDate, "Transaction date"),
    referenceNumber: trimOptional(body?.referenceNumber, "Reference number", 80),
    notes: trimOptional(body?.notes, "Notes", 4000),
  };
}

function normalizeReason(value, fieldName = "Reason") {
  return trimRequired(value, fieldName, 500);
}

function requestedUnit(body, fallback = null) {
  const value = body?.unit;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const unit = String(value).trim();
  if (!units.has(unit)) throw createHttpError(400, "Unit is invalid.");
  return unit;
}

function assertScope(user) {
  if (!isOperationalLeader(user)) {
    throw createHttpError(403, "Scout accounts cannot access Finance.");
  }
  if (user.role === "UNIT_LEADER" && assignedUnitNames(user).length === 0) {
    throw createHttpError(403, "Your account does not have an assigned Finance unit.");
  }
}

function assertCanAccessUnit(user, unit) {
  assertScope(user);
  if (!isGlobalLeader(user) && !userHasUnitAccess(user, unit)) {
    throw createHttpError(403, "You can only access transactions for your assigned units.");
  }
}

function resolveWriteUnit(user, body, existingUnit = null) {
  assertScope(user);
  const suppliedUnit = requestedUnit(body, existingUnit);

  if (!isGlobalLeader(user)) {
    const accessibleUnits = assignedUnitNames(user);
    if (suppliedUnit && !userHasUnitAccess(user, suppliedUnit)) {
      throw createHttpError(403, "You cannot create or move a transaction outside your assigned units.");
    }
    if (suppliedUnit) return suppliedUnit;
    if (accessibleUnits.length === 1) return accessibleUnits[0];
    throw createHttpError(400, "Select one of your assigned units for this transaction.");
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
    approvedBy: mapActor(row, "approved"),
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason || "",
    reversalOfId: row.reversal_of_id === null || row.reversal_of_id === undefined ? null : Number(row.reversal_of_id),
    reversingTransactionId: row.reversing_transaction_id === null || row.reversing_transaction_id === undefined ? null : Number(row.reversing_transaction_id),
  };
}

const transactionSelect = `
  SELECT t.*,
    created_user.full_name AS created_by_name,
    created_user.username AS created_by_username,
    updated_user.full_name AS updated_by_name,
    updated_user.username AS updated_by_username,
    approved_user.full_name AS approved_by_name,
    approved_user.username AS approved_by_username,
    (SELECT reversal.id FROM finance_transactions reversal
      WHERE reversal.reversal_of_id = t.id AND reversal.status = 'APPROVED'
      ORDER BY reversal.id DESC LIMIT 1) AS reversing_transaction_id
  FROM finance_transactions t
  LEFT JOIN users created_user ON created_user.id = t.created_by
  LEFT JOIN users updated_user ON updated_user.id = t.updated_by
  LEFT JOIN users approved_user ON approved_user.id = t.approved_by
`;

async function getTransactionRow(id, database = db, lock = false) {
  const [rows] = await database.execute(
    `${transactionSelect} WHERE t.id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] || null;
}

async function getAuthorizedTransaction(id, user, database = db, lock = false) {
  const transactionId = normalizeId(id);
  const row = await getTransactionRow(transactionId, database, lock);
  if (!row) throw createHttpError(404, "Transaction not found.");
  assertCanAccessUnit(user, row.unit);
  return row;
}

function appendFilters(user, filters) {
  assertScope(user);
  const conditions = [];
  const values = [];
  const unit = requestedUnit(filters, null);

  if (!isGlobalLeader(user)) {
    const accessibleUnits = assignedUnitNames(user);
    if (unit && !userHasUnitAccess(user, unit)) {
      throw createHttpError(403, "You can only filter your assigned units.");
    }
    if (unit) {
      conditions.push("t.unit = ?");
      values.push(unit);
    } else if (accessibleUnits.length === 1) {
      conditions.push("t.unit = ?");
      values.push(accessibleUnits[0]);
    } else {
      conditions.push(`t.unit IN (${accessibleUnits.map(() => "?").join(", ")})`);
      values.push(...accessibleUnits);
    }
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

async function withTransaction(action) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordStatusHistory(connection, transactionId, fromStatus, toStatus, reason, userId) {
  await connection.execute(
    `INSERT INTO finance_status_history
      (transaction_id, from_status, to_status, reason, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [transactionId, fromStatus, toStatus, reason || null, Number(userId)],
  );
}

export async function createTransaction(body, user) {
  const input = normalizeTransactionInput(body);
  const unit = resolveWriteUnit(user, body);
  const transactionId = await withTransaction(async (connection) => {
    const [result] = await connection.execute(`
      INSERT INTO finance_transactions
        (unit, transaction_type, category, description, vendor_paid_to, amount, payment_method, status, transaction_date, reference_number, notes, created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, NOW(), ?, NOW())
    `, [unit, input.transactionType, input.category, input.description, input.vendorPaidTo, input.amount, input.paymentMethod, input.transactionDate, input.referenceNumber, input.notes, Number(user.id), Number(user.id)]);
    await recordStatusHistory(connection, result.insertId, null, "DRAFT", "Transaction created", user.id);
    return result.insertId;
  });
  return mapTransaction(await getTransactionRow(transactionId));
}

export async function updateTransaction(id, body, user) {
  const input = normalizeTransactionInput(body);
  const transactionId = await withTransaction(async (connection) => {
    const existing = await getAuthorizedTransaction(id, user, connection, true);
    if (!["DRAFT", "REJECTED"].includes(existing.status)) {
      throw createHttpError(409, "Only draft or rejected transactions can be edited.");
    }
    const unit = resolveWriteUnit(user, body, existing.unit);
    const nextStatus = existing.status === "REJECTED" ? "DRAFT" : existing.status;
    await connection.execute(`
      UPDATE finance_transactions
      SET unit = ?, transaction_type = ?, category = ?, description = ?, vendor_paid_to = ?,
          amount = ?, payment_method = ?, status = ?, transaction_date = ?, reference_number = ?,
          notes = ?, rejection_reason = NULL, updated_by = ?, updated_at = NOW()
      WHERE id = ?
    `, [unit, input.transactionType, input.category, input.description, input.vendorPaidTo, input.amount, input.paymentMethod, nextStatus, input.transactionDate, input.referenceNumber, input.notes, Number(user.id), existing.id]);
    if (existing.status !== nextStatus) {
      await recordStatusHistory(connection, existing.id, existing.status, nextStatus, "Edited after rejection", user.id);
    }
    return existing.id;
  });
  return mapTransaction(await getTransactionRow(transactionId));
}

async function transitionTransaction(id, user, { allowed, toStatus, reason = null, adminOnly = false }) {
  if (adminOnly && user.role !== "ADMIN") {
    throw createHttpError(403, "Only an Admin can approve or reject financial transactions.");
  }
  const transactionId = await withTransaction(async (connection) => {
    const existing = await getAuthorizedTransaction(id, user, connection, true);
    if (!allowed.includes(existing.status)) {
      throw createHttpError(409, `A ${existing.status.toLowerCase()} transaction cannot move to ${toStatus.toLowerCase()}.`);
    }
    const approvalSql = toStatus === "APPROVED"
      ? ", approved_by = ?, approved_at = NOW(), rejection_reason = NULL"
      : toStatus === "REJECTED"
        ? ", approved_by = NULL, approved_at = NULL, rejection_reason = ?"
        : "";
    const values = [toStatus, Number(user.id)];
    if (toStatus === "APPROVED") values.push(Number(user.id));
    if (toStatus === "REJECTED") values.push(reason);
    values.push(existing.id);
    await connection.execute(
      `UPDATE finance_transactions SET status = ?, updated_by = ?, updated_at = NOW()${approvalSql} WHERE id = ?`,
      values,
    );
    await recordStatusHistory(connection, existing.id, existing.status, toStatus, reason, user.id);
    return existing.id;
  });
  return mapTransaction(await getTransactionRow(transactionId));
}

export function submitTransaction(id, user) {
  return transitionTransaction(id, user, {
    allowed: ["DRAFT", "REJECTED"],
    toStatus: "SUBMITTED",
    reason: "Submitted for approval",
  });
}

export function approveTransaction(id, user) {
  return transitionTransaction(id, user, {
    allowed: ["SUBMITTED"],
    toStatus: "APPROVED",
    reason: "Approved",
    adminOnly: true,
  });
}

export function rejectTransaction(id, reason, user) {
  return transitionTransaction(id, user, {
    allowed: ["SUBMITTED"],
    toStatus: "REJECTED",
    reason: normalizeReason(reason, "Rejection reason"),
    adminOnly: true,
  });
}

export function cancelTransaction(id, reason, user) {
  return transitionTransaction(id, user, {
    allowed: ["DRAFT", "SUBMITTED", "REJECTED"],
    toStatus: "CANCELLED",
    reason: normalizeReason(reason || "Cancelled by an authorized user", "Cancellation reason"),
  });
}

export async function reverseTransaction(id, reason, user) {
  if (user.role !== "ADMIN") throw createHttpError(403, "Only an Admin can reverse an approved transaction.");
  const reversalReason = normalizeReason(reason, "Reversal reason");
  const reversalId = await withTransaction(async (connection) => {
    const existing = await getAuthorizedTransaction(id, user, connection, true);
    if (existing.status !== "APPROVED") throw createHttpError(409, "Only an approved transaction can be reversed.");
    if (existing.reversal_of_id) throw createHttpError(409, "A reversal entry cannot be reversed.");
    if (existing.reversing_transaction_id) throw createHttpError(409, "This transaction already has an approved reversal.");
    const reverseType = existing.transaction_type === "INCOME" ? "EXPENSE" : "INCOME";
    const [result] = await connection.execute(`
      INSERT INTO finance_transactions
        (unit, transaction_type, category, description, vendor_paid_to, amount, payment_method,
         status, transaction_date, reference_number, notes, created_by, created_at, updated_by,
         updated_at, approved_by, approved_at, reversal_of_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', CURDATE(), ?, ?, ?, NOW(), ?, NOW(), ?, NOW(), ?)
    `, [
      existing.unit,
      reverseType,
      existing.category,
      `Reversal: ${existing.description}`.slice(0, 255),
      existing.vendor_paid_to,
      existing.amount,
      existing.payment_method,
      `REV-${existing.id}`,
      `Reversal reason: ${reversalReason}`,
      Number(user.id),
      Number(user.id),
      Number(user.id),
      existing.id,
    ]);
    await recordStatusHistory(
      connection,
      result.insertId,
      null,
      "APPROVED",
      `Reversal of transaction #${existing.id}: ${reversalReason}`,
      user.id,
    );
    return result.insertId;
  });
  return mapTransaction(await getTransactionRow(reversalId));
}

export async function listTransactionHistory(id, user) {
  const existing = await getAuthorizedTransaction(id, user);
  const [rows] = await db.execute(
    `SELECT history.*, actor.full_name AS changed_by_name, actor.username AS changed_by_username
     FROM finance_status_history history
     LEFT JOIN users actor ON actor.id = history.changed_by
     WHERE history.transaction_id = ?
     ORDER BY history.created_at ASC, history.id ASC`,
    [existing.id],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    fromStatus: row.from_status || null,
    toStatus: row.to_status,
    reason: row.reason || "",
    changedBy: row.changed_by ? {
      id: String(row.changed_by),
      fullName: row.changed_by_name || row.changed_by_username || "Former ScoutOS user",
      username: row.changed_by_username || "",
    } : null,
    createdAt: row.created_at,
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportTransactionsCsv(user, filters = {}) {
  const transactions = await listTransactions(user, filters);
  const headings = ["ID", "Date", "Unit", "Type", "Status", "Category", "Description", "Vendor / paid to", "Amount JOD", "Payment method", "Reference", "Created by", "Approved by", "Approved at", "Reversal of"];
  const rows = transactions.map((transaction) => [
    transaction.id,
    transaction.transactionDate,
    transaction.unit,
    transaction.transactionType,
    transaction.status,
    transaction.category,
    transaction.description,
    transaction.vendorPaidTo,
    transaction.amount.toFixed(2),
    transaction.paymentMethod,
    transaction.referenceNumber,
    transaction.createdBy?.fullName || "",
    transaction.approvedBy?.fullName || "",
    transaction.approvedAt || "",
    transaction.reversalOfId || "",
  ]);
  return `\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function getFinanceSummary(user, filters = {}) {
  const { where, values } = appendFilters(user, filters);
  const [rows] = await db.execute(`
    SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' AND t.status = 'APPROVED' THEN t.amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' AND t.status = 'APPROVED' THEN t.amount ELSE 0 END), 0) AS total_expenses,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' AND t.status = 'APPROVED' AND t.transaction_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND t.transaction_date <= CURDATE() THEN t.amount ELSE 0 END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN t.status = 'SUBMITTED' THEN 1 ELSE 0 END), 0) AS pending,
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
