import assert from "node:assert/strict";
import test from "node:test";

process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.DB_NAME ??= "test";

const { default: db } = await import("../database/db.js");
const { addPoints, getScoutPointsHistory } = await import("../services/pointsService.js");

const leader = {
  id: "12",
  fullName: "Lilian",
  role: "UNIT_LEADER",
  assignedUnits: [
    { id: 1, name: "مبتدئ" },
    { id: 2, name: "متقدم" },
  ],
};

test("a multi-unit leader can award points in a second assigned unit", async () => {
  const originalExecute = db.execute;
  const writes = [];
  db.execute = async (sql, values) => {
    if (sql.includes("FROM scouts")) return [[{ id: "scout-2", unit: "متقدم", status: "Active" }]];
    if (sql.includes("INSERT INTO points_ledger")) {
      writes.push(values);
      return [{ insertId: 44 }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  try {
    const result = await addPoints("scout-2", 5, "Helpful service", leader, "request-1");
    assert.equal(result.id, 44);
    assert.deepEqual(writes[0], ["scout-2", 5, "Helpful service", 12, "request-1"]);
  } finally {
    db.execute = originalExecute;
  }
});

test("leaders and Scouts cannot forge point access", async () => {
  const originalExecute = db.execute;
  db.execute = async (sql) => {
    if (sql.includes("FROM scouts")) return [[{ id: "scout-3", unit: "جوالة", status: "Active" }]];
    throw new Error("Unauthorized requests must not insert a transaction.");
  };
  try {
    await assert.rejects(
      () => addPoints("scout-3", 5, "Outside unit", leader),
      (error) => error.status === 403,
    );
    await assert.rejects(
      () => addPoints("scout-3", 5, "Self award", { id: "4", role: "SCOUT", scoutId: "scout-3" }),
      (error) => error.status === 403,
    );
  } finally {
    db.execute = originalExecute;
  }
});

test("a Scout can read only their own immutable point history", async () => {
  const originalExecute = db.execute;
  db.execute = async (sql) => {
    if (sql.includes("FROM scouts")) return [[{ id: "scout-3", unit: "جوالة", status: "Active" }]];
    if (sql.includes("FROM points_ledger")) return [[{
      id: 1,
      scout_id: "scout-3",
      points_change: -2,
      reason: "Equipment care",
      leader_id: 9,
      leader_name: "Leader",
      created_at: "2026-09-12T08:00:00.000Z",
    }]];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  try {
    const scoutUser = { id: "4", role: "SCOUT", scoutId: "scout-3" };
    const history = await getScoutPointsHistory("scout-3", scoutUser);
    assert.equal(history[0].pointsChange, -2);
    await assert.rejects(
      () => getScoutPointsHistory("scout-3", { ...scoutUser, scoutId: "scout-8" }),
      (error) => error.status === 403,
    );
  } finally {
    db.execute = originalExecute;
  }
});
