"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { formatDate, isExpired, parseServiceUsers, remainingDays } from "@/lib/admin-api";
import type { ServiceUser } from "@/lib/types";
import { platforms } from "@/lib/platform-links";

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>(); const [user, setUser] = useState<ServiceUser | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; apiClient<unknown>("/api/admin/users").then((data) => { if (!active) return; const found = parseServiceUsers(data).find((item) => item.id === userId); if (!found) setError("사용자를 찾을 수 없습니다."); else setUser(found); }).catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "사용자 정보를 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [userId]);
  if (loading) return <div className="admin-detail-loading">사용자 정보를 불러오는 중입니다.</div>;
  if (!user) return <><Link className="back-link" href="/admin/users">← 사용자 목록</Link><div className="alert error">{error}</div></>;
  const profile = user.profile; const expired = isExpired(user.usageExpiresAt);
  return <><div className="detail-page-head"><div><Link className="back-link" href="/admin/users">← 사용자 목록</Link><span className="eyebrow">USER DETAILS</span><h1>{user.loginId}</h1><p className="muted">가입 정보와 이용기간, 결제 증빙 정보를 확인합니다.</p></div><span className={`status-pill ${expired ? "inactive" : "active"}`}>{expired ? "기간 만료" : "이용 중"}</span></div><div className="admin-detail-grid">
    <DetailSection number="01" title="계정 및 이용정보"><Info label="아이디" value={user.loginId} /><Info label="이용기간" value={expired ? "기간 만료" : "이용 중"} danger={expired} /><Info label="이용 종료일" value={`${formatDate(user.usageExpiresAt)}${expired ? " · 기간 만료" : ""}`} danger={expired} /><Info label="남은 이용일" value={expired ? "만료됨" : `${remainingDays(user.usageExpiresAt)}일 남음`} /><Info label="가입일" value={formatDate(user.createdAt)} /><Info label="마지막 로그인" value={formatDate(user.lastLoginAt)} /></DetailSection>
    <DetailSection number="02" title="방송 링크 및 관리자 메모"><div className="detail-wide"><span>허용 방송 링크</span><div className="detail-link-list">{platforms.map((platform) => { const link = user.allowedLinks.find((item) => item.platform === platform.id); return <div className="detail-platform-link" key={platform.id}><b>{platform.name}</b>{link ? <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a> : <small>미등록</small>}</div>; })}</div></div><div className="detail-wide"><span>관리자 메모</span><strong>{user.memo || "-"}</strong></div></DetailSection>
    <DetailSection number="03" title="현금영수증 정보"><Info label="휴대폰번호" value={profile?.phoneNumber || "-"} /><Info label="현금영수증번호" value={profile?.cashReceiptNumber || "-"} /></DetailSection>
    <DetailSection number="04" title="세금계산서 정보"><Info label="사업자등록번호" value={profile?.businessRegistrationNumber || "-"} /><Info label="상호명" value={profile?.businessName || "-"} /><Info label="대표자명" value={profile?.representativeName || "-"} /><Info label="업태/종목" value={profile?.businessTypeItem || "-"} /><Info label="사업장주소" value={profile?.businessAddress || "-"} /><Info label="수신메일" value={profile?.billingEmail || "-"} /></DetailSection>
  </div></>;
}

function DetailSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="admin-detail-card"><div className="mypage-title"><span>{number}</span><div><h2>{title}</h2></div></div><div className="detail-info-grid">{children}</div></section>; }
function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div><span>{label}</span><strong className={danger ? "danger-text" : ""}>{value}</strong></div>; }
