"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatDate, isExpired, parseServiceUsers, remainingDays, toEndOfLocalDay } from "@/lib/admin-api";
import type { ServiceUser } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast-provider";
import { maskBusinessNumber, maskPhone } from "@/lib/profile-api";
import { PlatformLinkFields } from "@/components/platform-link-fields";
import { linksToValues, validatePlatformLinks, valuesToRequest, type PlatformLinkErrors } from "@/lib/platform-links";
import type { PlatformId } from "@/lib/types";


export default function UsersPage() {
  const [users, setUsers] = useState<ServiceUser[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ type: "period" | "links" | "memo"; user: ServiceUser } | null>(null);
  const { showToast } = useToast();
  const router = useRouter();
  const loadUsers = useCallback(async () => { setLoading(true); try { setUsers(parseServiceUsers(await apiClient<unknown>("/api/admin/users"))); setError(""); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "사용자 목록을 불러오지 못했습니다."); } finally { setLoading(false); } }, []);
  useEffect(() => { let active = true; apiClient<unknown>("/api/admin/users").then((data) => { if (active) setUsers(parseServiceUsers(data)); }).catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "사용자 목록을 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const filteredUsers = useMemo(() => { const value = query.trim().toLowerCase(); return value ? users.filter((user) => user.loginId.toLowerCase().includes(value) || (user.memo ?? "").toLowerCase().includes(value) || user.allowedLinks.some((link) => link.url.toLowerCase().includes(value))) : users; }, [query, users]);
  async function completed(message: string) { setModal(null); showToast(message, "success"); await loadUsers(); }
  return <>
    <header className="admin-page-head"><div><span className="eyebrow">ACCOUNT MANAGEMENT</span><h1>사용자 관리</h1><p className="muted">가입한 사용자의 승인, 이용기간과 계정 정보를 관리합니다.</p></div></header>
    <section className="management-card"><div className="toolbar"><input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="아이디, 메모 또는 허용 링크 검색" /><button className="secondary compact" disabled={loading} type="button" onClick={() => void loadUsers()}>새로고침</button></div>
      {error && <div className="alert error">{error}</div>}
      {loading ? <div className="table-empty">사용자 목록을 불러오는 중입니다.</div> : filteredUsers.length ? <div className="table-scroll"><table className="users-table"><thead><tr><th>아이디</th><th>이용기간</th><th>이용 종료일</th><th>휴대폰번호</th><th>사업자등록번호</th><th>가입일</th><th>관리</th></tr></thead><tbody>{filteredUsers.map((user) => { const expired = isExpired(user.usageExpiresAt); const openPayments = () => router.push(`/admin/users/${user.id}#payments`); return <tr className={`user-payment-row ${expired ? "expired-row" : ""}`} key={user.id} tabIndex={0} title="클릭하여 결제 내역 보기" onClick={openPayments} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPayments(); } }}><td><strong>{user.loginId}</strong><small className="row-payment-hint">결제 내역 보기</small></td><td><span className={`status-pill ${expired ? "inactive" : "active"}`}>{expired ? "기간 만료" : "이용 중"}</span></td><td><div>{formatDate(user.usageExpiresAt)}</div>{expired && <span className="expiry-badge">기간 만료</span>}</td><td>{maskPhone(user.profile?.phoneNumber ?? null)}</td><td>{maskBusinessNumber(user.profile?.businessRegistrationNumber ?? null)}</td><td>{formatDate(user.createdAt)}</td><td onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><UserManageMenu user={user} expired={expired} onAction={(type) => setModal({ type, user })} /></td></tr>; })}</tbody></table></div> : <div className="table-empty">{query ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}</div>}
    </section>
    {modal?.type === "period" && <UsagePeriodModal user={modal.user} onClose={() => setModal(null)} onComplete={() => completed("이용기간을 변경했습니다.")} />}
    {modal?.type === "links" && <AllowedLinksModal user={modal.user} onClose={() => setModal(null)} onComplete={() => completed("허용 링크를 수정했습니다.")} />}
    {modal?.type === "memo" && <MemoModal user={modal.user} onClose={() => setModal(null)} onComplete={() => completed("관리자 메모를 수정했습니다.")} />}
  </>;
}

function UserManageMenu({ user, expired, onAction }: { user: ServiceUser; expired: boolean; onAction: (type: "period" | "links" | "memo") => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggle = () => {
    if (open) return setOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 224; const menuHeight = 292; const gap = 8;
      const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth));
      const top = window.innerHeight - rect.bottom >= menuHeight ? rect.bottom + gap : Math.max(12, rect.top - menuHeight - gap);
      setPosition({ top, left });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { const target = event.target as Node; if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false); };
    const closeOnKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOnMove = () => setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", closeOnKey); window.addEventListener("resize", closeOnMove); window.addEventListener("scroll", closeOnMove, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", closeOnKey); window.removeEventListener("resize", closeOnMove); window.removeEventListener("scroll", closeOnMove, true); };
  }, [open]);
  const action = (type: "period" | "links" | "memo") => { setOpen(false); onAction(type); };
  return <><button ref={buttonRef} className={`manage-trigger ${open ? "active" : ""} ${expired ? "expired" : ""}`} type="button" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><span>관리</span><b>•••</b></button>{open && createPortal(<div ref={menuRef} className="manage-popover" role="menu" style={position}><div className="manage-popover-head"><span>사용자 관리</span><strong>{user.loginId}</strong></div><Link role="menuitem" href={`/admin/users/${user.id}`} onClick={() => setOpen(false)}><i>↗</i><span><strong>상세보기</strong><small>가입 및 이용정보 확인</small></span></Link><button role="menuitem" type="button" onClick={() => action("period")}><i>◷</i><span><strong>이용기간 변경</strong><small>이용기간 연장 또는 만료 처리</small></span></button><button role="menuitem" type="button" onClick={() => action("links")}><i>⌁</i><span><strong>허용 링크 수정</strong><small>플랫폼 방송 주소 관리</small></span></button><button role="menuitem" type="button" onClick={() => action("memo")}><i>✎</i><span><strong>메모 수정</strong><small>관리자용 메모 작성</small></span></button></div>, document.body)}</>;
}

