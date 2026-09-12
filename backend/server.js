import { createServer } from "node:http";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCoreSchema } from "./database/schema.js";
import { defaultUnitNames } from "./database/accessMigration.js";
import db from "./database/db.js";
import { handleAttendanceRoute } from "./routes/attendance.js";
import { handleEventRoute } from "./routes/events.js";
import { handleFinanceRoute } from "./routes/finance.js";
import { handleGalleryRoute } from "./routes/gallery.js";
import { handlePointsRoute } from "./routes/points.js";
import {
  handleForgotPassword,
  handleResetPassword,
} from "./controllers/passwordResetController.js";
import { safeEmailError, verifyEmailConfiguration } from "./services/emailService.js";
import { normalizeEmail } from "./services/passwordResetService.js";
import {
  LEADER_ROLES,
  USER_ROLES,
  assignedUnitNames,
  assertScoutManageAccess,
  assertScoutReadAccess,
  hydrateUserAccess,
  listActiveUnits,
  permissionsFor,
  requireAnyRole,
  userHasUnitAccess,
} from "./services/authorizationService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : join(__dirname, "data");
const storePath = join(dataDirectory, "store.json");
const secretPath = join(dataDirectory, ".secret");
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

const roles = USER_ROLES;
const units = defaultUnitNames;
const loginAttempts = new Map();

mkdirSync(dataDirectory, { recursive: true });

if (!existsSync(storePath)) {
  writeFileSync(storePath, JSON.stringify({ users: [], scouts: [] }, null, 2));
}

let tokenSecret = process.env.JWT_SECRET || process.env.APP_SECRET;
if (!tokenSecret) {
    if (existsSync(secretPath)) {
        tokenSecret = readFileSync(secretPath, "utf8").trim();
    } else {
        tokenSecret = randomBytes(48).toString("hex");
        writeFileSync(secretPath, tokenSecret);
    }
}

await ensureCoreSchema().catch((error) => {
  console.error("Database schema check failed:", error);
});

function readStore() {
  try {
    const store = JSON.parse(readFileSync(storePath, "utf8"));
    return {
      users: Array.isArray(store.users) ? store.users : [],
      scouts: Array.isArray(store.scouts) ? store.scouts : [],
    };
  } catch {
    return { users: [], scouts: [] };
  }
}

