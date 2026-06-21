export type UserRole = "ADMIN" | "GROUP_LEADER" | "UNIT_LEADER";
export type ScoutUnit = "أشبال و زهرات" | "مبتدئ" | "متقدم" | "جوالة" | "قيادة";
export type ScoutStatus = "Active" | "Inactive";

export type AuthUser = {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  unit: ScoutUnit | null;
  active: boolean;
  createdAt: string;
};

export type Scout = {
  id: string;
  name: string;
  age: number;
  unit: ScoutUnit;
  phone: string;
  guardian: string;
  joinedAt: string;
  status: ScoutStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ScoutInput = Omit<Scout, "id" | "createdAt" | "updatedAt">;

const API_URL = import.meta.env.VITE_API_URL || "http://10.116.128.100:4000/api";
const tokenKey = "scoutos-token";
const userKey = "scoutos-user";

export function getToken() {
  return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
}

export function getStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser, remember: boolean) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(tokenKey, token);
  storage.setItem(userKey, JSON.stringify(user));
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(tokenKey);
    storage.removeItem(userKey);
    storage.removeItem("loggedIn");
    storage.removeItem("scoutos-username");
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (authenticated) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) clearSession();
    throw new Error(body.error || "ScoutOS could not complete the request.");
  }

  return body as T;
}

export const api = {
  setupStatus: () =>
    request<{ setupRequired: boolean }>("/auth/setup-status", {}, false),

  setup: (input: {
    fullName: string;
    username: string;
    password: string;
  }) =>
    request<{ token: string; user: AuthUser }>(
      "/auth/setup",
      { method: "POST", body: JSON.stringify(input) },
      false,
    ),

  login: (username: string, password: string) =>
    request<{ token: string; user: AuthUser }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
      false,
    ),

  me: () => request<{ user: AuthUser }>("/auth/me"),

  scouts: {
    list: () => request<{ scouts: Scout[] }>("/scouts"),
    create: (input: ScoutInput) =>
      request<{ scout: Scout }>("/scouts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: ScoutInput) =>
      request<{ scout: Scout }>(`/scouts/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<void>(`/scouts/${id}`, { method: "DELETE" }),
  },
};

export function roleLabel(role: UserRole) {
  if (role === "ADMIN") return "Administrator";
  if (role === "GROUP_LEADER") return "Group Leader";
  return "Unit Leader";
}