function errorText(error: unknown, fallback: string) { if (error instanceof ApiError && error.status === 400) return "입력 내용을 확인해주세요."; if (error instanceof ApiError && error.status === 403) return "관리자 권한이 필요합니다."; if (error instanceof ApiError && error.status === 409) return "이미 사용 중인 아이디입니다."; return error instanceof Error ? error.message : fallback; }

function UsagePeriodModal({ user, onClose, onComplete }: UserModalProps) { const [date, setDate] = useState(""); const [referenceTime] = useState(() => Date.now()); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(""); const oldTime = new Date(user.usageExpiresAt).getTime(); const newTime = date ? new Date(toEndOfLocalDay(date)).getTime() : 0; const isPast = Boolean(date) && newTime <= referenceTime; const changedDays = date ? Math.ceil(Math.abs(newTime - oldTime) / 86_400_000) : 0; async function submit(event: FormEvent) { event.preventDefault(); if (!date || !Number.isFinite(newTime)) return setError("변경할 이용 종료일을 선택해주세요."); setSubmitting(true); setError(""); try { await apiClient(`/api/admin/users/${user.id}/usage-period`, { method: "PATCH", body: JSON.stringify({ usageExpiresAt: toEndOfLocalDay(date) }) }); await onComplete(); } catch (requestError) { setError(errorText(requestError, "이용기간을 변경하지 못했습니다.")); } finally { setSubmitting(false); } } return <Modal title="이용기간 변경" onClose={onClose} closeDisabled={submitting}><form className="modal-form" onSubmit={submit}><div className="period-summary"><span>현재 이용 종료일<strong>{formatDate(user.usageExpiresAt)}</strong></span><span>현재 남은 이용일<strong>{isExpired(user.usageExpiresAt) ? "만료됨" : `${remainingDays(user.usageExpiresAt)}일`}</strong></span></div><label>변경할 이용 종료일<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>{date && <div className={`extension-preview ${isPast ? "expires" : ""}`}>{isPast ? <>저장 즉시 <strong>이용기간 만료</strong>로 처리되어 시청자 프로그램을 이용할 수 없습니다.</> : newTime > oldTime ? <>이용기간이 <strong>{changedDays}일 연장</strong>됩니다.</> : newTime < oldTime ? <>이용기간이 <strong>{changedDays}일 단축</strong>됩니다.</> : <>현재 이용 종료일과 동일합니다.</>}</div>}{error && <div className="alert error">{error}</div>}<ModalActions submitting={submitting} onClose={onClose} label="변경" /></form></Modal>; }

function AllowedLinksModal({ user, onClose, onComplete }: UserModalProps) { const [links, setLinks] = useState(linksToValues(user.allowedLinks)); const [errors, setErrors] = useState<PlatformLinkErrors>({}); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(""); function update(platform: PlatformId, value: string) { setLinks((current) => ({ ...current, [platform]: value })); setErrors((current) => ({ ...current, [platform]: undefined })); } async function submit(event: FormEvent) { event.preventDefault(); const validation = validatePlatformLinks(links); setErrors(validation); if (Object.keys(validation).length) return; setSubmitting(true); try { await apiClient(`/api/admin/users/${user.id}/allowed-links`, { method: "PUT", body: JSON.stringify({ allowedLinks: valuesToRequest(links) }) }); await onComplete(); } catch (requestError) { setError(requestError instanceof ApiError && requestError.status === 400 ? "링크 형식 또는 플랫폼 중복 여부를 확인해주세요." : errorText(requestError, "허용 링크를 수정하지 못했습니다.")); } finally { setSubmitting(false); } } return <Modal title="허용 링크 수정" onClose={onClose} closeDisabled={submitting}><form className="modal-form" onSubmit={submit}><PlatformLinkFields values={links} errors={errors} onChange={update} />{error && <div className="alert error">{error}</div>}<ModalActions submitting={submitting} onClose={onClose} label="저장" /></form></Modal>; }

function MemoModal({ user, onClose, onComplete }: UserModalProps) { const [memo, setMemo] = useState(user.memo ?? ""); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setSubmitting(true); try { await apiClient(`/api/admin/users/${user.id}/memo`, { method: "PATCH", body: JSON.stringify({ memo: memo.trim() }) }); await onComplete(); } catch (requestError) { setError(errorText(requestError, "메모를 수정하지 못했습니다.")); } finally { setSubmitting(false); } } return <Modal title="관리자 메모 수정" onClose={onClose} closeDisabled={submitting}><form className="modal-form" onSubmit={submit}><label>관리자 메모<textarea autoFocus value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={1000} placeholder="비워두면 메모가 삭제됩니다." /><small className="counter">{memo.length}/1000</small></label>{error && <div className="alert error">{error}</div>}<ModalActions submitting={submitting} onClose={onClose} label="저장" /></form></Modal>; }

type UserModalProps = { user: ServiceUser; onClose: () => void; onComplete: () => Promise<void> };
function ModalActions({ submitting, onClose, label }: { submitting: boolean; onClose: () => void; label: string }) { return <div className="modal-actions"><button className="secondary" type="button" disabled={submitting} onClick={onClose}>취소</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "처리 중..." : label}</button></div>; }
