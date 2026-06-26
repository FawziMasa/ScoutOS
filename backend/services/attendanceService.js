import db from "../database/db.js";
import { meetingTypeValues, statusValues } from "../database/attendanceMigration.js";

const meetingTypes = new Set(meetingTypeValues);
const attendanceStatuses = new Set(statusValues);

export function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function trimOrNull(value, maxLength) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeDate(value, fieldName) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }
  return date;
}

function normalizeTime(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const time = String(value).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw createHttpError(400, `${fieldName} must be a valid time.`);
  }

  return time.length === 5 ? `${time}:00` : time;
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function normalizeSessionInput(body) {
  const meetingName = String(body.meetingName || "").trim();
  const meetingType = String(body.meetingType || "Weekly Meeting").trim();
  const meetingDate = normalizeDate(body.meetingDate, "Meeting date");
  const startTime = normalizeTime(body.startTime, "Start time");
  const endTime = normalizeTime(body.endTime, "End time");

  if (meetingName.length < 2) {
    throw createHttpError(400, "Meeting name is required.");
  }

  if (meetingName.length > 150) {
    throw createHttpError(400, "Meeting name must be 150 characters or fewer.");
  }

  if (!meetingTypes.has(meetingType)) {
    throw createHttpError(400, "Meeting type is invalid.");
  }

  return {
    meetingName,
    meetingType,
    meetingDate,
    startTime,
    endTime,
    location: trimOrNull(body.location, 150),
    notes: trimOrNull(body.notes),
  };
}

function normalizeRecordInput(record) {
  const scoutId = String(record.scoutId || "").trim();
  const status = String(record.status || "").trim();

  if (!scoutId) {
    throw createHttpError(400, "Every attendance record needs a scout ID.");
  }

  if (!attendanceStatuses.has(status)) {
    throw createHttpError(400, `Invalid attendance status for scout ${scoutId}.`);
  }

  return {
    scoutId,
    status,
    arrivalTime: normalizeTime(record.arrivalTime, "Arrival time"),
    notes: trimOrNull(record.notes, 255),
  };
}

function sessionStatsFromRow(row) {
  const totalScouts = Number(row.total_scouts || 0);
  const present = Number(row.present_count || 0);
  const absent = Number(row.absent_count || 0);
  const late = Number(row.late_count || 0);
  const excused = Number(row.excused_count || 0);
  const attendanceRate = totalScouts > 0 ? Math.round(((present + late) / totalScouts) * 100) : 0;

  return {
    totalScouts,
    present,
    absent,
    late,
    excused,
    attendanceRate,
  };
}

function mapSession(row) {
  return {
    id: Number(row.id),
    meetingName: row.meeting_name,
    meetingType: row.meeting_type,
    meetingDate: formatDate(row.meeting_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    location: row.location || "",
    notes: row.notes || "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: sessionStatsFromRow(row),
  };
}

function mapRecord(row) {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    scoutId: row.scout_id,
    status: row.status,
    arrivalTime: formatTime(row.arrival_time),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scout: {
      id: row.scout_id,
      name: row.scout_name || "",
      age: Number(row.scout_age || 0),
      unit: row.scout_unit || "",
      phone: row.scout_phone || "",
      guardian: row.scout_guardian || "",
      joinedAt: formatDate(row.scout_joined_at),
      status: row.scout_status || "Active",
      createdAt: row.scout_created_at,
      updatedAt: row.scout_updated_at,
    },
  };
}

async function getSessionRow(id) {
  const [rows] = await db.execute(
    `
      SELECT
        s.*,
        COALESCE(a.total_scouts, 0) AS total_scouts,
        COALESCE(a.present_count, 0) AS present_count,
        COALESCE(a.absent_count, 0) AS absent_count,
        COALESCE(a.late_count, 0) AS late_count,
        COALESCE(a.excused_count, 0) AS excused_count
      FROM attendance_sessions s
      LEFT JOIN (
        SELECT
          session_id,
          COUNT(*) AS total_scouts,
          SUM(status = 'present') AS present_count,
          SUM(status = 'absent') AS absent_count,
          SUM(status = 'late') AS late_count,
          SUM(status = 'excused') AS excused_count
        FROM attendance_records
        GROUP BY session_id
      ) a ON a.session_id = s.id
      WHERE s.id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}

async function assertSessionExists(sessionId) {
  const session = await getSessionRow(sessionId);
  if (!session) throw createHttpError(404, "Attendance session not found.");
  return session;
}

export async function listSessions() {
  const [rows] = await db.execute(`
    SELECT
      s.*,
      COALESCE(a.total_scouts, 0) AS total_scouts,
      COALESCE(a.present_count, 0) AS present_count,
      COALESCE(a.absent_count, 0) AS absent_count,
      COALESCE(a.late_count, 0) AS late_count,
      COALESCE(a.excused_count, 0) AS excused_count
    FROM attendance_sessions s
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) AS total_scouts,
        SUM(status = 'present') AS present_count,
        SUM(status = 'absent') AS absent_count,
        SUM(status = 'late') AS late_count,
        SUM(status = 'excused') AS excused_count
      FROM attendance_records
      GROUP BY session_id
    ) a ON a.session_id = s.id
    ORDER BY s.meeting_date DESC, s.start_time DESC, s.created_at DESC
  `);

  return rows.map(mapSession);
}

export async function getSession(id) {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw createHttpError(400, "Invalid attendance session ID.");
  }

  const sessionRow = await assertSessionExists(sessionId);
  const [recordRows] = await db.execute(
    `
      SELECT
        r.*,
        sc.name AS scout_name,
        sc.age AS scout_age,
        sc.unit AS scout_unit,
        sc.phone AS scout_phone,
        sc.guardian AS scout_guardian,
        sc.joined_at AS scout_joined_at,
        sc.status AS scout_status,
        sc.created_at AS scout_created_at,
        sc.updated_at AS scout_updated_at
      FROM attendance_records r
      INNER JOIN scouts sc ON sc.id = r.scout_id
      WHERE r.session_id = ?
      ORDER BY sc.name ASC
    `,
    [sessionId],
  );

  return {
    session: mapSession(sessionRow),
    records: recordRows.map(mapRecord),
  };
}

export async function createSession(body, user) {
  const input = normalizeSessionInput(body);
  const createdBy = Number.isInteger(Number(user.id)) ? Number(user.id) : null;

  const [result] = await db.execute(
    `
      INSERT INTO attendance_sessions
        (meeting_name, meeting_type, meeting_date, start_time, end_time, location, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      input.meetingName,
      input.meetingType,
      input.meetingDate,
      input.startTime,
      input.endTime,
      input.location,
      input.notes,
      createdBy,
    ],
  );

  const sessionRow = await getSessionRow(result.insertId);
  return mapSession(sessionRow);
}

