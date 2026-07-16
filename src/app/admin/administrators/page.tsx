"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatDate, parseAdministrators } from "@/lib/admin-api";
import type { Administrator } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast-provider";

const loginIdPattern = /^[a-zA-Z0-9._-]{3,100}$/;

export default function AdministratorsPage() {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { showToast } = useToast();
  const loadAdministrators = useCallback(async () => {
    try { setAdministrators(parseAdministrators(await apiClient<unknown>("/api/admin/administrators"))); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "관리자 목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    apiClient<unknown>("/api/admin/administrators")
      .then((data) => { if (active) { setAdministrators(parseAdministrators(data)); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "관리자 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <>
      <header className="admin-page-head"><div><span className="eyebrow">ADMIN MANAGEMENT</span><h1>관리자 관리</h1><p className="muted">StreamPulse를 운영할 관리자 계정을 관리합니다.</p></div><button className="primary" type="button" onClick={() => setCreateOpen(true)}>관리자 생성</button></header>
      <section className="management-card">
        <div className="toolbar"><span className="muted">총 {administrators.length}명</span><button className="secondary compact" type="button" disabled={loading} onClick={() => { setLoading(true); void loadAdministrators(); }}>새로고침</button></div>
        {error && <div className="alert error">{error}</div>}
        {loading ? <div className="table-empty">관리자 목록을 불러오는 중입니다.</div> : administrators.length ? <div className="table-scroll"><table><thead><tr><th>아이디</th><th>생성일</th><th>마지막 로그인</th><th>생성한 관리자</th></tr></thead><tbody>{administrators.map((administrator) => <tr key={administrator.id}><td><strong>{administrator.loginId}</strong></td><td>{formatDate(administrator.createdAt)}</td><td>{formatDate(administrator.lastLoginAt)}</td><td>{administrator.createdBy ?? "-"}</td></tr>)}</tbody></table></div> : <div className="table-empty">등록된 관리자가 없습니다.</div>}
      </section>
      {createOpen && <CreateAdministratorModal onClose={() => setCreateOpen(false)} onCreated={async () => { setCreateOpen(false); showToast("관리자를 생성했습니다.", "success"); await loadAdministrators(); }} />}
    </>
  );
}

function CreateAdministratorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [loginId, setLoginId] = useState(""); const [password, setPassword] = useState(""); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting) return; setError("");
    if (!loginIdPattern.test(loginId)) { setError("아이디는 3~100자의 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다."); return; }
    if (password.length < 12 || password.length > 200) { setError("관리자 비밀번호는 12~200자로 입력해주세요."); return; }
    setSubmitting(true);
    try { await apiClient("/api/admin/administrators", { method: "POST", body: JSON.stringify({ loginId, password }) }); setLoginId(""); setPassword(""); await onCreated(); }
    catch (requestError) { setError(requestError instanceof ApiError && requestError.status === 409 ? "이미 사용 중인 아이디입니다." : requestError instanceof Error ? requestError.message : "관리자를 생성하지 못했습니다."); }
    finally { setSubmitting(false); }
  }
  return <Modal title="관리자 생성" onClose={onClose} closeDisabled={submitting}><form className="modal-form" onSubmit={submit}><label>아이디<input value={loginId} onChange={(event) => setLoginId(event.target.value)} minLength={3} maxLength={100} pattern="[a-zA-Z0-9._-]+" required autoFocus /></label><label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={200} autoComplete="new-password" required /></label><p className="form-help">관리자 비밀번호는 최소 12자입니다.</p>{error && <div className="alert error" role="alert">{error}</div>}<div className="modal-actions"><button className="secondary" type="button" disabled={submitting} onClick={onClose}>취소</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "생성 중..." : "생성"}</button></div></form></Modal>;
}
