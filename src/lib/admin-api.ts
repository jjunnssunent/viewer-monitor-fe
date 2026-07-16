import { ApiError } from "./api-client";
import type { Administrator, AllowedLink, PlatformId, ServiceUser } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function stringValue(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullableString(value: unknown) { return typeof value === "string" ? value : null; }
function profileDetails(value: unknown) { if (!isRecord(value)) return null; return { phoneNumber: nullableString(value.phoneNumber), cashReceiptNumber: nullableString(value.cashReceiptNumber), businessRegistrationNumber: nullableString(value.businessRegistrationNumber), businessName: nullableString(value.businessName), representativeName: nullableString(value.representativeName), businessTypeItem: nullableString(value.businessTypeItem), businessAddress: nullableString(value.businessAddress), billingEmail: nullableString(value.billingEmail), createdAt: stringValue(value.createdAt), updatedAt: stringValue(value.updatedAt) }; }

function listFrom(data: unknown, key: "users" | "administrators") {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data[key])) return data[key];
  if (isRecord(data) && Array.isArray(data.data)) return data.data;
  throw new ApiError("목록 응답 형식이 올바르지 않습니다.", 500, data);
}

function parseAllowedLinks(value: unknown, source: unknown): AllowedLink[] {
  if (!Array.isArray(value)) throw new ApiError("허용 링크 응답 형식이 올바르지 않습니다.", 500, source);
  return value.map((item) => {
    const platforms: PlatformId[] = ["panda", "soop", "youtube"];
    if (!isRecord(item) || typeof item.id !== "string" || !platforms.includes(item.platform as PlatformId) || typeof item.url !== "string") {
      throw new ApiError("허용 링크 응답 형식이 올바르지 않습니다.", 500, source);
    }
    return { id: item.id, platform: item.platform as PlatformId, url: item.url, ...(typeof item.createdAt === "string" ? { createdAt: item.createdAt } : {}) };
  });
}

export function parseServiceUsers(data: unknown): ServiceUser[] {
  return listFrom(data, "users").map((item) => {
    if (!isRecord(item)) throw new ApiError("사용자 응답 형식이 올바르지 않습니다.", 500, data);
    const result: ServiceUser = {
      id: stringValue(item.id), loginId: stringValue(item.loginId),
      memo: nullableString(item.memo), usageExpiresAt: stringValue(item.usageExpiresAt),
      allowedLinks: parseAllowedLinks(item.allowedLinks, data), createdAt: stringValue(item.createdAt),
      updatedAt: stringValue(item.updatedAt), lastLoginAt: nullableString(item.lastLoginAt),
      createdByAdminId: stringValue(item.createdByAdminId),
      profile: profileDetails(item.profile),
    };
    if (!result.id || !result.loginId || !result.usageExpiresAt) throw new ApiError("사용자 응답 형식이 올바르지 않습니다.", 500, data);
    return result;
  });
}

export function parseAdministrators(data: unknown): Administrator[] {
  return listFrom(data, "administrators").map((item) => {
    if (!isRecord(item)) throw new ApiError("관리자 응답 형식이 올바르지 않습니다.", 500, data);
    const id = stringValue(item.id); const loginId = stringValue(item.loginId) || stringValue(item.username);
    if (!id || !loginId) throw new ApiError("관리자 응답 형식이 올바르지 않습니다.", 500, data);
    return { id, loginId, createdAt: stringValue(item.createdAt), lastLoginAt: nullableString(item.lastLoginAt), createdBy: nullableString(item.createdByAdminId) };
  });
}

export function formatDate(value: string | null, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(date);
}

export function remainingDays(value: string) { return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)); }
export function isExpired(value: string) { return new Date(value).getTime() <= Date.now(); }
export function toEndOfLocalDay(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999)).toISOString(); }
export function localDateValue(value = new Date()) { return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
