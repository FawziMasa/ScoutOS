import {
  createSession,
  deleteSession,
  getScoutAttendanceSummary,
  getSession,
  listSessions,
  saveAttendance,
  updateSession,
} from "../services/attendanceService.js";

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

export async function listAttendanceSessions(_request, response, context) {
  await run(response, context.send, async () => {
    const sessions = await listSessions();
    context.send(response, 200, { sessions });
  });
}

export async function getAttendanceSession(_request, response, context, id) {
  await run(response, context.send, async () => {
    const detail = await getSession(id);
    context.send(response, 200, detail);
  });
}

export async function createAttendanceSession(request, response, context) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    const session = await createSession(body, context.user);
    context.send(response, 201, { session });
  });
}

export async function updateAttendanceSession(request, response, context, id) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    const session = await updateSession(id, body);
    context.send(response, 200, { session });
  });
}

export async function deleteAttendanceSession(_request, response, context, id) {
  await run(response, context.send, async () => {
    await deleteSession(id);
    context.sendNoContent(response);
  });
}

export async function saveAttendanceRecords(request, response, context) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    const result = await saveAttendance(body);
    context.send(response, 200, result);
  });
}

export async function getScoutAttendance(_request, response, context, scoutId) {
  await run(response, context.send, async () => {
    const summary = await getScoutAttendanceSummary(scoutId);
    context.send(response, 200, { summary });
  });
}