function writeStore(store) {
  const temporaryPath = join(
    dataDirectory,
    `store.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`,
  );
  writeFileSync(temporaryPath, JSON.stringify(store, null, 2));
  renameSync(temporaryPath, storePath);
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendNoContent(response) {
  response.writeHead(204);
  response.end();
}
function setCors(request, response) {
  const origin = request.headers.origin;

  const allowedOrigins = [
    allowedOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://scout-os-bay.vercel.app",
    "https://scout-2d9py57t9-fawzi-masa.vercel.app",
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }

  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash).split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const saved = Buffer.from(hash, "hex");
  return candidate.length === saved.length && timingSafeEqual(candidate, saved);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signToken(user) {
  const header = encode({ algorithm: "HS256", type: "SCOUTOS" });
  const payload = encode({
    sub: user.id,
    role: user.role,
    unit: user.unit,
    scoutId: user.scoutId || null,
    sessionVersion: Number(user.sessionVersion ?? user.session_version ?? 0),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  });
  const signature = createHmac("sha256", tokenSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = String(token).split(".");
  if (!header || !payload || !signature) return null;

  const expected = createHmac("sha256", tokenSecret)
    .update(`${header}.${payload}`)
    .digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.expiresAt > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

function publicUser(user) {
  return {
    id: String(user.id),
    fullName: user.fullName || user.full_name,
    username: user.username,
    email: user.email || "",
    role: user.role,
    unit: user.unit ?? user.unit_id ?? null,
    assignedUnits: Array.isArray(user.assignedUnits) ? user.assignedUnits : [],
    scoutId: user.scoutId || user.scout_id || null,
    permissions: user.permissions || permissionsFor(user),
    active: Boolean(user.active),
    createdAt: user.createdAt || user.created_at,
  };

}

async function authenticate(request) {
  const authorization = request.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const claims = verifyToken(token);

  if (!claims) return null;

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [claims.sub]
  );

  const account = rows[0];
  if (
    !account ||
    !Boolean(account.active) ||
    Number(claims.sessionVersion ?? 0) !== Number(account.session_version ?? 0)
  ) {
    return null;
  }

  const user = await hydrateUserAccess(db, account);
  if (user.role === "SCOUT") {
    if (!user.scoutId) return null;
    const [scouts] = await db.execute(
      "SELECT id FROM scouts WHERE id = ? AND status = 'Active' LIMIT 1",
      [user.scoutId],
    );
    if (scouts.length === 0) return null;
  }
  return user;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateAccount(body, firstAccount = false, editing = false) {
  const fullName = String(body.fullName || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const role = firstAccount ? "ADMIN" : String(body.role || "");
  const unit = role === "UNIT_LEADER" ? String(body.unit || "").trim() : null;
  const rawUnitIds = body.assignedUnitIds ?? body.unitIds ?? [];
  const assignedUnitIds = Array.isArray(rawUnitIds)
    ? [...new Set(rawUnitIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  const scoutId = role === "SCOUT" ? String(body.scoutId || "").trim() : null;
  const active = body.active === undefined ? true : Boolean(body.active);

  if (fullName.length < 2) return { error: "Full name is required." };
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return { error: "Username must be 3-30 letters, numbers, dots, dashes, or underscores." };
  }
  if (!email) return { error: "A valid email address is required." };
  if ((!editing || password) && password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!roles.includes(role)) return { error: "Invalid role." };
  if (role === "UNIT_LEADER" && assignedUnitIds.length === 0 && !units.includes(unit)) {
    return { error: "A Unit Leader must be assigned to at least one valid unit." };
  }
  if (role === "SCOUT" && !scoutId) {
    return { error: "A Scout account must be linked to an existing Scout." };
  }

  return {
    value: { fullName, username, email, password, role, unit, assignedUnitIds, scoutId, active },
  };
}

async function resolveAccountUnits(connection, account) {
  if (account.role !== "UNIT_LEADER") return [];

  let rows;
  if (account.assignedUnitIds.length > 0) {
    const placeholders = account.assignedUnitIds.map(() => "?").join(", ");
    [rows] = await connection.execute(
      `SELECT id, name FROM units WHERE active = 1 AND id IN (${placeholders}) ORDER BY display_order, name`,
      account.assignedUnitIds,
    );
    if (rows.length !== account.assignedUnitIds.length) {
      throw createHttpError(400, "One or more assigned units are invalid or inactive.");
    }
  } else {
    [rows] = await connection.execute(
      "SELECT id, name FROM units WHERE active = 1 AND name = ? LIMIT 1",
      [account.unit],
    );
    if (rows.length !== 1) throw createHttpError(400, "The assigned unit is invalid or inactive.");
  }
  return rows.map((row) => ({ id: Number(row.id), name: row.name }));
}

async function replaceUserUnits(connection, userId, assignedUnits) {
  await connection.execute("DELETE FROM user_units WHERE user_id = ?", [userId]);
  for (const unit of assignedUnits) {
    await connection.execute(
      "INSERT INTO user_units (user_id, unit_id, created_at) VALUES (?, ?, NOW())",
      [userId, unit.id],
    );
  }
}

async function assertScoutLinkAvailable(connection, account, excludedUserId = null) {
  if (account.role !== "SCOUT") return;
  const [scouts] = await connection.execute(
    "SELECT id FROM scouts WHERE id = ? AND status = 'Active' LIMIT 1",
    [account.scoutId],
  );
  if (scouts.length === 0) throw createHttpError(400, "The selected active Scout does not exist.");

  const params = [account.scoutId];
  let sql = "SELECT id FROM users WHERE scout_id = ?";
  if (excludedUserId !== null) {
    sql += " AND id <> ?";
    params.push(excludedUserId);
  }
  sql += " LIMIT 1";
  const [existing] = await connection.execute(sql, params);
  if (existing.length > 0) throw createHttpError(409, "That Scout already has a login account.");
}

function scoutListScope(user) {
  if (user.role === "ADMIN" || user.role === "GROUP_LEADER") return { where: "", values: [] };
  if (user.role === "UNIT_LEADER") {
    const unitNames = assignedUnitNames(user);
    if (unitNames.length === 0) return { where: " WHERE 1 = 0", values: [] };
    return {
      where: ` WHERE unit IN (${unitNames.map(() => "?").join(", ")})`,
      values: unitNames,
    };
  }
  if (user.role === "SCOUT" && user.scoutId) {
    return { where: " WHERE id = ?", values: [user.scoutId] };
  }
  return { where: " WHERE 1 = 0", values: [] };
}

function validateScout(body) {
  const scout = {
    name: String(body.name || "").trim(),
    age: Number(body.age),
    unit: String(body.unit || ""),
    phone: String(body.phone || "").trim(),
    guardian: String(body.guardian || "").trim(),
    joinedAt: String(body.joinedAt || ""),
    status: String(body.status || ""),
  };

  if (scout.name.length < 2) return { error: "Scout name is required." };
  if (!Number.isInteger(scout.age) || scout.age < 5 || scout.age > 30) {
    return { error: "Age must be between 5 and 30." };
  }
  if (!units.includes(scout.unit)) return { error: "Invalid unit." };
  if (!scout.phone) return { error: "Phone number is required." };
  if (!scout.guardian) return { error: "Guardian name is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scout.joinedAt)) {
    return { error: "Join date is invalid." };
  }
  if (!["Active", "Inactive"].includes(scout.status)) {
    return { error: "Status must be Active or Inactive." };
  }

  return { value: scout };
}

function isRateLimited(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 60_000);
  loginAttempts.set(key, recent);
  return recent.length >= 8;
}

function recordFailedLogin(key) {
  loginAttempts.set(key, [...(loginAttempts.get(key) || []), Date.now()]);
}

const server = createServer(async (request, response) => {
  setCors(request, response);

  if (request.method === "OPTIONS") {
    return sendNoContent(response);
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const path = url.pathname;

  try {
    if (request.method === "GET" && path === "/api/health") {
      return send(response, 200, { status: "ok", storage: "mysql" });
    }

    if (request.method === "GET" && path === "/api/units") {
      const unitRecords = await listActiveUnits(db);
      return send(response, 200, {
        units: unitRecords.map((unit) => unit.name),
        unitRecords,
      });
    }

    if (request.method === "GET" && path === "/api/auth/setup-status") {
      const [rows] = await db.execute("SELECT COUNT(*) AS total FROM users");
      return send(response, 200, { setupRequired: Number(rows[0]?.total || 0) === 0 });
    }

    if (request.method === "POST" && path === "/api/auth/setup") {
      const [existingUsers] = await db.execute("SELECT COUNT(*) AS total FROM users");
      if (Number(existingUsers[0]?.total || 0) > 0) {
        return send(response, 409, { error: "ScoutOS has already been set up." });
      }

      const validation = validateAccount(await readJson(request), true);
      if (validation.error) return send(response, 400, { error: validation.error });

      const passwordHash = hashPassword(validation.value.password);
      const [result] = await db.execute(
        `
          INSERT INTO users
            (full_name, username, email, password_hash, role, unit, scout_id, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NOW())
        `,
        [
          validation.value.fullName,
          validation.value.username,
          validation.value.email,
          passwordHash,
          validation.value.role,
          validation.value.unit,
        ],
      );

      const user = {
        id: result.insertId,
        fullName: validation.value.fullName,
        username: validation.value.username,
        email: validation.value.email,
        role: validation.value.role,
        unit: validation.value.unit,
        assignedUnits: [],
        scoutId: null,
        active: true,
        createdAt: new Date().toISOString(),
      };

      return send(response, 201, { token: signToken(user), user: publicUser(user) });
    }

    if (request.method === "POST" && path === "/api/auth/forgot-password") {
      return handleForgotPassword({
        request,
        response,
        db,
        send,
        readJson,
        tokenSecret: process.env.PASSWORD_RESET_RATE_LIMIT_SECRET || tokenSecret,
        frontendUrl: allowedOrigin,
      });
    }

    if (request.method === "POST" && path === "/api/auth/reset-password") {
      return handleResetPassword({ request, response, db, send, readJson, hashPassword });
    }

    if (request.method === "POST" && path === "/api/auth/login") {
      const body = await readJson(request);

      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (isRateLimited(username || "unknown")) {
        return send(response, 429, { error: "Too many sign-in attempts. Please wait a minute." });
      }

      const [rows] = await db.execute(
        "SELECT * FROM users WHERE username = ? LIMIT 1",
        [username]
      );

      const account = rows[0];

      if (!account || !Boolean(account.active)) {
        recordFailedLogin(username || "unknown");
        return send(response, 401, {
          error: "Incorrect username or password.",
        });
      }

      if (
        !verifyPassword(password, account.password_hash)
      ) {
        recordFailedLogin(username || "unknown");
        return send(response, 401, {
          error: "Incorrect username or password.",
        });
      }

      const authUser = await hydrateUserAccess(db, account);
      if (authUser.role === "SCOUT") {
        const [linkedScouts] = await db.execute(
          "SELECT id FROM scouts WHERE id = ? AND status = 'Active' LIMIT 1",
          [authUser.scoutId],
        );
        if (!authUser.scoutId || linkedScouts.length === 0) {
          recordFailedLogin(username || "unknown");
          return send(response, 401, { error: "Incorrect username or password." });
        }
      }
      loginAttempts.delete(username || "unknown");

      return send(response, 200, {
        token: signToken(authUser),
        user: publicUser(authUser),
      });
    }

    if (request.method === "GET" && path.startsWith("/api/gallery/media/")) {
      const galleryMediaHandled = await handleGalleryRoute(request, response, {
        path,
        user: null,
        send,
        sendNoContent,
        readJson,
      });

      if (galleryMediaHandled) return;
    }

    const user = await authenticate(request);
    if (!user) return send(response, 401, { error: "Authentication required." });

    if (request.method === "GET" && path === "/api/auth/me") {
      return send(response, 200, { user: publicUser(user) });
    }

    const attendanceHandled = await handleAttendanceRoute(request, response, {
      path,
      user,
      send,
      sendNoContent,
      readJson,
    });

    if (attendanceHandled) return;

    const eventsHandled = await handleEventRoute(request, response, {
      path,
      user,
      send,
      sendNoContent,
      readJson,
    });

    if (eventsHandled) return;

    const financeHandled = await handleFinanceRoute(request, response, {
      path,
      user,
      send,
      sendNoContent,
      readJson,
    });

    if (financeHandled) return;

    const galleryHandled = await handleGalleryRoute(request, response, {
      path,
      user,
      send,
      sendNoContent,
      readJson,
    });

    if (galleryHandled) return;

    const pointsHandled = await handlePointsRoute(request, response, {
      path,
      user,
      send,
      sendNoContent,
      readJson,
    });

    if (pointsHandled) return;

    if (path === "/api/users" && request.method === "GET") {
      requireAnyRole(user, ["ADMIN"], "Only an Admin can view account administration.");

      const [rows] = await db.execute(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      const managedUsers = await Promise.all(rows.map((account) => hydrateUserAccess(db, account)));

      return send(response, 200, { users: managedUsers.map(publicUser) });
    }

    if (path === "/api/users" && request.method === "POST") {
      requireAnyRole(user, ["ADMIN"], "Only an Admin can create user accounts.");

      const validation = validateAccount(await readJson(request));
      if (validation.error) return send(response, 400, { error: validation.error });
      const connection = await db.getConnection();
      let newUserId;
      try {
        await connection.beginTransaction();
        const assignedUnits = await resolveAccountUnits(connection, validation.value);
        await assertScoutLinkAvailable(connection, validation.value);
        const [existingRows] = await connection.execute(
          "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1 FOR UPDATE",
          [validation.value.username, validation.value.email],
        );
        if (existingRows.length > 0) {
          throw createHttpError(409, "That username or email address is already in use.");
        }
        const [result] = await connection.execute(
          `INSERT INTO users
            (full_name, username, email, password_hash, role, unit, scout_id, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            validation.value.fullName,
            validation.value.username,
            validation.value.email,
            hashPassword(validation.value.password),
            validation.value.role,
            assignedUnits[0]?.name || null,
            validation.value.scoutId,
            validation.value.active ? 1 : 0,
          ],
        );
        newUserId = result.insertId;
        await replaceUserUnits(connection, newUserId, assignedUnits);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      const [createdRows] = await db.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [newUserId]);
      const newUser = await hydrateUserAccess(db, createdRows[0]);
      return send(response, 201, { user: publicUser(newUser) });
    }

    const userMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && request.method === "PUT") {
      requireAnyRole(user, ["ADMIN"], "Only an Admin can edit user accounts.");
      const userId = Number(userMatch[1]);
      const validation = validateAccount(await readJson(request), false, true);
      if (validation.error) return send(response, 400, { error: validation.error });
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [currentRows] = await connection.execute(
          "SELECT * FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
          [userId],
        );
        const current = currentRows[0];
        if (!current) throw createHttpError(404, "User account not found.");

        if (current.role === "ADMIN" && (validation.value.role !== "ADMIN" || !validation.value.active)) {
          const [adminRows] = await connection.execute(
            "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1 AND id <> ?",
            [userId],
          );
          if (Number(adminRows[0]?.total || 0) === 0) {
            throw createHttpError(400, "ScoutOS must keep at least one active Admin account.");
          }
        }

        const assignedUnits = await resolveAccountUnits(connection, validation.value);
        await assertScoutLinkAvailable(connection, validation.value, userId);
        const [duplicates] = await connection.execute(
          "SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ? LIMIT 1 FOR UPDATE",
          [validation.value.username, validation.value.email, userId],
        );
        if (duplicates.length > 0) {
          throw createHttpError(409, "That username or email address is already in use.");
        }

        const values = [
          validation.value.fullName,
          validation.value.username,
          validation.value.email,
          validation.value.role,
          assignedUnits[0]?.name || null,
          validation.value.scoutId,
          validation.value.active ? 1 : 0,
        ];
        let passwordSql = "";
        if (validation.value.password) {
          passwordSql = ", password_hash = ?";
          values.push(hashPassword(validation.value.password));
        }
        values.push(userId);
        await connection.execute(
          `UPDATE users SET full_name = ?, username = ?, email = ?, role = ?, unit = ?,
             scout_id = ?, active = ?, session_version = session_version + 1${passwordSql}
           WHERE id = ?`,
          values,
        );
        await replaceUserUnits(connection, userId, assignedUnits);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      const [updatedRows] = await db.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
      return send(response, 200, { user: publicUser(await hydrateUserAccess(db, updatedRows[0])) });
    }

    if (userMatch && request.method === "DELETE") {
      requireAnyRole(user, ["ADMIN"], "Only an Admin can deactivate user accounts.");
      const userId = Number(userMatch[1]);
      if (String(user.id) === String(userId)) {
        return send(response, 400, { error: "You cannot deactivate your own signed-in account." });
      }
      const [accounts] = await db.execute("SELECT id, role, active FROM users WHERE id = ? LIMIT 1", [userId]);
      const account = accounts[0];
      if (!account) return send(response, 404, { error: "User account not found." });
      if (account.role === "ADMIN" && Boolean(account.active)) {
        const [adminRows] = await db.execute(
          "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1 AND id <> ?",
          [userId],
        );
        if (Number(adminRows[0]?.total || 0) === 0) {
          return send(response, 400, { error: "ScoutOS must keep at least one active Admin account." });
        }
      }
      await db.execute(
        "UPDATE users SET active = 0, session_version = session_version + 1 WHERE id = ?",
        [userId],
      );
      return sendNoContent(response);
    }

    if (path === "/api/scouts" && request.method === "GET") {
      const scope = scoutListScope(user);
      const [scouts] = await db.execute(
        `SELECT * FROM scouts${scope.where} ORDER BY created_at DESC`,
        scope.values,
      );
      return send(response, 200, { scouts });
    }
    if (path === "/api/scouts" && request.method === "POST") {
      requireAnyRole(user, LEADER_ROLES, "Scout accounts cannot create Scout records.");
      const validation = validateScout(await readJson(request));

      if (validation.error) {
        return send(response, 400, { error: validation.error });
      }

      if (user.role === "UNIT_LEADER" && !userHasUnitAccess(user, validation.value.unit)) {
        return send(response, 403, {
          error: "You can only add Scouts to one of your assigned units.",
        });
      }

      const scout = {
        id: randomUUID(),
        ...validation.value,
      };

      await db.execute(
        `INSERT INTO scouts
    (id,name,age,unit,phone,guardian,joined_at,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          scout.id,
          scout.name,
          scout.age,
          scout.unit,
          scout.phone,
          scout.guardian,
          scout.joinedAt,
          scout.status,
          new Date(),
          new Date(),
        ]
      );

      return send(response, 201, { scout });
    }

    const scoutMatch = path.match(/^\/api\/scouts\/([a-f0-9-]+)$/i);

    if (scoutMatch) {
      const scoutId = scoutMatch[1];

      const [rows] = await db.execute(
        "SELECT * FROM scouts WHERE id = ? LIMIT 1",
        [scoutId]
      );

      const scout = rows[0];

      if (!scout) {
        return send(response, 404, {
          error: "Scout not found.",
        });
      }

      assertScoutReadAccess(user, scout);

      if (request.method === "GET") {
        return send(response, 200, { scout });
      }

      if (request.method === "PUT") {
        assertScoutManageAccess(user, scout);
        const payload = await readJson(request);

        // Preserve existing join_date if not provided or empty in payload
        if (!payload.joinedAt || payload.joinedAt === "") {
          payload.joinedAt = scout.joined_at;
        }

        const validation = validateScout(payload);

        if (validation.error) {
          return send(response, 400, {
            error: validation.error,
          });
        }

        if (user.role === "UNIT_LEADER" && !userHasUnitAccess(user, validation.value.unit)) {
          return send(response, 403, { error: "You cannot move a Scout outside your assigned units." });
        }

        await db.execute(
          `UPDATE scouts
        SET name=?,
           age=?,
           unit=?,
           phone=?,
           guardian=?,
           joined_at=?,
           status=?,
           updated_at=?
        WHERE id=?`,
          [
            validation.value.name,
            validation.value.age,
            validation.value.unit,
            validation.value.phone,
            validation.value.guardian,
            validation.value.joinedAt,
            validation.value.status,
            new Date(),
            scoutId,
          ]
        );

        const [updatedRows] = await db.execute(
          "SELECT * FROM scouts WHERE id = ?",
          [scoutId]
        );

        return send(response, 200, {
          scout: updatedRows[0],
        });
      }

      if (request.method === "DELETE") {
        assertScoutManageAccess(user, scout);
        await db.execute(
          "UPDATE scouts SET status = 'Inactive', updated_at = NOW() WHERE id = ?",
          [scoutId],
        );

        return sendNoContent(response);
      }
    }
    return send(response, 404, { error: "Route not found." });
  } catch (error) {
    console.error("Request failed:", { code: error?.code, status: error?.status });
    const requestedStatus = Number(error?.status);
    const status = error?.code === "ER_DUP_ENTRY"
      ? 409
      : Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
        ? requestedStatus
        : 400;
    const message = status < 500 ? error.message : "ScoutOS could not complete the request.";
    return send(response, status, { error: message || "Request failed." });
  }

});
server.listen(port, "0.0.0.0", () => {
  console.log(`ScoutOS backend running at http://0.0.0.0:${port}`);
  console.log(`Storage: ${storePath}`);
  console.log(`[Password reset] Frontend origin: ${allowedOrigin}`);

  void verifyEmailConfiguration()
    .then((summary) => console.log("[SMTP] Configuration and authentication verified.", summary))
    .catch((error) => console.error("[SMTP] Readiness check failed.", safeEmailError(error)));
});
