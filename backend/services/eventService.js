import db from "../database/db.js";
import { eventTypeValues } from "../database/eventMigration.js";

const eventTypes = new Set(eventTypeValues);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDate(value, fieldName) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createHttpError(400, `${fieldName} must be a valid date.`);
  }
  return date;
}

function normalizeTime(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const time = String(value).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw createHttpError(400, `${fieldName} must be a valid time.`);
  }
  return time.length === 5 ? `${time}:00` : time;
}

function trimOrNull(value, maxLength) {
  const trimmed = String(value || "").trim();
  return trimmed ? (maxLength ? trimmed.slice(0, maxLength) : trimmed) : null;
}

function normalizeEventInput(body) {
  const title = String(body.title || "").trim();
  const eventType = String(body.eventType || "Weekly Meeting").trim();
  const startDate = normalizeDate(body.startDate, "Start date");
  const endDate = normalizeDate(body.endDate || body.startDate, "End date");
  const capacityValue = String(body.capacity ?? "").trim();
  const capacity = capacityValue === "" ? null : Number(capacityValue);

  if (title.length < 2 || title.length > 150) {
    throw createHttpError(400, "Event title must be between 2 and 150 characters.");
  }
  if (!eventTypes.has(eventType)) throw createHttpError(400, "Event type is invalid.");
  if (endDate < startDate) throw createHttpError(400, "End date cannot be before the start date.");
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) {
    throw createHttpError(400, "Capacity must be a whole number between 1 and 10,000.");
  }

  return {
    title,
    eventType,
    startDate,
    endDate,
    startTime: normalizeTime(body.startTime, "Start time"),
    endTime: normalizeTime(body.endTime, "End time"),
    location: trimOrNull(body.location, 150),
    capacity,
    notes: trimOrNull(body.notes),
  };
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

function mapEvent(row) {
  return {
    id: Number(row.id),
    title: row.title,
    eventType: row.event_type,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    location: row.location || "",
    capacity: row.capacity === null ? null : Number(row.capacity),
    notes: row.notes || "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    registrationCount: Number(row.registration_count || 0),
  };
}

async function getEventRow(id) {
  const [rows] = await db.execute(`
    SELECT e.*, COUNT(r.id) AS registration_count
    FROM events e
    LEFT JOIN event_registrations r ON r.event_id = e.id
    WHERE e.id = ?
    GROUP BY e.id
    LIMIT 1
  `, [id]);
  return rows[0] || null;
}

async function assertEventExists(id) {
  const event = await getEventRow(id);
  if (!event) throw createHttpError(404, "Event not found.");
  return event;
}

function normalizeId(id) {
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId < 1) throw createHttpError(400, "Invalid event ID.");
  return eventId;
}

export async function listEvents() {
  const [rows] = await db.execute(`
    SELECT e.*, COUNT(r.id) AS registration_count
    FROM events e
    LEFT JOIN event_registrations r ON r.event_id = e.id
    GROUP BY e.id
    ORDER BY e.start_date ASC, e.start_time ASC, e.created_at DESC
  `);
  return rows.map(mapEvent);
}

export async function getEvent(id) {
  const eventId = normalizeId(id);
  const row = await assertEventExists(eventId);
  const [registrations] = await db.execute(`
    SELECT sc.id, sc.name, sc.unit, sc.status
    FROM event_registrations r
    INNER JOIN scouts sc ON sc.id = r.scout_id
    WHERE r.event_id = ?
    ORDER BY sc.name ASC
  `, [eventId]);
  return { event: mapEvent(row), registrations };
}

export async function createEvent(body, user) {
  const input = normalizeEventInput(body);
  const [result] = await db.execute(`
    INSERT INTO events
      (title, event_type, start_date, end_date, start_time, end_time, location, capacity, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [input.title, input.eventType, input.startDate, input.endDate, input.startTime, input.endTime, input.location, input.capacity, input.notes, Number(user.id)]);
  return mapEvent(await getEventRow(result.insertId));
}

export async function updateEvent(id, body) {
  const eventId = normalizeId(id);
  await assertEventExists(eventId);
  const input = normalizeEventInput(body);
  await db.execute(`
    UPDATE events
    SET title = ?, event_type = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?, location = ?, capacity = ?, notes = ?, updated_at = NOW()
    WHERE id = ?
  `, [input.title, input.eventType, input.startDate, input.endDate, input.startTime, input.endTime, input.location, input.capacity, input.notes, eventId]);
  return mapEvent(await getEventRow(eventId));
}

export async function deleteEvent(id) {
  const eventId = normalizeId(id);
  const [result] = await db.execute("DELETE FROM events WHERE id = ?", [eventId]);
  if (result.affectedRows === 0) throw createHttpError(404, "Event not found.");
}

export async function replaceRegistrations(id, body, user) {
  const eventId = normalizeId(id);
  const event = await assertEventExists(eventId);
  if (!Array.isArray(body.scoutIds)) throw createHttpError(400, "Scout registrations must be a list.");

  const scoutIds = [...new Set(body.scoutIds.map((scoutId) => String(scoutId || "").trim()).filter(Boolean))];
  if (event.capacity !== null && scoutIds.length > Number(event.capacity)) {
    throw createHttpError(400, `This event has a capacity of ${event.capacity}.`);
  }

  if (scoutIds.length > 0) {
    const placeholders = scoutIds.map(() => "?").join(", ");
    const [scouts] = await db.execute(`SELECT id, unit, status FROM scouts WHERE id IN (${placeholders})`, scoutIds);
    if (scouts.length !== scoutIds.length) throw createHttpError(400, "One or more selected scouts no longer exist.");
    if (scouts.some((scout) => scout.status !== "Active")) throw createHttpError(400, "Only active scouts can be registered.");
    if (user.role === "UNIT_LEADER" && scouts.some((scout) => scout.unit !== user.unit)) {
      throw createHttpError(403, "You can only register scouts from your assigned unit.");
    }
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM event_registrations WHERE event_id = ?", [eventId]);
    for (const scoutId of scoutIds) {
      await connection.execute("INSERT INTO event_registrations (event_id, scout_id, created_at) VALUES (?, ?, NOW())", [eventId, scoutId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getEvent(eventId);
}
