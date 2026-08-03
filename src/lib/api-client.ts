import type { AllowedLink, AuthUser, PlatformId } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001").replace(/\/$/, "");
const AUTH_EXPIRED_EVENT = "viewer-monitor:auth-expired";
const AUTH_REFRESHED_EVENT = "viewer-monitor:auth-refreshed";
const ACCESS_DENIED_EVENT = "viewer-monitor:access-denied";
const NO_AUTO_REFRESH_PATHS = new Set([
  "/api/auth/admin/login",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/user/login",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

export let refreshPromise: Promise<boolean> | null = null;
let refreshFailureMessage: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = RequestInit & {
  retry?: boolean;
  suppressAuthExpired?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) return fallback;
  if (Array.isArray(data.message)) return data.message.filter((item): item is string => typeof item === "string").join(" ") || fallback;
  return typeof data.message === "string" ? data.message : fallback;
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json().catch(() => undefined);
  const text = await response.text();
  return text || undefined;
}

function expireAuthentication(message?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string | null>(AUTH_EXPIRED_EVENT, { detail: message ?? null }));
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

async function refreshSession(): Promise<boolean> {
  refreshFailureMessage = null;
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    const data = await readResponse(response);
    if (!response.ok) { refreshFailureMessage = errorMessage(data, "로그인이 만료되었습니다."); return false; }
    const user = parseAuthUser(data);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AuthUser>(AUTH_REFRESHED_EVENT, { detail: user }));
    return true;
  } catch {
    return false;
  }
}

async function getRefreshResult() {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiClient<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { retry = false, suppressAuthExpired = false, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  if (requestInit.body && !(requestInit.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestInit,
      headers,
      credentials: "include",
      cache: requestInit.cache ?? "no-store",
    });
  } catch (error) {
    throw new ApiError("백엔드 서버에 연결할 수 없습니다.", 0, error);
  }

  if (response.status === 401 && !retry && !NO_AUTO_REFRESH_PATHS.has(path)) {
    const refreshed = await getRefreshResult();
    if (refreshed) return apiClient<T>(path, { ...requestInit, retry: true, suppressAuthExpired });
    if (!suppressAuthExpired) expireAuthentication(refreshFailureMessage);
    throw new ApiError("로그인이 만료되었습니다. 다시 로그인해주세요.", 401);
  }

  if (response.status === 401 && retry && !NO_AUTO_REFRESH_PATHS.has(path)) {
    if (!suppressAuthExpired) expireAuthentication("로그인이 만료되었습니다. 다시 로그인해주세요.");
    throw new ApiError("로그인이 만료되었습니다. 다시 로그인해주세요.", 401);
  }

  const data = await readResponse(response);
  if (!response.ok) {
    if (response.status === 403 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent<string>(ACCESS_DENIED_EVENT, { detail: path }));
    throw new ApiError(errorMessage(data, response.status === 403 ? "권한이 없습니다." : "요청에 실패했습니다."), response.status, data);
  }
  return data as T;
}

export function subscribeToAuthExpired(listener: (message: string | null) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string | null>).detail);
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}

export function subscribeToAuthRefreshed(listener: (user: AuthUser) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<AuthUser>).detail);
  window.addEventListener(AUTH_REFRESHED_EVENT, handler);
  return () => window.removeEventListener(AUTH_REFRESHED_EVENT, handler);
}

export function subscribeToAccessDenied(listener: (path: string) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(ACCESS_DENIED_EVENT, handler);
  return () => window.removeEventListener(ACCESS_DENIED_EVENT, handler);
}

export function parseAuthUser(data: unknown): AuthUser {
  const source = isRecord(data) && isRecord(data.user) ? data.user : data;
  if (!isRecord(source)) throw new ApiError("인증 응답 형식이 올바르지 않습니다.", 500, data);
  const id = source.id;
  const username = typeof source.username === "string" ? source.username : source.loginId;
  const role = source.role;
  if (typeof id !== "string" || typeof username !== "string" || (role !== "admin" && role !== "user")) {
    throw new ApiError("인증 응답 형식이 올바르지 않습니다.", 500, data);
  }
  const usageExpiresAt = typeof source.usageExpiresAt === "string" ? source.usageExpiresAt : undefined;
  const platformIds: PlatformId[] = ["panda", "soop", "youtube"];
  const parsedLinks = Array.isArray(source.allowedLinks) ? source.allowedLinks.map((value): AllowedLink | null => {
    if (!isRecord(value) || !platformIds.includes(value.platform as PlatformId) || typeof value.url !== "string") return null;
    return { platform: value.platform as PlatformId, url: value.url, ...(typeof value.id === "string" ? { id: value.id } : {}), ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}) };
  }) : undefined;
  if (parsedLinks?.some((link) => link === null)) throw new ApiError("허용 링크 응답 형식이 올바르지 않습니다.", 500, data);
  const allowedLinks = parsedLinks as AllowedLink[] | undefined;
  return { id, username, role, ...(allowedLinks ? { allowedLinks } : {}), ...(usageExpiresAt ? { usageExpiresAt } : {}) };
}
