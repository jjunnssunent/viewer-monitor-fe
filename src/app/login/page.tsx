"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError, parseAuthUser } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";
import { Modal } from "@/components/modal";
import type { AuthUser } from "@/lib/types";

function activeSessionConflictRole(error: unknown): "admin" | "user" | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  if (typeof error.data !== "object" || error.data === null) return null;
  if (!("code" in error.data) || error.data.code !== "ACTIVE_SESSION_EXISTS") return null;
  return "role" in error.data && error.data.role === "admin" ? "admin" : "user";
}

export default function LoginPage() {
  const router = useRouter(); const { user, loading, setAuthenticatedUser } = useAuth(); const { showToast } = useToast();
  const [pageMode, setPageMode] = useState<"login" | "register">("login");
  const [loginId, setLoginId] = useState(""); const [password, setPassword] = useState(""); const [passwordConfirm, setPasswordConfirm] = useState(""); const [message, setMessage] = useState(""); const [submitting, setSubmitting] = useState(false);
  const [takeoverOpen, setTakeoverOpen] = useState(false); const [takeoverSubmitting, setTakeoverSubmitting] = useState(false); const [takeoverError, setTakeoverError] = useState("");
  const [takeoverRole, setTakeoverRole] = useState<"admin" | "user">("user");
  useEffect(() => { if (!loading && user && pageMode === "login") router.replace(user.role === "admin" ? "/admin/users" : "/monitor"); }, [loading, pageMode, router, user]);

  function completeLogin(authenticatedUser: AuthUser) {
    setAuthenticatedUser(authenticatedUser);
    router.replace(authenticatedUser.role === "admin" ? "/admin/users" : "/monitor");
    router.refresh();
  }

  async function requestLogin(forceLogin = false, target?: "admin" | "user") {
    if (target === "admin") {
      return apiClient<unknown>("/api/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId, password, forceLogin }) });
    }
    if (target === "user") {
      return apiClient<unknown>("/api/auth/user/login", { method: "POST", body: JSON.stringify({ loginId, password, forceLogin }) });
    }
    try {
      return await apiClient<unknown>("/api/auth/user/login", { method: "POST", body: JSON.stringify({ loginId, password, forceLogin }) });
    } catch (error) {
      if (!forceLogin && error instanceof ApiError && error.status === 401) {
        return apiClient<unknown>("/api/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId, password, forceLogin: false }) });
      }
      throw error;
    }
  }

  function showRequestError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) setMessage("아이디 또는 비밀번호를 확인해주세요.");
    else if (error instanceof ApiError && error.status === 0) setMessage("서버에 연결할 수 없습니다.");
    else setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting) return; setMessage("");
    if (!loginId || !password || /\s/.test(loginId) || /\s/.test(password)) return setMessage("공백 없이 입력해주세요.");
    if (pageMode === "register" && !/^[a-zA-Z0-9._-]{3,100}$/.test(loginId)) return setMessage("아이디는 3~100자의 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.");
    if (pageMode === "register" && password !== passwordConfirm) return setMessage("비밀번호가 일치하지 않습니다.");
    setSubmitting(true);
    try {
      if (pageMode === "register") {
        const data = await apiClient<unknown>("/api/auth/register", { method: "POST", body: JSON.stringify({ loginId, password }) });
        setAuthenticatedUser(parseAuthUser(data)); showToast("회원가입이 완료되었습니다.", "success"); router.replace("/mypage?registered=1"); router.refresh(); return;
      }
      completeLogin(parseAuthUser(await requestLogin()));
    } catch (error) {
      const conflictRole = activeSessionConflictRole(error);
      if (conflictRole) { setTakeoverRole(conflictRole); setTakeoverError(""); setTakeoverOpen(true); }
      else if (pageMode === "register" && error instanceof ApiError && error.status === 400) setMessage("입력값을 확인해주세요.");
      else if (pageMode === "register" && error instanceof ApiError && error.status === 409) setMessage("이미 사용 중인 아이디입니다.");
      else showRequestError(error);
    } finally { setSubmitting(false); }
  }

  async function confirmTakeover() {
    if (takeoverSubmitting) return; setTakeoverSubmitting(true); setTakeoverError("");
    try {
      completeLogin(parseAuthUser(await requestLogin(true, takeoverRole))); setTakeoverOpen(false);
      showToast("기존 접속과 시청을 종료하고 현재 위치에서 로그인했습니다.", "success");
    } catch (error) {
      setTakeoverError(error instanceof Error ? error.message : "기존 접속을 종료하고 로그인하지 못했습니다.");
    } finally { setTakeoverSubmitting(false); }
  }

  if (loading) return <main className="loading-screen">로그인 상태를 확인하고 있습니다.</main>;
  return <main className="login-shell"><div className="login-glow glow-one" /><div className="login-glow glow-two" /><section className="login-visual"><div className="login-brand"><span className="login-brand-mark">SP</span><strong>StreamPulse</strong></div><div className="visual-copy"><span className="eyebrow">STREAM CONTROL CENTER</span><h2>모든 방송의 흐름을<br />한눈에 확인하세요.</h2><p>멀티 플랫폼 시청 세션과 서비스 계정을<br />하나의 안전한 콘솔에서 관리합니다.</p></div><div className="pulse-visual"><span className="pulse-ring ring-one" /><span className="pulse-ring ring-two" /><span className="pulse-core">▶</span><span className="pulse-line" /></div></section>
    <section className="login-card-wrap"><div className="login-card"><div className="login-mobile-brand"><span>SP</span><strong>StreamPulse</strong></div><span className="eyebrow">START STREAMPULSE</span><h1>{pageMode === "login" ? <>다시 오신 것을<br />환영합니다.</> : <>StreamPulse를<br />시작하세요.</>}</h1><p className="muted">{pageMode === "login" ? "StreamPulse 계정으로 로그인하세요." : "아이디와 비밀번호만으로 가입할 수 있습니다."}</p>
      <div className="auth-tabs"><button className={pageMode === "login" ? "active" : ""} type="button" onClick={() => { setPageMode("login"); setMessage(""); }}>로그인</button><button className={pageMode === "register" ? "active" : ""} type="button" onClick={() => { setPageMode("register"); setMessage(""); }}>회원가입</button></div>
      <form onSubmit={submit}>
        <label className="login-label" htmlFor="loginId">아이디</label><input className="login-input" id="loginId" type="text" autoComplete="username" value={loginId} onChange={(event) => setLoginId(event.target.value)} minLength={3} maxLength={100} placeholder="아이디를 입력하세요" required autoFocus />
        <label className="login-label" htmlFor="password">비밀번호</label><input className="login-input" id="password" type="password" autoComplete={pageMode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={200} placeholder="비밀번호를 입력하세요" required />
        {pageMode === "register" && <><label className="login-label" htmlFor="passwordConfirm">비밀번호 확인</label><input className="login-input" id="passwordConfirm" type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={8} maxLength={200} placeholder="비밀번호를 다시 입력하세요" required /></>}
        {message && <div className="alert error">{message}</div>}<button className="primary full login-button" disabled={submitting} type="submit">{submitting ? "처리 중..." : pageMode === "login" ? "로그인" : "회원가입"}<span>→</span></button></form><p className="login-security"><span>✓</span> 안전한 HttpOnly 쿠키로 인증됩니다</p></div></section>
    {takeoverOpen && <Modal title="다른 위치에서 로그인 중" onClose={() => setTakeoverOpen(false)} closeDisabled={takeoverSubmitting}>
      <div className="login-takeover-dialog"><span className="login-takeover-icon" aria-hidden="true">!</span><div><strong>이미 이 계정으로 접속한 곳이 있습니다.</strong><p>계속하면 기존 기기는 로그아웃되고, 실행 중이거나 시작 대기 중인 모든 방송이 종료됩니다.</p></div></div>
      {takeoverError && <div className="alert error" role="alert">{takeoverError}</div>}
      <div className="modal-actions login-takeover-actions"><button className="secondary" type="button" disabled={takeoverSubmitting} onClick={() => setTakeoverOpen(false)}>취소</button><button className="primary" type="button" disabled={takeoverSubmitting} onClick={confirmTakeover}>{takeoverSubmitting ? "기존 접속 종료 중..." : "종료하고 로그인"}</button></div>
    </Modal>}
  </main>;
}
