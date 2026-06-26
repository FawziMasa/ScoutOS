import {
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceSession,
  getScoutAttendance,
  listAttendanceSessions,
  saveAttendanceRecords,
  updateAttendanceSession,
} from "../controllers/attendanceController.js";

export async function handleAttendanceRoute(request, response, context) {
  const { path } = context;

  if (!path.startsWith("/api/attendance")) {
    return false;
  }

  if (request.method === "GET" && path === "/api/attendance/sessions") {
    await listAttendanceSessions(request, response, context);
    return true;
  }

  if (request.method === "POST" && path === "/api/attendance/sessions") {
    await createAttendanceSession(request, response, context);
    return true;
  }

  if (request.method === "POST" && path === "/api/attendance/save") {
    await saveAttendanceRecords(request, response, context);
    return true;
  }

  const sessionMatch = path.match(/^\/api\/attendance\/sessions\/(\d+)$/);

  if (sessionMatch) {
    const sessionId = sessionMatch[1];

    if (request.method === "GET") {
      await getAttendanceSession(request, response, context, sessionId);
      return true;
    }

    if (request.method === "PUT") {
      await updateAttendanceSession(request, response, context, sessionId);
      return true;
    }

    if (request.method === "DELETE") {
      await deleteAttendanceSession(request, response, context, sessionId);
      return true;
    }
  }

  const scoutSummaryMatch = path.match(/^\/api\/attendance\/scouts\/([a-zA-Z0-9-]+)\/summary$/);

  if (request.method === "GET" && scoutSummaryMatch) {
    await getScoutAttendance(request, response, context, scoutSummaryMatch[1]);
    return true;
  }

  context.send(response, 404, { error: "Attendance route not found." });
  return true;
}
