"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "./auth-provider";
import { useToast } from "./toast-provider";

type PasswordField = "current" | "next" | "confirm";
type ChangePasswordResponse = { success: true; requiresLogin: true };

export function PasswordChangeCard() {
  const router = useRouter(); const { clearAuthentication } = useAuth(); const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [visible, setVisible] = useState<Record<PasswordField, boolean>>({ current: false, next: false, confirm: false }); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  function toggle(field: PasswordField) { setVisible((state) => ({ ...state, [field]: !state[field] })); }
  function resetInputs() { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setVisible({ current: false, next: false, confirm: false }); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting) return; setError("");
    if (!currentPassword || currentPassword.length < 8 || currentPassword.length > 200) return setError("현재 비밀번호를 입력해주세요.");
    if (newPassword.length < 8 || newPassword.length > 200) return setError("새 비밀번호는 8자 이상 입력해주세요.");
    if (newPassword !== confirmPassword) return setError("새 비밀번호가 일치하지 않습니다.");
    if (currentPassword === newPassword) return setError("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
    if (!window.confirm("비밀번호를 변경하면 현재 기기를 포함한 모든 기기에서 로그아웃됩니다. 계속하시겠습니까?")) return;
    setSubmitting(true);
    try {
      await apiClient<ChangePasswordResponse>("/api/users/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
      clearAuthentication(); resetInputs(); showToast("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.", "success"); router.replace("/login");
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 400) setError("새 비밀번호는 현재 비밀번호와 다르게 설정해주세요.");
      else if (requestError instanceof ApiError && requestError.status === 401) setError("현재 비밀번호가 올바르지 않습니다.");
      else if (requestError instanceof ApiError && requestError.status === 403) setError("비밀번호를 변경할 권한이 없습니다.");
      else setError("비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally { setSubmitting(false); }
  }
  return <section className="mypage-section password-card"><div className="mypage-title"><span>05</span><div><h2>비밀번호 변경</h2><p>비밀번호를 변경하면 모든 기기에서 로그아웃됩니다.</p></div></div><form className="password-form" onSubmit={submit}><PasswordInput id="currentPassword" label="현재 비밀번호" value={currentPassword} visible={visible.current} autoComplete="current-password" onChange={setCurrentPassword} onToggle={() => toggle("current")} /><PasswordInput id="newPassword" label="새 비밀번호" value={newPassword} visible={visible.next} autoComplete="new-password" onChange={setNewPassword} onToggle={() => toggle("next")} /><PasswordInput id="confirmPassword" label="새 비밀번호 확인" value={confirmPassword} visible={visible.confirm} autoComplete="new-password" onChange={setConfirmPassword} onToggle={() => toggle("confirm")} />{error && <div className="alert error password-error" role="alert">{error}</div>}<div className="mypage-actions"><button className="primary" type="submit" disabled={submitting}>{submitting ? "변경 중..." : "비밀번호 변경"}</button></div></form></section>;
}

function PasswordInput({ id, label, value, visible, autoComplete, onChange, onToggle }: { id: string; label: string; value: string; visible: boolean; autoComplete: string; onChange: (value: string) => void; onToggle: () => void }) { return <label className="password-label" htmlFor={id}>{label}<span className="password-input-wrap"><input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} required /><button type="button" onClick={onToggle} aria-label={`${label} ${visible ? "숨기기" : "표시"}`}>{visible ? "숨기기" : "보기"}</button></span></label>; }
