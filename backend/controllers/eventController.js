import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  replaceRegistrations,
  updateEvent,
} from "../services/eventService.js";

function errorStatus(error) {
  return Number.isInteger(Number(error.status)) ? Number(error.status) : 500;
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    console.error("Event error:", error);
    send(response, errorStatus(error), { error: error.message || "Event request failed." });
  }
}

export async function listEventRecords(_request, response, context) {
  await run(response, context.send, async () => context.send(response, 200, { events: await listEvents() }));
}

export async function getEventRecord(_request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, await getEvent(id)));
}

export async function createEventRecord(request, response, context) {
  await run(response, context.send, async () => context.send(response, 201, { event: await createEvent(await context.readJson(request), context.user) }));
}

export async function updateEventRecord(request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, { event: await updateEvent(id, await context.readJson(request)) }));
}

export async function deleteEventRecord(_request, response, context, id) {
  await run(response, context.send, async () => {
    await deleteEvent(id);
    context.sendNoContent(response);
  });
}

export async function replaceEventRegistrations(request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, await replaceRegistrations(id, await context.readJson(request), context.user)));
}
