import db from "../database/db.js";
import {
  assertScoutManageAccess,
  assertScoutReadAccess,
} from "./authorizationService.js";

export function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapTransaction(row) {
  return {
    id: Number(row.id),
    scoutId: row.scout_id,
    pointsChange: Number(row.points_change),
    reason: row.reason,
    leaderId: String(row.leader_id),
    leaderName: row.leader_name || "",
    createdAt: row.created_at,
  };
}

async function getScout(scoutId) {
  const [rows] = await db.execute("SELECT id, name, unit, status FROM scouts WHERE id = ? LIMIT 1", [scoutId]);
  if (!rows[0]) throw createHttpError(404, "Scout not found.");
  return rows[0];
}

export async function addPoints(scoutId, pointsChange, reason, user, requestId = null) {
  const delta = Number(pointsChange);
  const normalizedReason = String(reason || "").trim();
  const normalizedRequestId = requestId ? String(requestId).trim().slice(0, 64) : null;
  if (!scoutId || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) {
    throw createHttpError(400, "Points must be a non-zero whole number between -10,000 and 10,000.");
  }
  if (normalizedReason.length < 2 || normalizedReason.length > 255) {
    throw createHttpError(400, "A reason between 2 and 255 characters is required.");
  }

  const scout = await getScout(scoutId);
  assertScoutManageAccess(user, scout);

  try {
    const [result] = await db.execute(
      `INSERT INTO points_ledger (scout_id, points_change, reason, leader_id, request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [scoutId, delta, normalizedReason, Number(user.id), normalizedRequestId],
    );
    return {
      id: Number(result.insertId),
      scoutId,
      pointsChange: delta,
      reason: normalizedReason,
      leaderId: String(user.id),
      leaderName: user.fullName,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error?.code !== "ER_DUP_ENTRY" || !normalizedRequestId) throw error;
    const [rows] = await db.execute(
      `SELECT pl.*, u.full_name AS leader_name FROM points_ledger pl
       INNER JOIN users u ON u.id = pl.leader_id
       WHERE pl.leader_id = ? AND pl.request_id = ? LIMIT 1`,
      [Number(user.id), normalizedRequestId],
    );
    return mapTransaction(rows[0]);
  }
}

export async function getLeaderboard() {
  const [rows] = await db.execute(`
    SELECT sc.id as scoutId, sc.name as name, sc.unit, COALESCE(SUM(pl.points_change), 0) as totalPoints
    FROM scouts sc
    LEFT JOIN points_ledger pl ON sc.id = pl.scout_id
    WHERE sc.status = 'Active'
    GROUP BY sc.id
    ORDER BY totalPoints DESC
  `);
  return rows;
}

export async function getScoutPointsHistory(scoutId, user) {
  const scout = await getScout(scoutId);
  assertScoutReadAccess(user, scout);
  const [rows] = await db.execute(`
    SELECT pl.*, u.full_name as leader_name
    FROM points_ledger pl
    JOIN users u ON pl.leader_id = u.id
    WHERE scout_id = ?
    ORDER BY created_at DESC
  `, [scoutId]);
  return rows.map(mapTransaction);
}
