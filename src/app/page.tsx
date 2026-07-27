"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { useToast } from "@/components/toast-provider";
import { navigationByRole } from "@/lib/navigation";
import type { PlatformId } from "@/lib/types";

type Platform = {
  id: PlatformId;
  name: string;
  status: "available" | "coming_soon";
  description: string;
};

type Session = {
  sessionId: string;
  platform: Platform["id"];
  mode: "account" | "guest";
  accountSource?: "personal" | "shared";
  accountLabel: string;
  broadcastUrl: string;
  status: string;
  message: string;
};

type ViewingMode = "personal" | "shared" | "guest";
type AccountSummary = { platform: PlatformId; count: number };
const PER_INTERVAL = 1;
const intervalOptions = [{ value: 10, label: "10초" }, { value: 20, label: "20초" }, { value: 30, label: "30초" }, { value: 40, label: "40초" }, { value: 50, label: "50초" }, { value: 60, label: "1분" }, { value: 120, label: "2분" }, { value: 180, label: "3분" }, { value: 240, label: "4분" }, { value: 300, label: "5분" }, { value: 600, label: "10분" }];
const guestTotalOptions = [{ value: 10, label: "10개" }, { value: 20, label: "20개" }, { value: 30, label: "30개" }];
const platformIcons: Record<string, string> = { panda: "P", soop: "S", youtube: "▶" };
const platformNames: Record<PlatformId, string> = { panda: "팬더티비", soop: "숲", youtube: "유튜브" };
const technicalErrorPattern = /locator\.evaluate|AbortError|play\(\) request was interrupted|Execution context was destroyed|Timeout|headless_shell|chrome-linux/i;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isPlatformId(value: unknown): value is PlatformId { return value === "panda" || value === "soop" || value === "youtube"; }
function errorValue(data: unknown, key: string): unknown { if (!isRecord(data)) return undefined; if (key in data) return data[key]; if (isRecord(data.details) && key in data.details) return data.details[key]; if (isRecord(data.error)) { if (key in data.error) return data.error[key]; if (isRecord(data.error.details) && key in data.error.details) return data.error.details[key]; } return undefined; }
function errorCode(data: unknown) { const code = errorValue(data, "code"); if (typeof code === "string") return code; if (isRecord(data) && typeof data.error === "string") return data.error; return undefined; }
function parseAccountSummaries(value: unknown): AccountSummary[] {
  if (!Array.isArray(value)) throw new Error("플랫폼 계정 수 응답이 올바르지 않습니다.");
  return value.map((item) => {
    if (!isRecord(item) || !isPlatformId(item.platform) || typeof item.count !== "number") throw new Error("플랫폼 계정 수 응답이 올바르지 않습니다.");
    return { platform: item.platform, count: item.count };
  });
}

function canUseViewer(user: { role: "admin" | "user"; usageExpiresAt?: string }) {
  if (user.role === "admin") return true;
  return Boolean(user.usageExpiresAt) && new Date(user.usageExpiresAt!).getTime() > Date.now();
}

