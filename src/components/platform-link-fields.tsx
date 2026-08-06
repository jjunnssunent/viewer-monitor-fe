"use client";

import { platforms, type PlatformLinkErrors, type PlatformLinkValues } from "@/lib/platform-links";
import type { PlatformId } from "@/lib/types";

export function PlatformLinkFields({ values, errors, onChange, disabledPlatforms = [], lockedPlatforms = [] }: { values: PlatformLinkValues; errors: PlatformLinkErrors; onChange: (platform: PlatformId, value: string) => void; disabledPlatforms?: PlatformId[]; lockedPlatforms?: PlatformId[] }) {
  return <div className="platform-link-grid">{platforms.map((platform) => {
    const comingSoon = disabledPlatforms.includes(platform.id);
    const locked = lockedPlatforms.includes(platform.id);
    const disabled = comingSoon || locked;
    return <label className={`platform-link-card ${errors[platform.id] ? "invalid" : ""} ${disabled ? "disabled" : ""} ${locked ? "locked" : ""}`} key={platform.id}><span className={`platform-link-icon ${platform.id}`}>{platform.id === "youtube" ? "▶" : platform.id === "soop" ? "S" : "P"}</span><span className="platform-link-copy"><strong>{platform.name}{comingSoon && <i className="coming-soon-badge">개발 예정</i>}{locked && <i className="registration-locked-badge">등록 완료 · 변경 불가</i>}</strong><small>{platform.domain}</small></span><input type="url" value={values[platform.id]} disabled={disabled} onChange={(event) => onChange(platform.id, event.target.value)} placeholder={comingSoon ? "현재 등록할 수 없습니다" : locked ? "등록된 링크입니다" : `${platform.name} 방송 URL`} />{errors[platform.id] && <em>{errors[platform.id]}</em>}</label>;
  })}</div>;
}
