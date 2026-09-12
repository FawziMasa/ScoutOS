import {
  createSession,
  deleteSession,
  getScoutAttendanceSummary,
  getSession,
  listSessions,
  saveAttendance,
  updateSession,
} from "../services/attendanceService.js";
import { LEADER_ROLES, requireAnyRole } from "../services/authorizationService.js";

function errorStatus(error) {
  const status = Number(error.status);
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }
  return 500;
}

function errorMessage(error) {
  if (error?.code === "ER_NO_REFERENCED_ROW_2") {
    return "The selected user, scout, or session no longer exists.";
  }
  if (error?.code === "ER_DUP_ENTRY") {
    return "This attendance record already exists.";
  }
  return error.message || "Attendance request failed.";
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    console.error("Attendance error:", error);
    send(response, errorStatus(error), { error: errorMessage(error) });
  }
}

function filtersFromRequest(request) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  return Object.fromEntries(url.searchParams.entries());
}

export async function listAttendanceSessions(request, response, context) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot take attendance.");
    const sessions = await listSessions(context.user, filtersFromRequest(request));
    context.send(response, 200, { sessions });
  });
}

export async function getAttendanceSession(request, response, context, id) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot take attendance.");
    const detail = await getSession(id, context.user, filtersFromRequest(request));
    context.send(response, 200, detail);
  });
}

export async function createAttendanceSession(request, response, context) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot create attendance sessions.");
    const body = await context.readJson(request);
    const session = await createSession(body, context.user);
    context.send(response, 201, { session });
  });
}

export async function updateAttendanceSession(request, response, context, id) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot edit attendance sessions.");
    const body = await context.readJson(request);
    const session = await updateSession(id, body, context.user);
    context.send(response, 200, { session });
  });
}

export async function deleteAttendanceSession(_request, response, context, id) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot delete attendance sessions.");
    await deleteSession(id, context.user);
    context.sendNoContent(response);
  });
}

export async function saveAttendanceRecords(request, response, context) {
  await run(response, context.send, async () => {
    requireAnyRole(context.user, LEADER_ROLES, "Scout accounts cannot save attendance.");
    const body = await context.readJson(request);
    const result = await saveAttendance(body, context.user);
    context.send(response, 200, result);
  });
}

export async function getScoutAttendance(_request, response, context, scoutId) {
  await run(response, context.send, async () => {
    const summary = await getScoutAttendanceSummary(scoutId, context.user);
    context.send(response, 200, { summary });
  });
}
