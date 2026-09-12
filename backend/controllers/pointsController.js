import {
  addPoints,
  getLeaderboard,
  getScoutPointsHistory,
} from "../services/pointsService.js";

function errorStatus(error) {
  const status = Number(error.status);
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }
  return 500;
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    console.error("Points error:", error);
    send(response, errorStatus(error), { error: error.message || "Points request failed." });
  }
}

export async function addPointsController(request, response, context) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    
    // Support both camelCase and snake_case
    const scoutId = body.scoutId || body.scout_id;
    const pointsChange = body.pointsChange ?? body.points_change;
    const reason = body.reason;
    const requestId = body.requestId || body.request_id || null;

    if (!scoutId || typeof pointsChange !== "number" || !reason) {
      context.send(response, 400, { error: "Missing required fields (scoutId/scout_id, pointsChange/points_change, reason)." });
      return;
    }

    const transaction = await addPoints(scoutId, pointsChange, reason, context.user, requestId);
    context.send(response, 201, { transaction });
  });
}

export async function getLeaderboardController(_request, response, context) {
  await run(response, context.send, async () => {
    const leaderboard = await getLeaderboard();
    context.send(response, 200, { leaderboard });
  });
}

export async function getScoutPointsController(_request, response, context, scoutId) {
  await run(response, context.send, async () => {
    const transactions = await getScoutPointsHistory(scoutId, context.user);
    context.send(response, 200, { transactions });
  });
}