export function MonitorDashboard({ embeddedInAdmin = false }: { embeddedInAdmin?: boolean }) {
  const { user, logout, setAuthenticatedUser } = useAuth();
  const { showToast } = useToast();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform["id"]>("panda");
  const [mode, setMode] = useState<ViewingMode>("personal");
  const [broadcastUrl, setBroadcastUrl] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [totalCount, setTotalCount] = useState(10);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [loadedSummaryKey, setLoadedSummaryKey] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [startMessage, setStartMessage] = useState("");
  const [showMypageAction, setShowMypageAction] = useState(false);
  const [accountRegistrationPlatform, setAccountRegistrationPlatform] = useState<PlatformId | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [accountBatchLocked, setAccountBatchLocked] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [stoppingSessions, setStoppingSessions] = useState<Set<string>>(new Set());
  const [retryingSessions, setRetryingSessions] = useState<Set<string>>(new Set());
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingStartedAt, setOpeningStartedAt] = useState<Record<string, number>>({});

  const selected = platforms.find((platform) => platform.id === selectedPlatform);
  const viewingMode: ViewingMode = user?.role === "admin" && mode === "personal" ? "shared" : mode;
  const summaryKey = viewingMode === "personal" ? "personal" : viewingMode === "shared" ? "shared" : "";
  const summaryLoading = viewingMode !== "guest" && loadedSummaryKey !== summaryKey;
  const platformUnavailable = selectedPlatform !== "panda";
  const availableAccountCount = accountSummaries.find((item) => item.platform === selectedPlatform)?.count ?? 0;
  const isAccountMode = viewingMode !== "guest";
  const totalOptions = isAccountMode
    ? Array.from({ length: availableAccountCount }, (_, index) => ({ value: index + 1, label: `${index + 1}개` }))
    : guestTotalOptions;
  const valuesValid = intervalOptions.some((option) => option.value === intervalSeconds) && totalOptions.some((option) => option.value === totalCount);
  const accountCountInsufficient = isAccountMode && !summaryLoading && totalCount > availableAccountCount;
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.status !== "stopped"),
    [sessions],
  );
  const stoppableSessions = useMemo(
    () => sessions.filter((session) => session.status !== "stopped"),
    [sessions],
  );

  const handleApiError = useCallback((error: unknown, fallback: string) => {
    const code = error instanceof ApiError ? errorCode(error.data) : undefined;
    const message = error instanceof ApiError && error.status === 403 && code === "BROADCAST_LINK_NOT_ALLOWED"
      ? "이 계정에 허용되지 않은 방송 링크입니다."
      : error instanceof Error ? error.message : fallback;
    setErrorMessage(message);
    return message;
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await apiClient<Session[]>("/api/viewers", { cache: "no-store" });
      const nextSessions = response.filter((session) => session.status !== "stopped");
      if (nextSessions.some((session) => session.mode === "account")) setAccountBatchLocked(true);
      setOpeningStartedAt((current) => { const next: Record<string, number> = {}; const now = Date.now(); for (const session of nextSessions) if (session.status === "opening_broadcast") next[session.sessionId] = current[session.sessionId] ?? now; return next; });
      setSessions(nextSessions);
    } catch (error) {
      handleApiError(error, "세션을 불러오지 못했습니다.");
    }
  }, [handleApiError]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const platformList = await apiClient<Platform[]>("/api/platforms", { cache: "no-store" });
        if (!mounted) return;
        setPlatforms(platformList);
        const initial = platformList.find((platform) => platform.id === "panda") ?? platformList[0];
        if (initial) {
          setSelectedPlatform(initial.id);
          setBroadcastUrl("");
        }
        await refreshSessions();
      } catch (error) {
        if (mounted) handleApiError(error, "초기 정보를 불러오지 못했습니다.");
      }
    }
    void initialize();
    return () => {
      mounted = false;
    };
  }, [handleApiError, refreshSessions]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => void refreshSessions(), 3000);
    return () => window.clearInterval(timer);
  }, [refreshSessions, user]);

  useEffect(() => {
    if (!user || viewingMode === "guest" || (viewingMode === "personal" && user.role !== "user")) return;
    let active = true;
    const path = viewingMode === "personal" ? "/api/users/me/platform-accounts" : "/api/viewers/shared-accounts/summary";
    apiClient<unknown>(path, { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        const summaries = parseAccountSummaries(response);
        const selectedCount = summaries.find((item) => item.platform === selectedPlatform)?.count ?? 0;
        setAccountSummaries(summaries);
        if (selectedCount > 0) setTotalCount((current) => Math.min(current, selectedCount));
        setLoadedSummaryKey(viewingMode);
      })
      .catch((error) => {
        if (!active) return;
        setAccountSummaries([]);
        setLoadedSummaryKey(viewingMode);
        showToast(error instanceof Error ? error.message : "플랫폼 계정 수를 불러오지 못했습니다.", "error");
      });
    return () => { active = false; };
  }, [selectedPlatform, showToast, user, viewingMode]);

  function choosePlatform(platform: Platform) {
    setSelectedPlatform(platform.id);
    setBroadcastUrl(user?.role === "admin" ? localStorage.getItem(`lastBroadcastUrl:${platform.id}`) ?? "" : "");
    setStartMessage("");
    setShowMypageAction(false);
    setAccountRegistrationPlatform(null);
    if (platform.id !== "panda") {
      showToast("개발 예정입니다.");
    }
  }

  async function startWatching() {
    if (!user || !canUseViewer(user)) {
      setStartMessage("이용기간이 만료되었거나 아직 결제가 완료되지 않았습니다.");
      return;
    }
    if (isAccountMode && accountBatchLocked) { setStartMessage("계정 로그인 시청이 이미 실행 중입니다. 전체 종료 후 다시 시작해주세요."); return; }
    if (platformUnavailable) { showToast("개발 예정입니다."); return; }
    if (!valuesValid) {
      setStartMessage("실행 간격과 실행 개수를 다시 선택해주세요.");
      return;
    }
    if (accountCountInsufficient) {
      setStartMessage(viewingMode === "personal" ? `내 ${platformNames[selectedPlatform]} 계정은 ${availableAccountCount}개만 등록되어 있습니다.` : `사용 가능한 ${platformNames[selectedPlatform]} 공용 계정은 ${availableAccountCount}개입니다.`);
      return;
    }
    if (user.role === "admin" && !broadcastUrl.trim()) {
      setStartMessage("방송 주소를 입력해주세요.");
      return;
    }
    setShowMypageAction(false);
    setAccountRegistrationPlatform(null);
    setStarting(true);
    setStartMessage(isAccountMode ? "첫 계정 그룹을 실행하고 있습니다." : "비로그인 브라우저를 실행하고 있습니다.");
    try {
      const common = { platform: selectedPlatform, intervalSeconds, ...(user.role === "admin" ? { broadcastUrl: broadcastUrl.trim() } : {}) };
      const path = viewingMode === "personal" ? "/api/viewers/stored-accounts/batch" : viewingMode === "shared" ? "/api/viewers/shared-accounts/batch" : "/api/viewers/guest";
      const body = isAccountMode ? { ...common, accountsPerInterval: PER_INTERVAL, totalAccounts: totalCount } : { ...common, viewersPerInterval: PER_INTERVAL, totalViewers: totalCount };
      await apiClient(path, { method: "POST", cache: "no-store", body: JSON.stringify(body) });
      if (isAccountMode) setAccountBatchLocked(true);
      setStartMessage(`1개를 즉시 시작하고 이후 ${intervalLabel(intervalSeconds)}마다 1개씩 추가합니다.`);
      if (user.role === "admin") localStorage.setItem(`lastBroadcastUrl:${selectedPlatform}`, broadcastUrl.trim());
      await refreshSessions();
    } catch (error) {
      const code = error instanceof ApiError ? errorCode(error.data) : undefined;
      if (error instanceof ApiError && error.status === 403 && code === "USAGE_PERIOD_EXPIRED") {
        const expiresAt = errorValue(error.data, "usageExpiresAt"); if (user.role === "user" && typeof expiresAt === "string") setAuthenticatedUser({ ...user, usageExpiresAt: expiresAt });
        const message = error.message || "이용기간이 만료되어 시청자 프로그램을 사용할 수 없습니다."; setStartMessage(""); showToast(message, "error");
      } else if (error instanceof ApiError && error.status === 400 && code === "BROADCAST_LINK_REQUIRED") {
        const message = "선택한 플랫폼의 방송 링크가 없습니다. 마이페이지에서 먼저 등록해 주세요."; setStartMessage(message); setShowMypageAction(user.role === "user"); showToast(message, "error");
      } else if (error instanceof ApiError && error.status === 409 && code === "NOT_ENOUGH_PLATFORM_ACCOUNTS") {
        const requested = errorValue(error.data, "requestedCount"); const available = errorValue(error.data, "availableCount"); const platform = errorValue(error.data, "platform");
        const accountSource = errorValue(error.data, "accountSource");
        const targetPlatform = isPlatformId(platform) ? platform : selectedPlatform;
        const count = typeof available === "number" ? available : 0;
        const source = accountSource === "personal" || accountSource === "shared" ? accountSource : viewingMode;
        const message = source === "personal" ? `내 ${platformNames[targetPlatform]} 계정은 ${count}개만 등록되어 있습니다.` : source === "shared" ? `사용 가능한 ${platformNames[targetPlatform]} 공용 계정은 ${count}개입니다.` : error.message || (typeof requested === "number" ? `${requested}개 요청을 처리할 계정이 부족합니다.` : "등록된 플랫폼 계정 수가 요청 수보다 적습니다.");
        setStartMessage(message);
        setAccountRegistrationPlatform(user.role === "user" && source === "personal" ? targetPlatform : null);
        showToast(message, "error");
      } else if (error instanceof ApiError && error.status === 409 && code === "ACTIVE_ACCOUNT_BATCH_EXISTS") {
        setAccountBatchLocked(true);
        const message = error.message || "계정 로그인 시청이 이미 실행 중입니다. 전체 종료 후 다시 시작해주세요.";
        setStartMessage(message);
        showToast(message, "error");
      } else setStartMessage(handleApiError(error, "방송을 시작하지 못했습니다."));
    } finally {
      setStarting(false);
    }
  }

  async function stopSession(sessionId: string) {
    if (stoppingSessions.has(sessionId)) return;
    setStoppingSessions((current) => new Set(current).add(sessionId));
    try {
      await apiClient(`/api/viewers/${sessionId}`, { method: "DELETE", cache: "no-store" });
      setSessions((current) => current.filter((session) => session.sessionId !== sessionId));
      setOpeningStartedAt((current) => { const next = { ...current }; delete next[sessionId]; return next; });
      showToast("시청을 종료했습니다.", "success");
    } catch (error) {
      showToast(handleApiError(error, "종료하지 못했습니다."), "error");
    } finally {
      setStoppingSessions((current) => {
        const next = new Set(current); next.delete(sessionId); return next;
      });
    }
  }

  async function stopAll() {
    if (stoppingAll) return;
    setStoppingAll(true);
    try {
      const results = await Promise.allSettled(stoppableSessions.map(async (session) => { await apiClient(`/api/viewers/${session.sessionId}`, { method: "DELETE", cache: "no-store" }); setSessions((current) => current.filter((item) => item.sessionId !== session.sessionId)); setOpeningStartedAt((current) => { const next = { ...current }; delete next[session.sessionId]; return next; }); }));
      const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failure) showToast(handleApiError(failure.reason, "일부 세션을 종료하지 못했습니다."), "error");
      else { setAccountBatchLocked(false); showToast("전체 시청을 종료했습니다.", "success"); }
      await refreshSessions();
    } finally {
      setStoppingAll(false);
    }
  }

  async function retrySession(session: Session) {
    if (!user || retryingSessions.has(session.sessionId)) return;
    setRetryingSessions((current) => new Set(current).add(session.sessionId));
    try {
      await apiClient(`/api/viewers/${session.sessionId}`, { method: "DELETE", cache: "no-store" });
      setSessions((current) => current.filter((item) => item.sessionId !== session.sessionId));
      setOpeningStartedAt((current) => { const next = { ...current }; delete next[session.sessionId]; return next; });
      const body = { platform: session.platform, intervalSeconds: 1, viewersPerInterval: 1, totalViewers: 1, ...(user.role === "admin" ? { broadcastUrl: session.broadcastUrl || broadcastUrl.trim() } : {}) };
      await apiClient("/api/viewers/guest", { method: "POST", cache: "no-store", body: JSON.stringify(body) });
      showToast("비로그인 시청을 다시 시작했습니다.", "success");
      await refreshSessions();
    } catch (error) {
      showToast(handleApiError(error, "다시 시도하지 못했습니다."), "error");
    } finally {
      setRetryingSessions((current) => { const next = new Set(current); next.delete(session.sessionId); return next; });
    }
  }

  return (
    <ProtectedRoute><main className="app-shell monitor-dashboard">
      <header className="topbar">
        <div>
          <span className="eyebrow">STREAMPULSE CONTROL ROOM</span>
          <h1>시청자 프로그램</h1>
          <p className="lead">플랫폼과 시청 방식을 선택해 독립된 방송 화면을 관리합니다.</p>
        </div>
        {user?.role === "admin" && !embeddedInAdmin && <div className="user-menu">
          <span className="account-summary"><strong>{user.username}</strong></span>
          <nav className="role-navigation" aria-label="주요 메뉴">
            {(user ? navigationByRole[user.role] : []).map((item) => <Link className="button-link compact" href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
          <button className="secondary compact" disabled={loggingOut} type="button" onClick={() => { if (loggingOut) return; setLoggingOut(true); void logout().finally(() => setLoggingOut(false)); }}>{loggingOut ? "로그아웃 중..." : "로그아웃"}</button>
        </div>}
      </header>

      {errorMessage && <div className="alert error">{errorMessage}</div>}

      <div className="monitor-control-grid">
      <section className="monitor-control-panel">
        <h2><span className="step">1</span>플랫폼 선택</h2>
        <div className="platforms">
          {platforms.map((platform) => (
            <button
              type="button"
              key={platform.id}
              className={`platform-card ${selectedPlatform === platform.id ? "active" : ""}`}
              onClick={() => choosePlatform(platform)}
            >
              <span className="platform-logo">{platformIcons[platform.id]}</span>
              <span>
                <strong className="platform-name">{platform.name}</strong>
                <span className="platform-description">{platform.description}</span>
              </span>
              <span className={`badge ${platform.status}`}>
                {platform.status === "available" ? "사용 가능" : "준비 중"}
              </span>
            </button>
          ))}
        </div>
      </section>

          <section className="monitor-control-panel">
            <h2><span className="step">2</span>시청 방식</h2>
            <div className="modes viewing-mode-grid">
              {user?.role === "user" && <button type="button" className={`mode-card personal-mode-card ${viewingMode === "personal" ? "active" : ""}`} onClick={() => { setMode("personal"); setStartMessage(""); setAccountRegistrationPlatform(null); }}>
                <i>MY</i><strong>내 계정 로그인 시청</strong><span>내가 직접 등록한 플랫폼 계정으로 방송에 입장합니다.</span><small>마이페이지에 등록한 계정을 사용합니다.</small>
              </button>}
              <button type="button" className={`mode-card ${viewingMode === "shared" ? "active" : ""}`} onClick={() => { setMode("shared"); setStartMessage(""); setAccountRegistrationPlatform(null); }}>
                <i>SH</i><strong>공용 계정 로그인 시청</strong><span>관리자가 등록한 공용 플랫폼 계정으로 방송에 입장합니다.</span><small>공용 계정은 여러 사용자가 함께 사용할 수 있습니다.</small>
              </button>
              <button type="button" className={`mode-card ${viewingMode === "guest" ? "active" : ""}`} onClick={() => { setMode("guest"); setTotalCount((current) => guestTotalOptions.some((option) => option.value === current) ? current : 10); setStartMessage(""); setAccountRegistrationPlatform(null); }}>
                <i>GU</i><strong>비로그인 시청</strong><span>플랫폼 계정에 로그인하지 않고 게스트로 방송에 입장합니다. 방송이 19세로 변경되면 시청이 종료될 수 있습니다.</span>
              </button>
            </div>
            {user?.role === "user" && viewingMode === "personal" && !summaryLoading && availableAccountCount === 0 && <div className="mode-account-registration"><span>등록된 {platformNames[selectedPlatform]} 계정이 없습니다.</span><Link className="button-link primary compact" href={`/mypage/platform-accounts?platform=${selectedPlatform}`}>내 계정 등록하기</Link></div>}
          </section>

            <section className="card monitor-start-panel">
              <h2><span className="step">3</span>방송 시작 설정</h2>
              {platformUnavailable ? <div className="monitor-coming-soon"><span className={`platform-logo ${selectedPlatform}`}>{platformIcons[selectedPlatform]}</span><strong>{selected?.name ?? platformNames[selectedPlatform]}</strong><p>개발 예정입니다.<br />플랫폼 어댑터가 준비되면 사용할 수 있습니다.</p></div> : <>
              <p className="muted">{isAccountMode ? "등록된 플랫폼 계정을 실행 간격에 맞춰 순차적으로 시작합니다." : "비로그인 시청 화면을 실행 간격에 맞춰 순차적으로 시작합니다."}</p>
              {user?.role === "admin" && <label className="field-label">방송 주소<input className="field" type="url" value={broadcastUrl} onChange={(event) => setBroadcastUrl(event.target.value)} placeholder="방송 URL을 입력하세요" /></label>}
              {user?.role === "user" && !canUseViewer(user) && <div className="usage-expired-panel"><strong>이용기간이 만료되었거나 아직 결제가 완료되지 않았습니다.</strong><span>이용권 결제가 완료되면 시청자 프로그램을 사용할 수 있습니다.</span><button className="secondary" type="button" onClick={() => showToast("결제 기능은 준비 중입니다.")}>이용권 결제하기</button></div>}
              {isAccountMode && <div className={`account-availability ${availableAccountCount ? "available" : "empty"}`}><strong>{summaryLoading ? "계정 수 확인 중..." : viewingMode === "personal" ? `사용 가능한 내 계정 ${availableAccountCount}개` : `사용 가능한 공용 계정 ${availableAccountCount}개`}</strong>{!summaryLoading && availableAccountCount === 0 && <span>{viewingMode === "personal" ? `등록된 ${platformNames[selectedPlatform]} 계정이 없습니다.` : `관리자가 등록한 ${platformNames[selectedPlatform]} 공용 계정이 없습니다.`}</span>}{viewingMode === "personal" && !summaryLoading && availableAccountCount === 0 && <Link className="button-link secondary compact" href={`/mypage/platform-accounts?platform=${selectedPlatform}`}>내 계정 등록하기</Link>}</div>}
              <div className="viewer-start-fields"><CustomSelect label="실행 간격" value={intervalSeconds} options={intervalOptions} onChange={setIntervalSeconds} /><CustomSelect label={isAccountMode ? "전체 실행 계정 수" : "전체 실행 시청 수"} value={totalCount} options={totalOptions} onChange={setTotalCount} /></div>
              <div className={`execution-preview ${valuesValid && !accountCountInsufficient ? "" : "invalid"}`}>{!valuesValid ? isAccountMode && availableAccountCount === 0 ? "등록된 계정이 없어 실행할 수 없습니다." : "전체 실행 개수를 선택해주세요." : accountCountInsufficient ? `${totalCount}개 실행에 필요한 계정이 부족합니다.` : `1개를 즉시 시작하고 이후 ${intervalLabel(intervalSeconds)}마다 1개씩 추가합니다.`}</div>
              {isAccountMode && accountBatchLocked && <div className="alert warning">계정 로그인 시청이 이미 실행 중입니다. 새로운 시청은 전체 종료 후 시작할 수 있습니다.</div>}
              <button
                className="primary full"
                type="button"
                disabled={starting || (isAccountMode && accountBatchLocked) || platformUnavailable || !user || !canUseViewer(user) || !valuesValid || (isAccountMode && summaryLoading) || accountCountInsufficient || (user.role === "admin" && !broadcastUrl.trim())}
                onClick={() => void startWatching()}
              >
                {starting ? "시작 중..." : viewingMode === "personal" ? "내 계정 로그인 시청 시작" : viewingMode === "shared" ? "공용 계정 로그인 시청 시작" : "비로그인 시청 시작"}
              </button>
              <div className="notice">{startMessage}</div>
              {showMypageAction && <Link className="button-link secondary full monitor-mypage-link" href="/mypage">마이페이지로 이동</Link>}
              {accountRegistrationPlatform && <Link className="button-link secondary full monitor-mypage-link" href={`/mypage/platform-accounts?platform=${accountRegistrationPlatform}`}>계정 등록하기</Link>}
              </>}
            </section>
      </div>

          <section className="sessions-section">
            <div className="section-head">
              <div><h2>시청 현황</h2><span className="muted">방송 종료 시 브라우저와 세션을 자동으로 정리합니다.</span></div>
              <button className="secondary" type="button" disabled={!stoppableSessions.length || stoppingAll} onClick={() => void stopAll()}>{stoppingAll ? "종료 중..." : "전체 종료"}</button>
            </div>
            <div className="sessions">
              {visibleSessions.length ? visibleSessions.map((session) => { const displayMessage = sessionDisplayMessage(session, openingStartedAt[session.sessionId]); const technicalError = session.status === "error" && technicalErrorPattern.test(session.message); return (
                <article className={`session ${session.status}`} key={session.sessionId}>
                  <div className="session-title"><span className={`status-dot ${session.status}`} /><span>{platforms.find((platform) => platform.id === session.platform)?.name} · {sessionSourceLabel(session)} · {session.accountLabel} · {statusLabel(session.status)}</span></div>
                  <div className="session-message">{displayMessage}{technicalError && process.env.NODE_ENV === "development" && <details className="session-error-detail"><summary>상세 오류 보기</summary><pre>{session.message}</pre></details>}</div>
                  <div className="session-actions">{session.status === "error" && <button className="secondary" type="button" disabled={retryingSessions.has(session.sessionId) || stoppingSessions.has(session.sessionId)} onClick={() => void retrySession(session)}>{retryingSessions.has(session.sessionId) ? "재시도 중..." : "다시 시도"}</button>}<button className="danger" type="button" disabled={stoppingSessions.has(session.sessionId) || retryingSessions.has(session.sessionId) || session.status === "stopped"} onClick={() => void stopSession(session.sessionId)}>{stoppingSessions.has(session.sessionId) ? "처리 중..." : session.status === "ended" ? "정리" : session.status === "stopped" ? "종료됨" : "종료"}</button></div>
                </article>
              ); }) : <div className="session-empty">실행 중인 화면이 없습니다.</div>}
            </div>
          </section>

    </main></ProtectedRoute>
  );
}

export default function DashboardPage() {
  return <MonitorDashboard />;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "시작 대기",
    launching: "브라우저 실행 중",
    signing_in: "로그인 중",
    manual_auth: "확인 필요",
    opening_broadcast: "방송 입장 중",
    watching: "입장 완료",
    ended: "방송 종료",
    error: "오류",
    stopped: "종료됨",
  };
  return labels[status] ?? status;
}

