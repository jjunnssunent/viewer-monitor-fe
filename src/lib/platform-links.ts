import type { AllowedLink, PlatformId } from "./types";

export const platforms: Array<{ id: PlatformId; name: string; domain: string }> = [
  { id: "panda", name: "팬더티비", domain: "pandalive.co.kr" },
  { id: "soop", name: "숲", domain: "sooplive.co.kr" },
  { id: "youtube", name: "유튜브", domain: "youtube.com / youtu.be" },
];
export type PlatformLinkValues = Record<PlatformId, string>;
export type PlatformLinkErrors = Partial<Record<PlatformId, string>>;
export const emptyPlatformLinks = (): PlatformLinkValues => ({ panda: "", soop: "", youtube: "" });
export function linksToValues(links: AllowedLink[]): PlatformLinkValues { const values = emptyPlatformLinks(); for (const link of links) values[link.platform] = link.url; return values; }
export function validatePlatformLinks(values: PlatformLinkValues): PlatformLinkErrors { const errors: PlatformLinkErrors = {}; for (const platform of platforms) { const value = values[platform.id].trim(); if (!value) continue; try { const url = new URL(value); if (url.protocol !== "https:") { errors[platform.id] = "HTTPS 링크만 사용할 수 있습니다."; continue; } const host = url.hostname.toLowerCase(); const valid = platform.id === "youtube" ? host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") : host === platform.domain || host.endsWith(`.${platform.domain}`); if (!valid) errors[platform.id] = `${platform.name} 허용 도메인과 일치하지 않습니다.`; } catch { errors[platform.id] = "올바른 URL을 입력해주세요."; } } return errors; }
export function valuesToRequest(values: PlatformLinkValues) { return platforms.flatMap(({ id }) => { const url = values[id].trim(); return url ? [{ platform: id, url }] : []; }); }
