"use client";

import { platforms, type PlatformLinkErrors, type PlatformLinkValues } from "@/lib/platform-links";
import type { PlatformId } from "@/lib/types";

export function PlatformLinkFields({ values, errors, onChange, disabledPlatforms = [] }: { values: PlatformLinkValues; errors: PlatformLinkErrors; onChange: (platform: PlatformId, value: string) => void; disabledPlatforms?: PlatformId[] }) {
  return <div className="platform-link-grid">{platforms.map((platform) => { const disabled = disabledPlatforms.includes(platform.id); return <label className={`platform-link-card ${errors[platform.id] ? "invalid" : ""} ${disabled ? "disabled" : ""}`} key={platform.id}><span className={`platform-link-icon ${platform.id}`}>{platform.id === "youtube" ? "▶" : platform.id === "soop" ? "S" : "P"}</span><span className="platform-link-copy"><strong>{platform.name}{disabled && <i className="coming-soon-badge">개발 예정</i>}</strong><small>{platform.domain}</small></span><input type="url" value={values[platform.id]} disabled={disabled} onChange={(event) => onChange(platform.id, event.target.value)} placeholder={disabled ? "현재 등록할 수 없습니다" : `${platform.name} 방송 URL`} />{errors[platform.id] && <em>{errors[platform.id]}</em>}</label>; })}</div>;
}
