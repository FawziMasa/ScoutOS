import assert from "node:assert/strict";
import test from "node:test";
import {
  assignedUnitNames,
  canManageScout,
  canReadScout,
  hydrateUserAccess,
  permissionsFor,
  userHasUnitAccess,
} from "../services/authorizationService.js";

const multiUnitLeader = {
  id: "12",
  role: "UNIT_LEADER",
  assignedUnits: [
    { id: 1, name: "مبتدئ" },
    { id: 2, name: "متقدم" },
  ],
};

test("a Unit Leader can access every assigned unit and no others", () => {
  assert.deepEqual(assignedUnitNames(multiUnitLeader), ["مبتدئ", "متقدم"]);
  assert.equal(userHasUnitAccess(multiUnitLeader, "مبتدئ"), true);
  assert.equal(userHasUnitAccess(multiUnitLeader, "متقدم"), true);
  assert.equal(userHasUnitAccess(multiUnitLeader, "جوالة"), false);
  assert.equal(canManageScout(multiUnitLeader, { id: "a", unit: "متقدم" }), true);
  assert.equal(canManageScout(multiUnitLeader, { id: "b", unit: "جوالة" }), false);
});

test("global leaders have operational access while Scout accounts are own-data only", () => {
  const admin = { id: "1", role: "ADMIN" };
  const groupLeader = { id: "2", role: "GROUP_LEADER" };
  const scout = { id: "3", role: "SCOUT", scoutId: "scout-7" };
  assert.equal(canManageScout(admin, { id: "other", unit: "قيادة" }), true);
  assert.equal(canManageScout(groupLeader, { id: "other", unit: "قيادة" }), true);
  assert.equal(canReadScout(scout, { id: "scout-7", unit: "مبتدئ" }), true);
  assert.equal(canReadScout(scout, { id: "scout-8", unit: "مبتدئ" }), false);
  assert.equal(permissionsFor(scout).managePoints, false);
  assert.equal(permissionsFor(admin).manageUsers, true);
});

test("hydrated users expose assigned units, Scout links, and typed permissions", async () => {
  const database = {
    async execute(sql) {
      assert.match(sql, /FROM user_units/);
      return [[
        { id: 2, name: "متقدم" },
        { id: 1, name: "مبتدئ" },
      ]];
    },
  };
  const user = await hydrateUserAccess(database, {
    id: 12,
    full_name: "Lilian",
    username: "lilian",
    email: "lilian@example.test",
    role: "UNIT_LEADER",
    unit: "مبتدئ",
    scout_id: null,
    active: 1,
    session_version: 4,
  });
  assert.deepEqual(user.assignedUnits, [
    { id: 2, name: "متقدم" },
    { id: 1, name: "مبتدئ" },
  ]);
  assert.equal(user.permissions.manageAttendance, true);
  assert.equal(user.permissions.manageUsers, false);
});