function intervalLabel(seconds: number) {
  return intervalOptions.find((option) => option.value === seconds)?.label ?? `${seconds}초`;
}

function sessionSourceLabel(session: Session) {
  if (session.mode === "guest") return "비로그인";
  return session.accountSource === "personal" ? "내 계정" : "공용 계정";
}

function CustomSelect({ label, value, options, onChange }: { label: string; value: number; options: Array<{ value: number; label: string }>; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "선택해주세요";
  return <div className="custom-select-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}><span className="field-label">{label}</span><button className={`custom-select-trigger ${open ? "open" : ""}`} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><strong>{selectedLabel}</strong><span>⌄</span></button>{open && <div className="custom-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button className={option.value === value ? "selected" : ""} type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <b>✓</b>}</button>)}</div>}</div>;
}

function sessionDisplayMessage(session: Session, openingStartedAt?: number) {
  if (session.status === "opening_broadcast") {
    const elapsed = openingStartedAt ? Date.now() - openingStartedAt : 0;
    if (elapsed >= 90_000) return "방송 입장이 지연되고 있습니다. 종료 후 다시 시도해 주세요.";
    if (elapsed >= 30_000) return "방송 페이지가 다시 로딩되어 재생을 재시도하고 있습니다.";
    return "방송에 입장하고 있습니다.";
  }
  if (session.status === "watching") return technicalErrorPattern.test(session.message) ? "방송 입장이 완료되었습니다." : session.message;
  if (technicalErrorPattern.test(session.message)) return "방송 입장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  return session.message;
}
