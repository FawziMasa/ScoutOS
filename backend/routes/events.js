import {
  createEventRecord,
  deleteEventRecord,
  getEventRecord,
  listEventRecords,
  replaceEventRegistrations,
  updateEventRecord,
} from "../controllers/eventController.js";

export async function handleEventRoute(request, response, context) {
  const { path } = context;
  if (!path.startsWith("/api/events")) return false;

  if (request.method === "GET" && path === "/api/events") {
    await listEventRecords(request, response, context);
    return true;
  }
  if (request.method === "POST" && path === "/api/events") {
    await createEventRecord(request, response, context);
    return true;
  }

  const registrationMatch = path.match(/^\/api\/events\/(\d+)\/registrations$/);
  if (registrationMatch && request.method === "PUT") {
    await replaceEventRegistrations(request, response, context, registrationMatch[1]);
    return true;
  }

  const eventMatch = path.match(/^\/api\/events\/(\d+)$/);
  if (eventMatch) {
    if (request.method === "GET") await getEventRecord(request, response, context, eventMatch[1]);
    else if (request.method === "PUT") await updateEventRecord(request, response, context, eventMatch[1]);
    else if (request.method === "DELETE") await deleteEventRecord(request, response, context, eventMatch[1]);
    else return false;
    return true;
  }

  context.send(response, 404, { error: "Event route not found." });
  return true;
}
