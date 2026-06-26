export type UserRole = "ADMIN" | "GROUP_LEADER" | "UNIT_LEADER";

export const scoutUnits = [
  "أشبال و زهرات",
  "مبتدئ",
  "متقدم",
  "جوالة",
  "قيادة",
] as const;

export type ScoutUnit = (typeof scoutUnits)[number];
export type ScoutStatus = "Active" | "Inactive";

export const meetingTypes = [
  "Weekly Meeting",
  "Camp",
  "Hike",
  "Training",
  "Competition",
  "Service",
  "Other",
] as const;

export type MeetingType = (typeof meetingTypes)[number];

export const attendanceStatuses = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

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
  patrol?: string | null;
  rank?: string | null;
  phone: string;
  guardian: string;
  joinedAt: string;
  status: ScoutStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ScoutInput = Omit<Scout, "id" | "createdAt" | "updatedAt" | "patrol" | "rank">;

export type AttendanceSummary = {
  totalScouts: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
};

export type AttendanceSession = {
  id: number;
  meetingName: string;
  meetingType: MeetingType;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  summary: AttendanceSummary;
};

export type AttendanceSessionInput = {
  meetingName: string;
  meetingType: MeetingType;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

export type AttendanceRecord = {
  id: number;
  sessionId: number;
  scoutId: string;
  status: AttendanceStatus;
  arrivalTime: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  scout: Scout;
};

export type AttendanceSaveRecord = {
  scoutId: string;
  status: AttendanceStatus;
  arrivalTime: string;
  notes: string;
};

export type AttendanceSessionDetail = {
  session: AttendanceSession;
  records: AttendanceRecord[];
};

export type AttendanceSaveResult = AttendanceSessionDetail & {
  updated: boolean;
};

export type ScoutAttendanceProfileSummary = {
  scoutId: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
  history: Array<{
    sessionId: number;
    meetingName: string;
    meetingType: MeetingType;
    meetingDate: string;
    location: string;
    status: AttendanceStatus;
    arrivalTime: string;
    notes: string;
  }>;
};

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
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

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Network Error: ScoutOS backend is not reachable.");
  }

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
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
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

  attendance: {
    sessions: {
      list: () => request<{ sessions: AttendanceSession[] }>("/attendance/sessions"),
      get: (id: number) =>
        request<AttendanceSessionDetail>(`/attendance/sessions/${id}`),
      create: (input: AttendanceSessionInput) =>
        request<{ session: AttendanceSession }>("/attendance/sessions", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (id: number, input: AttendanceSessionInput) =>
        request<{ session: AttendanceSession }>(`/attendance/sessions/${id}`, {
          method: "PUT",
          body: JSON.stringify(input),
        }),
      remove: (id: number) =>
        request<void>(`/attendance/sessions/${id}`, { method: "DELETE" }),
    },
    save: (input: { sessionId: number; records: AttendanceSaveRecord[] }) =>
      request<AttendanceSaveResult>("/attendance/save", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    scoutSummary: (scoutId: string) =>
      request<{ summary: ScoutAttendanceProfileSummary }>(
        `/attendance/scouts/${scoutId}/summary`,
      ),
  },
};

export function roleLabel(role: UserRole) {
  if (role === "ADMIN") return "Administrator";
  if (role === "GROUP_LEADER") return "Group Leader";
  return "Unit Leader";
}