export async function updateSession(id, body) {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw createHttpError(400, "Invalid attendance session ID.");
  }

  await assertSessionExists(sessionId);
  const input = normalizeSessionInput(body);

  await db.execute(
    `
      UPDATE attendance_sessions
      SET
        meeting_name = ?,
        meeting_type = ?,
        meeting_date = ?,
        start_time = ?,
        end_time = ?,
        location = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [
      input.meetingName,
      input.meetingType,
      input.meetingDate,
      input.startTime,
      input.endTime,
      input.location,
      input.notes,
      sessionId,
    ],
  );

  const sessionRow = await getSessionRow(sessionId);
  return mapSession(sessionRow);
}

export async function deleteSession(id) {
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw createHttpError(400, "Invalid attendance session ID.");
  }

  const [result] = await db.execute("DELETE FROM attendance_sessions WHERE id = ?", [sessionId]);
  if (result.affectedRows === 0) {
    throw createHttpError(404, "Attendance session not found.");
  }
}

export async function saveAttendance(body) {
  const sessionId = Number(body.sessionId);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw createHttpError(400, "A valid session ID is required.");
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    throw createHttpError(400, "Attendance cannot be empty.");
  }

  await assertSessionExists(sessionId);

  const seenScouts = new Set();
  const records = body.records.map((record) => {
    const normalized = normalizeRecordInput(record);
    if (seenScouts.has(normalized.scoutId)) {
      throw createHttpError(400, "Duplicate attendance records are not allowed.");
    }
    seenScouts.add(normalized.scoutId);
    return normalized;
  });

  const placeholders = records.map(() => "?").join(", ");
  const [scoutRows] = await db.execute(
    `SELECT id FROM scouts WHERE id IN (${placeholders})`,
    records.map((record) => record.scoutId),
  );
  const validScoutIds = new Set(scoutRows.map((row) => row.id));
  const missingScout = records.find((record) => !validScoutIds.has(record.scoutId));

  if (missingScout) {
    throw createHttpError(400, `Scout ${missingScout.scoutId} does not exist.`);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      "SELECT COUNT(*) AS total FROM attendance_records WHERE session_id = ?",
      [sessionId],
    );
    const updatedExistingAttendance = Number(existingRows[0]?.total || 0) > 0;

    for (const record of records) {
      await connection.execute(
        `
          INSERT INTO attendance_records
            (session_id, scout_id, status, arrival_time, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            arrival_time = VALUES(arrival_time),
            notes = VALUES(notes),
            updated_at = NOW()
        `,
        [
          sessionId,
          record.scoutId,
          record.status,
          record.arrivalTime,
          record.notes,
        ],
      );
    }

    await connection.commit();

    const detail = await getSession(sessionId);
    return {
      ...detail,
      updated: updatedExistingAttendance,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getScoutAttendanceSummary(scoutId) {
  const id = String(scoutId || "").trim();
  if (!id) throw createHttpError(400, "Scout ID is required.");

  const [records] = await db.execute(
    `
      SELECT
        r.status,
        r.arrival_time,
        r.notes,
        s.id AS session_id,
        s.meeting_name,
        s.meeting_type,
        s.meeting_date,
        s.location
      FROM attendance_records r
      INNER JOIN attendance_sessions s ON s.id = r.session_id
      WHERE r.scout_id = ?
      ORDER BY s.meeting_date DESC, s.start_time DESC
    `,
    [id],
  );

  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };

  for (const record of records) {
    counts[record.status] += 1;
  }

  const total = records.length;
  const attendancePercentage = total > 0
    ? Math.round(((counts.present + counts.late) / total) * 100)
    : 0;

  return {
    scoutId: id,
    total,
    ...counts,
    attendancePercentage,
    history: records.map((record) => ({
      sessionId: Number(record.session_id),
      meetingName: record.meeting_name,
      meetingType: record.meeting_type,
      meetingDate: formatDate(record.meeting_date),
      location: record.location || "",
      status: record.status,
      arrivalTime: formatTime(record.arrival_time),
      notes: record.notes || "",
    })),
  };
}
