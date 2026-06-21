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
import db from "./database/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : join(__dirname, "data");
const storePath = join(dataDirectory, "store.json");
const secretPath = join(dataDirectory, ".secret");
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

const roles = ["ADMIN", "GROUP_LEADER", "UNIT_LEADER"];
const units = ["أشبال و زهرات", "مبتدئ", "متقدم", "جوالة", "قيادة"];
const loginAttempts = new Map();

mkdirSync(dataDirectory, { recursive: true });

if (!existsSync(storePath)) {
  writeFileSync(storePath, JSON.stringify({ users: [], scouts: [] }, null, 2));
}

if (!existsSync(secretPath)) {
  writeFileSync(secretPath, randomBytes(48).toString("hex"));
}

const tokenSecret = readFileSync(secretPath, "utf8").trim();

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
  if (origin === allowedOrigin || (!origin && process.env.NODE_ENV !== "production")) {
    response.setHeader("Access-Control-Allow-Origin", origin || allowedOrigin);
  }
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    unit: user.unit,
    active: user.active,
    createdAt: user.createdAt,
  };
}

function authenticate(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const claims = verifyToken(token);
  if (!claims) return null;

  const user = readStore().users.find(
    (candidate) => candidate.id === claims.sub && candidate.active,
  );
  return user || null;
}

function canAccessScout(user, scout) {
  return (
    user.role === "ADMIN" ||
    user.role === "GROUP_LEADER" ||
    user.unit === scout.unit
  );
}

function validateAccount(body, firstAccount = false) {
  const fullName = String(body.fullName || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = firstAccount ? "ADMIN" : String(body.role || "");
  const unit = role === "UNIT_LEADER" ? String(body.unit || "") : null;

  if (fullName.length < 2) return { error: "Full name is required." };
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return { error: "Username must be 3-30 letters, numbers, dots, dashes, or underscores." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!roles.includes(role)) return { error: "Invalid role." };
  if (role === "UNIT_LEADER" && !units.includes(unit)) {
    return { error: "A Unit Leader must be assigned to a valid unit." };
  }

  return { value: { fullName, username, password, role, unit } };
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
      return send(response, 200, { status: "ok", storage: "local-json" });
    }

    if (request.method === "GET" && path === "/api/units") {
      try {
        const [rows] = await db.execute(
          "SELECT id, name FROM units ORDER BY id"
        );

        return send(response, 200, rows);
      } catch (error) {
        console.error(error);

        return send(response, 500, {
          error: "Failed to load units",
        });
      }
    }

    if (request.method === "GET" && path === "/api/auth/setup-status") {
      return send(response, 200, { setupRequired: readStore().users.length === 0 });
    }

    if (request.method === "POST" && path === "/api/auth/setup") {
      const store = readStore();
      if (store.users.length > 0) {
        return send(response, 409, { error: "ScoutOS has already been set up." });
      }

      const validation = validateAccount(await readJson(request), true);
      if (validation.error) return send(response, 400, { error: validation.error });

      const user = {
        id: randomUUID(),
        ...validation.value,
        passwordHash: hashPassword(validation.value.password),
        password: undefined,
        active: true,
        createdAt: new Date().toISOString(),
      };
      delete user.password;
      store.users.push(user);
      writeStore(store);

      return send(response, 201, { token: signToken(user), user: publicUser(user) });
    }

    if (request.method === "POST" && path === "/api/auth/login") {
      const clientKey = request.socket.remoteAddress || "unknown";
      if (isRateLimited(clientKey)) {
        return send(response, 429, { error: "Too many login attempts. Try again in one minute." });
      }

      const body = await readJson(request);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = readStore().users.find((candidate) => candidate.username === username);

      if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
        recordFailedLogin(clientKey);
        return send(response, 401, { error: "Incorrect username or password." });
      }

      loginAttempts.delete(clientKey);
      return send(response, 200, { token: signToken(user), user: publicUser(user) });
    }

    const user = authenticate(request);
    if (!user) return send(response, 401, { error: "Authentication required." });

    if (request.method === "GET" && path === "/api/auth/me") {
      return send(response, 200, { user: publicUser(user) });
    }

    if (path === "/api/users" && request.method === "GET") {
      if (!["ADMIN", "GROUP_LEADER"].includes(user.role)) {
        return send(response, 403, { error: "You do not have permission to view users." });
      }
      return send(response, 200, { users: readStore().users.map(publicUser) });
    }

    if (path === "/api/users" && request.method === "POST") {
      if (user.role !== "ADMIN") {
        return send(response, 403, { error: "Only an Admin can create user accounts." });
      }

      const store = readStore();
      const validation = validateAccount(await readJson(request));
      if (validation.error) return send(response, 400, { error: validation.error });
      if (store.users.some((candidate) => candidate.username === validation.value.username)) {
        return send(response, 409, { error: "That username is already in use." });
      }

      const newUser = {
        id: randomUUID(),
        ...validation.value,
        passwordHash: hashPassword(validation.value.password),
        password: undefined,
        active: true,
        createdAt: new Date().toISOString(),
      };
      delete newUser.password;
      store.users.push(newUser);
      writeStore(store);
      return send(response, 201, { user: publicUser(newUser) });
    }

    if (path === "/api/scouts" && request.method === "GET") {
      const scouts = readStore().scouts.filter((scout) => canAccessScout(user, scout));
      return send(response, 200, { scouts });
    }

    if (path === "/api/scouts" && request.method === "POST") {
      const store = readStore();
      const validation = validateScout(await readJson(request));
      if (validation.error) return send(response, 400, { error: validation.error });
      if (user.role === "UNIT_LEADER" && validation.value.unit !== user.unit) {
        return send(response, 403, { error: "You can only add scouts to your assigned unit." });
      }

      const scout = {
        id: randomUUID(),
        ...validation.value,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.scouts.unshift(scout);
      writeStore(store);
      return send(response, 201, { scout });
    }

    const scoutMatch = path.match(/^\/api\/scouts\/([a-f0-9-]+)$/i);
    if (scoutMatch) {
      const store = readStore();
      const scoutIndex = store.scouts.findIndex((scout) => scout.id === scoutMatch[1]);
      if (scoutIndex < 0) return send(response, 404, { error: "Scout not found." });

      const scout = store.scouts[scoutIndex];
      if (!canAccessScout(user, scout)) {
        return send(response, 403, { error: "You cannot access this scout." });
      }

      if (request.method === "PUT") {
        const validation = validateScout(await readJson(request));
        if (validation.error) return send(response, 400, { error: validation.error });
        if (user.role === "UNIT_LEADER" && validation.value.unit !== user.unit) {
          return send(response, 403, { error: "You cannot transfer scouts to another unit." });
        }

        const updatedScout = {
          ...scout,
          ...validation.value,
          updatedAt: new Date().toISOString(),
        };
        store.scouts[scoutIndex] = updatedScout;
        writeStore(store);
        return send(response, 200, { scout: updatedScout });
      }

      if (request.method === "DELETE") {
        if (user.role === "UNIT_LEADER" && scout.unit !== user.unit) {
          return send(response, 403, { error: "You cannot remove this scout." });
        }
        store.scouts.splice(scoutIndex, 1);
        writeStore(store);
        return sendNoContent(response);
      }
    }

    return send(response, 404, { error: "Route not found." });
  } catch (error) {
    console.error(error);
    return send(response, 400, { error: error.message || "Request failed." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ScoutOS backend running at http://127.0.0.1:${port}`);
  console.log(`Storage: ${storePath}`);
});
