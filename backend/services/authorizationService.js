export const USER_ROLES = ["ADMIN", "GROUP_LEADER", "UNIT_LEADER", "SCOUT"];
export const LEADER_ROLES = ["ADMIN", "GROUP_LEADER", "UNIT_LEADER"];

export function createAuthorizationError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function isGlobalLeader(user) {
  return user?.role === "ADMIN" || user?.role === "GROUP_LEADER";
}

export function isOperationalLeader(user) {
  return LEADER_ROLES.includes(user?.role);
}

export function assignedUnitNames(user) {
  const names = Array.isArray(user?.assignedUnits)
    ? user.assignedUnits.map((unit) => String(unit?.name || "").trim()).filter(Boolean)
    : [];
  if (names.length === 0 && user?.role === "UNIT_LEADER" && user?.unit) {
    names.push(String(user.unit));
  }
  return [...new Set(names)];
}

export function permissionsFor(user) {
  const operational = isOperationalLeader(user);
  const admin = user?.role === "ADMIN";
  return {
    manageUsers: admin,
    manageScouts: operational,
    manageAttendance: operational,
    managePoints: operational,
    manageEvents: operational,
    manageGallery: operational,
    manageFinance: operational,
    viewOwnScoutData: user?.role === "SCOUT",
  };
}

export function requireAnyRole(user, allowedRoles, message = "You do not have permission for this action.") {
  if (!user || !allowedRoles.includes(user.role)) {
    throw createAuthorizationError(403, message);
  }
}

export function userHasUnitAccess(user, unitName) {
  if (isGlobalLeader(user)) return true;
  if (user?.role !== "UNIT_LEADER") return false;
  return assignedUnitNames(user).includes(String(unitName || ""));
}

export function canReadScout(user, scout) {
  if (!user || !scout) return false;
  if (isGlobalLeader(user)) return true;
  if (user.role === "UNIT_LEADER") return userHasUnitAccess(user, scout.unit);
  return user.role === "SCOUT" && String(user.scoutId || "") === String(scout.id || scout.scout_id || "");
}

export function canManageScout(user, scout) {
  return isOperationalLeader(user) && canReadScout(user, scout);
}

export function assertUnitAccess(user, unitName, message = "You cannot access this unit.") {
  if (!userHasUnitAccess(user, unitName)) throw createAuthorizationError(403, message);
}

export function assertScoutReadAccess(user, scout) {
  if (!canReadScout(user, scout)) {
    throw createAuthorizationError(403, "You cannot access this Scout.");
  }
}

export function assertScoutManageAccess(user, scout) {
  if (!canManageScout(user, scout)) {
    throw createAuthorizationError(403, "You cannot manage this Scout.");
  }
}

export async function getUserUnitIds(database, userId) {
  const [rows] = await database.execute(
    "SELECT unit_id FROM user_units WHERE user_id = ? ORDER BY unit_id",
    [userId],
  );
  return rows.map((row) => Number(row.unit_id));
}

export async function getUserUnits(database, userId) {
  const [rows] = await database.execute(
    `SELECT unit_record.id, unit_record.name
     FROM user_units assignment
     INNER JOIN units unit_record ON unit_record.id = assignment.unit_id
     WHERE assignment.user_id = ? AND unit_record.active = 1
     ORDER BY unit_record.display_order, unit_record.name`,
    [userId],
  );
  return rows.map((row) => ({ id: Number(row.id), name: row.name }));
}

export async function hydrateUserAccess(database, account) {
  const assignedUnits = await getUserUnits(database, account.id);
  const legacyUnit = account.unit ?? account.unit_id ?? null;
  const user = {
    id: String(account.id),
    fullName: account.fullName || account.full_name,
    username: account.username,
    email: account.email || "",
    role: account.role,
    unit: assignedUnits[0]?.name || legacyUnit,
    assignedUnits,
    scoutId: account.scoutId || account.scout_id || null,
    active: Boolean(account.active),
    accountState: account.accountState || account.account_state || (Boolean(account.active) ? "ACTIVE" : "INACTIVE"),
    invitationExpiresAt: account.invitationExpiresAt || account.invitation_expires_at || null,
    sessionVersion: Number(account.sessionVersion ?? account.session_version ?? 0),
    createdAt: account.createdAt || account.created_at,
  };
  return { ...user, permissions: permissionsFor(user) };
}

export async function listActiveUnits(database) {
  const [rows] = await database.execute(
    "SELECT id, name FROM units WHERE active = 1 ORDER BY display_order, name",
  );
  return rows.map((row) => ({ id: Number(row.id), name: row.name }));
}
