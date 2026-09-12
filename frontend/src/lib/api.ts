export type UserRole = "ADMIN" | "GROUP_LEADER" | "UNIT_LEADER" | "SCOUT";

export const scoutUnits = [
  "أشبال و زهرات",
  "مبتدئ",
  "متقدم",
  "جوالة",
  "قيادة",
] as const;

export type ScoutUnit = (typeof scoutUnits)[number];
export type ScoutStatus = "Active" | "Inactive";

export type UnitRecord = {
  id: number;
  name: ScoutUnit;
};

export type UserPermissions = {
  manageUsers: boolean;
  manageScouts: boolean;
  manageAttendance: boolean;
  managePoints: boolean;
  manageEvents: boolean;
  manageGallery: boolean;
  manageFinance: boolean;
  viewOwnScoutData: boolean;
};

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
  email: string;
  role: UserRole;
  unit: ScoutUnit | null;
  assignedUnits: UnitRecord[];
  scoutId: string | null;
  permissions: UserPermissions;
  active: boolean;
  createdAt: string;
};

export type UserInput = {
  fullName: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  unit: ScoutUnit | null;
  assignedUnitIds: number[];
  scoutId: string | null;
  active: boolean;
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

export const eventTypes = [
  "Weekly Meeting",
  "Camp",
  "Hike",
  "Training",
  "Competition",
  "Service",
  "Community Project",
  "Other",
] as const;

export type EventType = (typeof eventTypes)[number];

export type ScoutEvent = {
  id: number;
  title: string;
  eventType: EventType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
  notes: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  registrationCount: number;
};

export type ScoutEventInput = Omit<ScoutEvent, "id" | "createdBy" | "createdAt" | "updatedAt" | "registrationCount">;

export const financeTransactionTypes = ["EXPENSE", "INCOME"] as const;
export type FinanceTransactionType = (typeof financeTransactionTypes)[number];
export const financeStatuses = ["COMPLETED", "PENDING", "CANCELLED"] as const;
export type FinanceStatus = (typeof financeStatuses)[number];
export const financePaymentMethods = ["Cash", "Bank Transfer", "Card", "Mobile Wallet", "Other"] as const;
export type FinancePaymentMethod = (typeof financePaymentMethods)[number];

export type FinanceActor = {
  id: string;
  fullName: string;
  username: string;
} | null;

export type FinanceTransaction = {
  id: number;
  unit: ScoutUnit;
  transactionType: FinanceTransactionType;
  category: string;
  description: string;
  vendorPaidTo: string;
  amount: number;
  paymentMethod: FinancePaymentMethod;
  status: FinanceStatus;
  transactionDate: string;
  referenceNumber: string;
  notes: string;
  createdBy: FinanceActor;
  createdAt: string;
  updatedBy: FinanceActor;
  updatedAt: string;
};

export type FinanceTransactionInput = Omit<FinanceTransaction, "id" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt">;

export type FinanceFilters = {
  search?: string;
  unit?: ScoutUnit | "";
  transactionType?: FinanceTransactionType | "";
  category?: string;
  status?: FinanceStatus | "";
  dateFrom?: string;
  dateTo?: string;
};

export type FinanceSummary = {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  debt: number;
  thisMonth: number;
  pending: number;
  transactions: number;
};

export type EventRegistration = Pick<Scout, "id" | "name" | "unit" | "status">;

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

export type PointsTransaction = {
  id: number;
  scoutId: string;
  pointsChange: number;
  reason: string;
  leaderId: string;
  leaderName: string;
  createdAt: string;
};

export type LeaderboardEntry = {
  scoutId: string;
  name: string;
  unit: ScoutUnit;
  totalPoints: number;
};

export type GalleryAlbum = {
  id: number;
  name: string;
  slug: string;
  description: string;
  photoCount: number;
  coverThumbnailUrl: string | null;
  latestPhotoAt: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GalleryPhoto = {
  id: number;
  storageKey: string;
  imageUrl: string;
  thumbnailUrl: string;
  caption: string;
  albumId: number;
  albumName: string;
  eventDate: string;
  uploadedBy: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  } | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
};

export type GalleryPhotoFilters = {
  albumId?: number | null;
  cursor?: string | null;
  limit?: number;
  mine?: boolean;
  search?: string;
};

export type GalleryUploadInput = {
  files: File[];
  caption?: string;
  albumId?: number | null;
  albumName?: string;
  eventDate?: string;
};

export type GalleryUploadResult = {
  uploaded: GalleryPhoto[];
  failed: Array<{
    index: number;
    filename: string;
    error: string;
  }>;
};

export type GallerySummary = {
  totalPhotos: number;
  totalAlbums: number;
  latestPhotos: GalleryPhoto[];
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

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

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function updateStoredUser(user: AuthUser) {
  if (localStorage.getItem(tokenKey)) localStorage.setItem(userKey, JSON.stringify(user));
  else if (sessionStorage.getItem(tokenKey)) sessionStorage.setItem(userKey, JSON.stringify(user));
}

function apiOrigin() {
  if (API_URL.startsWith("http://") || API_URL.startsWith("https://")) {
    return API_URL.replace(/\/api$/, "");
  }

  return "";
}

function resolveMediaUrl(url: string) {
  if (!url.startsWith("/api/")) return url;
  return `${apiOrigin()}${url}`;
}

function normalizeGalleryPhoto(photo: GalleryPhoto): GalleryPhoto {
  return {
    ...photo,
    imageUrl: resolveMediaUrl(photo.imageUrl),
    thumbnailUrl: resolveMediaUrl(photo.thumbnailUrl),
  };
}

export const api = {
  units: () => request<{ units: ScoutUnit[]; unitRecords: UnitRecord[] }>("/units", {}, false),

  setupStatus: () =>
    request<{ setupRequired: boolean }>("/auth/setup-status", {}, false),

  setup: (input: {
    fullName: string;
    username: string;
    email: string;
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

  requestPasswordReset: (email: string) =>
    request<{ message: string }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),

  resetPassword: (token: string, password: string, confirmPassword: string) =>
    request<{ message: string }>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      },
      false,
    ),

  me: () => request<{ user: AuthUser }>("/auth/me"),

  scouts: {
    list: () => request<{ scouts: Scout[] }>("/scouts"),
    get: (id: string) => request<{ scout: Scout }>(`/scouts/${id}`),
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

  users: {
    list: () => request<{ users: AuthUser[] }>("/users"),
    create: (input: UserInput) =>
      request<{ user: AuthUser }>("/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UserInput) =>
      request<{ user: AuthUser }>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<void>(`/users/${id}`, { method: "DELETE" }),
  },

  attendance: {
    sessions: {
      list: (filters: { unit?: ScoutUnit | "" } = {}) =>
        request<{ sessions: AttendanceSession[] }>(`/attendance/sessions${buildQuery(filters)}`),
      get: (id: number, filters: { unit?: ScoutUnit | "" } = {}) =>
        request<AttendanceSessionDetail>(`/attendance/sessions/${id}${buildQuery(filters)}`),
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

  points: {
    add: (scoutId: string, pointsChange: number, reason: string) => {
      const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      return (
      request<{ transaction: PointsTransaction }>("/points", {
        method: "POST",
        body: JSON.stringify({ scoutId, pointsChange, reason, requestId }),
      })
      );
    },
    leaderboard: () => request<{ leaderboard: LeaderboardEntry[] }>("/points/leaderboard"),
    history: (scoutId: string) =>
      request<{ transactions: PointsTransaction[] }>(`/points/scouts/${scoutId}/history`),
  },

  events: {
    list: () => request<{ events: ScoutEvent[] }>("/events"),
    get: (id: number) => request<{ event: ScoutEvent; registrations: EventRegistration[] }>(`/events/${id}`),
    create: (input: ScoutEventInput) => request<{ event: ScoutEvent }>("/events", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: ScoutEventInput) => request<{ event: ScoutEvent }>(`/events/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    remove: (id: number) => request<void>(`/events/${id}`, { method: "DELETE" }),
    saveRegistrations: (id: number, scoutIds: string[]) => request<{ event: ScoutEvent; registrations: EventRegistration[] }>(`/events/${id}/registrations`, { method: "PUT", body: JSON.stringify({ scoutIds }) }),
  },

  finance: {
    transactions: (filters: FinanceFilters = {}) =>
      request<{ transactions: FinanceTransaction[] }>(`/finance/transactions${buildQuery(filters)}`),
    summary: (filters: FinanceFilters = {}) =>
      request<{ summary: FinanceSummary }>(`/finance/summary${buildQuery(filters)}`),
    get: (id: number) => request<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`),
    create: (input: FinanceTransactionInput) =>
      request<{ transaction: FinanceTransaction }>("/finance/transactions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: number, input: FinanceTransactionInput) =>
      request<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    remove: (id: number) => request<void>(`/finance/transactions/${id}`, { method: "DELETE" }),
  },

  gallery: {
    photos: (filters: GalleryPhotoFilters = {}) =>
      request<{ photos: GalleryPhoto[]; nextCursor: string | null }>(
        `/gallery/photos${buildQuery({
          albumId: filters.albumId,
          cursor: filters.cursor,
          limit: filters.limit,
          mine: filters.mine || undefined,
          search: filters.search,
        })}`,
      ).then((result) => ({
        ...result,
        photos: result.photos.map(normalizeGalleryPhoto),
      })),
    summary: (limit = 4) =>
      request<{ summary: GallerySummary }>(`/gallery/summary${buildQuery({ limit })}`).then((result) => ({
        summary: {
          ...result.summary,
          latestPhotos: result.summary.latestPhotos.map(normalizeGalleryPhoto),
        },
      })),
    albums: () => request<{ albums: GalleryAlbum[] }>("/gallery/albums"),
    createAlbum: (name: string) =>
      request<{ album: GalleryAlbum }>("/gallery/albums", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    upload: (input: GalleryUploadInput) => {
      const formData = new FormData();
      for (const file of input.files) formData.append("photos", file);
      if (input.caption?.trim()) formData.append("caption", input.caption.trim());
      if (input.albumId) formData.append("albumId", String(input.albumId));
      if (input.albumName?.trim()) formData.append("albumName", input.albumName.trim());
      if (input.eventDate) formData.append("eventDate", input.eventDate);
      return request<GalleryUploadResult>("/gallery/photos", {
        method: "POST",
        body: formData,
      }).then((result) => ({
        ...result,
        uploaded: result.uploaded.map(normalizeGalleryPhoto),
      }));
    },
    update: (id: number, input: { caption?: string; albumId?: number | null; eventDate?: string }) =>
      request<{ photo: GalleryPhoto }>(`/gallery/photos/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }).then((result) => ({ photo: normalizeGalleryPhoto(result.photo) })),
    remove: (id: number) =>
      request<{ warning: string | null }>(`/gallery/photos/${id}`, { method: "DELETE" }),
  },
};

export function roleLabel(role: UserRole) {
  if (role === "ADMIN") return "Administrator";
  if (role === "GROUP_LEADER") return "Group Leader";
  if (role === "UNIT_LEADER") return "Unit Leader";
  return "Scout";
}
