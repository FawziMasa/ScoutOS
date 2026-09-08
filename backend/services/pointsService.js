import db from "../database/db.js";

export function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function addPoints(scoutId, pointsChange, reason, leaderId) {
  if (!scoutId || typeof pointsChange !== 'number' || !reason || !leaderId) {
    throw createHttpError(400, "Invalid input for adding points.");
  }
  
  await db.execute(
    `INSERT INTO points_ledger (scout_id, points_change, reason, leader_id) VALUES (?, ?, ?, ?)`,
    [scoutId, pointsChange, reason, leaderId]
  );
}

export async function getLeaderboard() {
  const [rows] = await db.execute(`
    SELECT scout_id, SUM(points_change) as total_points, sc.name as scout_name
    FROM points_ledger pl
    JOIN scouts sc ON pl.scout_id = sc.id
    GROUP BY scout_id
    ORDER BY total_points DESC
  `);
  return rows;
}

export async function getScoutPointsHistory(scoutId) {
  const [rows] = await db.execute(`
    SELECT pl.*, u.full_name as leader_name
    FROM points_ledger pl
    JOIN users u ON pl.leader_id = u.id
    WHERE scout_id = ?
    ORDER BY created_at DESC
  `, [scoutId]);
  return rows;
}
