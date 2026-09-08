import {
  addPointsController,
  getLeaderboardController,
  getScoutPointsController,
} from "../controllers/pointsController.js";

export async function handlePointsRoute(request, response, context) {
  const { path } = context;

  if (!path.startsWith("/api/points")) {
    return false;
  }

  if (request.method === "POST" && path === "/api/points") {
    await addPointsController(request, response, context);
    return true;
  }

  if (request.method === "GET" && path === "/api/points/leaderboard") {
    await getLeaderboardController(request, response, context);
    return true;
  }

  const scoutPointsMatch = path.match(/^\/api\/scouts\/([a-zA-Z0-9-]+)\/points$/);

  if (request.method === "GET" && scoutPointsMatch) {
    await getScoutPointsController(request, response, context, scoutPointsMatch[1]);
    return true;
  }

  return false;
}
