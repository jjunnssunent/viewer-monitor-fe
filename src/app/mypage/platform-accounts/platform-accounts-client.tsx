"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { downloadPlatformAccountTemplate } from "@/lib/platform-account-template";
import { ProtectedRoute } from "@/components/protected-route";
import { Modal } from "@/components/modal";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";

type Platform = "panda" | "soop" | "youtube";
interface PlatformAccountSummary { platform: Platform; count: number }
interface PlatformAccount { id: string; platform: Platform; accountId: string; createdAt: string; updatedAt: string }
interface PlatformAccountListResponse { items: PlatformAccount[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } }
interface ImportResult { platform: Platform; totalRows: number; createdCount: number; skippedDuplicateCount: number }
interface DeleteAllResult { platform: Platform; deletedCount: number }

const platforms: Platform[] = ["panda", "soop", "youtube"];
const platformMeta: Record<Platform, { name: string; icon: string }> = {
  panda: { name: "팬더티비", icon: "P" },
  soop: { name: "숲", icon: "S" },
  youtube: { name: "유튜브", icon: "▶" },
};
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isPlatform(value: unknown): value is Platform { return value === "panda" || value === "soop" || value === "youtube"; }
function apiErrorCode(error: ApiError) { if (!isRecord(error.data)) return undefined; if (typeof error.data.code === "string") return error.data.code; return isRecord(error.data.error) && typeof error.data.error.code === "string" ? error.data.error.code : undefined; }
function parseSummaries(value: unknown): PlatformAccountSummary[] {
  if (!Array.isArray(value)) throw new Error("플랫폼 계정 현황 응답이 올바르지 않습니다.");
  return value.map((item) => {
    if (!isRecord(item) || !isPlatform(item.platform) || typeof item.count !== "number") throw new Error("플랫폼 계정 현황 응답이 올바르지 않습니다.");
    return { platform: item.platform, count: item.count };
  });
}
function parseAccount(value: unknown): PlatformAccount {
  if (!isRecord(value) || typeof value.id !== "string" || !isPlatform(value.platform) || typeof value.accountId !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") throw new Error("플랫폼 계정 목록 응답이 올바르지 않습니다.");
  return { id: value.id, platform: value.platform, accountId: value.accountId, createdAt: value.createdAt, updatedAt: value.updatedAt };
}
function parseList(value: unknown): PlatformAccountListResponse {
  const source = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(source) || !Array.isArray(source.items) || !isRecord(source.pagination)) throw new Error("플랫폼 계정 목록 응답이 올바르지 않습니다.");
  const pagination = source.pagination;
  if (typeof pagination.page !== "number" || typeof pagination.pageSize !== "number" || typeof pagination.totalItems !== "number" || typeof pagination.totalPages !== "number") throw new Error("플랫폼 계정 페이지 정보가 올바르지 않습니다.");
  return { items: source.items.map(parseAccount), pagination: { page: pagination.page, pageSize: pagination.pageSize, totalItems: pagination.totalItems, totalPages: pagination.totalPages } };
}
function parseImport(value: unknown): ImportResult {
  if (!isRecord(value) || !isPlatform(value.platform) || typeof value.totalRows !== "number" || typeof value.createdCount !== "number" || typeof value.skippedDuplicateCount !== "number") throw new Error("업로드 결과 응답이 올바르지 않습니다.");
  return { platform: value.platform, totalRows: value.totalRows, createdCount: value.createdCount, skippedDuplicateCount: value.skippedDuplicateCount };
}
function parseDeleteAll(value: unknown): DeleteAllResult {
  if (!isRecord(value) || !isPlatform(value.platform) || typeof value.deletedCount !== "number") throw new Error("전체 삭제 응답이 올바르지 않습니다.");
  return { platform: value.platform, deletedCount: value.deletedCount };
}
function koreanDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)); }

export function MyPlatformAccounts({ initialPlatform, scope = "user" }: { initialPlatform: Platform; scope?: "user" | "admin" }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Platform>(initialPlatform);
  const [summaries, setSummaries] = useState<PlatformAccountSummary[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [pagination, setPagination] = useState<PlatformAccountListResponse["pagination"]>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformAccount | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const isAdminScope = scope === "admin";
  const apiBase = isAdminScope ? "/api/admin/platform-accounts" : "/api/users/me/platform-accounts";
  const selectedCount = summaries.find((item) => item.platform === selected)?.count ?? 0;

  const handleError = useCallback((requestError: unknown, fallback: string) => {
    if (requestError instanceof ApiError && requestError.status === 403) {
      const message = isAdminScope ? "관리자만 접근할 수 있습니다." : "일반 사용자만 이용할 수 있습니다.";
      showToast(message, "error");
      router.replace(isAdminScope ? "/monitor" : "/admin/users");
      return message;
    }
    if (requestError instanceof ApiError && requestError.status === 404) {
      const message = "계정을 찾을 수 없습니다.";
      showToast(message, "error");
      return message;
    }
    const message = requestError instanceof Error ? requestError.message : fallback;
    showToast(message, "error");
    return message;
  }, [isAdminScope, router, showToast]);

  const loadSummaries = useCallback(async () => {
    setSummaries(parseSummaries(await apiClient<unknown>(apiBase, { cache: "no-store" })));
  }, [apiBase]);
  const loadAccounts = useCallback(async (platform: Platform, requestedPage: number, requestedPageSize: number) => {
    const response = parseList(await apiClient<unknown>(`${apiBase}/${platform}?page=${requestedPage}&pageSize=${requestedPageSize}`, { cache: "no-store" }));
    setAccounts(response.items);
    setPagination(response.pagination);
  }, [apiBase]);
  const reload = useCallback(async (platform: Platform, requestedPage: number, requestedPageSize: number) => {
    await Promise.all([loadSummaries(), loadAccounts(platform, requestedPage, requestedPageSize)]);
  }, [loadAccounts, loadSummaries]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (isAdminScope && user.role !== "admin") router.replace("/monitor");
    if (!isAdminScope && user.role !== "user") router.replace("/admin/users");
  }, [authLoading, isAdminScope, router, user]);
  useEffect(() => {
    const expectedRole = isAdminScope ? "admin" : "user";
    if (authLoading || user?.role !== expectedRole) return;
    let active = true;
    Promise.all([
      apiClient<unknown>(apiBase, { cache: "no-store" }),
      apiClient<unknown>(`${apiBase}/${selected}?page=${page}&pageSize=${pageSize}`, { cache: "no-store" }),
    ]).then(([summaryValue, listValue]) => {
      if (!active) return;
      const list = parseList(listValue);
      setSummaries(parseSummaries(summaryValue));
      setAccounts(list.items);
      setPagination(list.pagination);
      setError("");
    }).catch((requestError) => { if (active) setError(handleError(requestError, "플랫폼 계정을 불러오지 못했습니다.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiBase, authLoading, handleError, isAdminScope, page, pageSize, selected, user]);

  function choosePlatform(platform: Platform) { if (platform === selected) return; setLoading(true); setPage(1); setSelected(platform); setUploadError(""); if (fileInput.current) fileInput.current.value = ""; }
  async function upload(file?: File) {
    if (!file || uploading) return;
    setUploadError("");
    if (!file.name.toLowerCase().endsWith(".xlsx")) return setUploadError(".xlsx 파일만 업로드할 수 있습니다.");
    if (file.size > MAX_FILE_SIZE) return setUploadError("5MB 이하의 엑셀 파일을 선택해주세요.");
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const imported = parseImport(await apiClient<unknown>(`${apiBase}/${selected}/import`, { method: "POST", cache: "no-store", body }));
      await reload(selected, 1, pageSize);
      setPage(1);
      setResult(imported);
      showToast(`${platformMeta[imported.platform].name} 계정 ${imported.createdCount}개를 등록했습니다. 중복 ${imported.skippedDuplicateCount}개는 제외했습니다.`, "success");
    } catch (requestError) {
      const status = requestError instanceof ApiError ? requestError.status : 0;
      setUploadError(status === 413 ? "5MB 이하의 엑셀 파일을 선택해주세요." : handleError(requestError, "엑셀 파일을 업로드하지 못했습니다."));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function drop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }

  async function removeAccount(account: PlatformAccount) {
    if (deleting.has(account.id)) return;
    setDeleting((current) => new Set(current).add(account.id));
    try {
      await apiClient(`${apiBase}/${account.platform}/${account.id}`, { method: "DELETE", cache: "no-store" });
      setDeleteTarget(null);
      const targetPage = accounts.length === 1 && page > 1 ? page - 1 : page;
      if (targetPage !== page) setPage(targetPage);
      else await reload(selected, targetPage, pageSize);
      showToast("플랫폼 계정을 삭제했습니다.", "success");
    } catch (requestError) {
      handleError(requestError, "플랫폼 계정을 삭제하지 못했습니다.");
    } finally {
      setDeleting((current) => { const next = new Set(current); next.delete(account.id); return next; });
    }
  }

  const closeDeleteAll = () => { if (!deletingAll) { setDeleteAllOpen(false); setDeleteConfirmation(""); } };
  async function removeAllAccounts() {
    if (deletingAll || deleteConfirmation !== platformMeta[selected].name) return;
    setDeletingAll(true);
    try {
      const deleted = parseDeleteAll(await apiClient<unknown>(`${apiBase}/${selected}`, { method: "DELETE", cache: "no-store", body: JSON.stringify({ confirmation: selected }) }));
      await reload(selected, 1, pageSize);
      setPage(1);
      setDeleteAllOpen(false);
      setDeleteConfirmation("");
      showToast(deleted.deletedCount ? `${platformMeta[deleted.platform].name} 계정 ${deleted.deletedCount}개를 삭제했습니다.` : "삭제할 계정이 없습니다.", deleted.deletedCount ? "success" : "info");
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 400 && apiErrorCode(requestError) === "PLATFORM_DELETE_CONFIRMATION_MISMATCH") showToast("전체 삭제 확인값이 올바르지 않습니다.", "error");
      else handleError(requestError, "플랫폼 계정을 전체 삭제하지 못했습니다.");
    } finally {
      setDeletingAll(false);
    }
  }

  const expectedRole = isAdminScope ? "admin" : "user";
  if (authLoading || user?.role !== expectedRole) return <ProtectedRoute><main className="loading-screen">플랫폼 계정을 불러오는 중입니다.</main></ProtectedRoute>;
  return <ProtectedRoute><main className={isAdminScope ? "admin-platform-accounts" : "mypage my-platform-accounts"}>
    <header className={isAdminScope ? "admin-page-head" : "account-page-head"}><div><span className="eyebrow">{isAdminScope ? "PLATFORM ACCOUNTS" : "MY PLATFORM ACCOUNTS"}</span><h1>{isAdminScope ? "플랫폼 계정 관리" : "내 플랫폼 계정"}</h1><p className="muted">{isAdminScope ? "관리자 시청 배치에서 사용할 전역 플랫폼 계정을 관리합니다." : "시청자 프로그램에서 사용할 본인의 플랫폼 계정을 관리합니다."}</p></div><div className="platform-page-head-actions"><button className="secondary" type="button" onClick={downloadPlatformAccountTemplate}>엑셀 양식 다운로드</button>{!isAdminScope && <button className="secondary" type="button" onClick={() => router.push("/mypage")}>마이페이지</button>}</div></header>

    <div className="platform-account-tabs">{platforms.map((platform) => <button type="button" className={`platform-account-tab ${platform} ${selected === platform ? "active" : ""}`} onClick={() => choosePlatform(platform)} key={platform}><span className="platform-account-icon">{platformMeta[platform].icon}</span><span><strong>{platformMeta[platform].name}</strong><small>{platform}</small></span><b>{summaries.find((item) => item.platform === platform)?.count ?? 0}개</b></button>)}</div>
    <div className="platform-danger-toolbar"><div><strong>{platformMeta[selected].name} 전체 삭제</strong><span>{isAdminScope ? "관리자 전역 계정" : "본인이 등록한 계정"} {selectedCount.toLocaleString()}개</span></div><button className="danger" type="button" disabled={!selectedCount || deletingAll} onClick={() => { setDeleteConfirmation(""); setDeleteAllOpen(true); }}>전체 삭제</button></div>

    <section className="platform-upload-card"><div><h2>{platformMeta[selected].name} 계정 업로드</h2><p>첫 시트의 A1은 <code>id</code>, B1은 <code>password</code>로 작성하고 데이터는 2행부터 입력해주세요.</p></div><label className={`platform-upload-zone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop}><span>↑</span><strong>{uploading ? "업로드 중..." : "엑셀 파일을 놓거나 클릭하세요"}</strong><small>.xlsx · 최대 5MB · 최대 1,000개</small><input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} /></label><div className="platform-upload-help">ID와 비밀번호의 앞자리 0이 유지되도록 두 열을 반드시 <strong>텍스트 형식</strong>으로 작성해주세요.</div>{uploadError && <div className="alert error">{uploadError}</div>}</section>

    {!isAdminScope && <ManualAccountRegistration key={selected} platform={selected} onComplete={async () => { setPage(1); await reload(selected, 1, pageSize); }} onError={(requestError) => handleError(requestError, "플랫폼 계정을 등록하지 못했습니다.")} />}

    <section className="management-card platform-account-list"><div className="toolbar platform-list-toolbar"><div><strong>{platformMeta[selected].name} 계정</strong><span className="muted">전체 {pagination.totalItems.toLocaleString()}개</span></div><div className="platform-list-actions"><label>페이지당<select className="page-size-select" value={pageSize} onChange={(event) => { setLoading(true); setPage(1); setPageSize(Number(event.target.value)); }}>{[10, 20, 50, 100].map((size) => <option value={size} key={size}>{size}개</option>)}</select></label><button className="secondary compact" type="button" disabled={loading} onClick={() => { setLoading(true); void reload(selected, page, pageSize).catch((requestError) => setError(handleError(requestError, "새로고침하지 못했습니다."))).finally(() => setLoading(false)); }}>새로고침</button></div></div>{error && <div className="alert error">{error}</div>}{loading ? <div className="platform-account-skeleton" aria-label="플랫폼 계정 목록을 불러오는 중">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div> : accounts.length ? <><div className="table-scroll"><table className="platform-account-table"><thead><tr><th>계정 아이디</th><th>등록일</th><th>수정일</th><th>관리</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.accountId}</strong></td><td>{koreanDate(account.createdAt)}</td><td>{koreanDate(account.updatedAt)}</td><td><button className="danger compact" type="button" disabled={deleting.has(account.id)} onClick={() => setDeleteTarget(account)}>{deleting.has(account.id) ? "삭제 중..." : "삭제"}</button></td></tr>)}</tbody></table></div><div className="platform-account-mobile">{accounts.map((account) => <article key={account.id}><div><strong>{account.accountId}</strong><small>등록 {koreanDate(account.createdAt)}<br />수정 {koreanDate(account.updatedAt)}</small></div><button className="danger compact" type="button" disabled={deleting.has(account.id)} onClick={() => setDeleteTarget(account)}>삭제</button></article>)}</div></> : <div className="platform-account-empty"><span>{platformMeta[selected].icon}</span><strong>등록된 {platformMeta[selected].name} 계정이 없습니다.</strong><p>엑셀 파일을 업로드해 계정을 등록해 주세요.</p></div>}<div className="platform-pagination"><button className="secondary compact" type="button" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }}>← 이전</button><span><strong>{pagination.totalPages ? pagination.page : 0}</strong> / {pagination.totalPages} 페이지</span><button className="secondary compact" type="button" disabled={loading || page >= pagination.totalPages} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>다음 →</button></div></section>

    {result && <Modal title="엑셀 업로드 완료" onClose={() => setResult(null)}><div className="import-result"><span className={`platform-account-icon ${result.platform}`}>{platformMeta[result.platform].icon}</span><p>총 <strong>{result.totalRows}개</strong> 중 <strong>{result.createdCount}개</strong>를 등록했습니다.<br />중복 계정 {result.skippedDuplicateCount}개는 제외했습니다.</p><button className="primary full" type="button" onClick={() => setResult(null)}>확인</button></div></Modal>}
    {deleteTarget && <Modal title={`${deleteTarget.accountId} 계정을 삭제할까요?`} onClose={() => { if (!deleting.has(deleteTarget.id)) setDeleteTarget(null); }} closeDisabled={deleting.has(deleteTarget.id)}><div className="delete-account-dialog"><p><strong>{deleteTarget.accountId}</strong> 계정을 삭제합니다.<br />삭제한 계정은 복구할 수 없습니다.</p><div className="modal-actions"><button className="secondary" type="button" disabled={deleting.has(deleteTarget.id)} onClick={() => setDeleteTarget(null)}>취소</button><button className="danger" type="button" disabled={deleting.has(deleteTarget.id)} onClick={() => void removeAccount(deleteTarget)}>{deleting.has(deleteTarget.id) ? "삭제 중..." : "삭제"}</button></div></div></Modal>}
    {deleteAllOpen && <Modal title={`${platformMeta[selected].name} 계정을 모두 삭제할까요?`} onClose={closeDeleteAll} closeDisabled={deletingAll}><div className="delete-all-dialog"><div className="delete-all-warning"><span>!</span><p>{isAdminScope ? "관리자가 등록한 전역" : "본인이 등록한"} <strong>{platformMeta[selected].name} 계정 {selectedCount.toLocaleString()}개</strong>가 모두 삭제됩니다.<br />{isAdminScope ? "사용자 개인 계정에는 영향을 주지 않습니다." : "다른 사용자의 계정에는 영향을 주지 않습니다."} 이 작업은 되돌릴 수 없습니다.</p></div><label>확인을 위해 <strong>{platformMeta[selected].name}</strong>을 입력해주세요.<input autoFocus value={deleteConfirmation} disabled={deletingAll} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={platformMeta[selected].name} autoComplete="off" /></label><div className="modal-actions"><button className="secondary" type="button" disabled={deletingAll} onClick={closeDeleteAll}>취소</button><button className="danger delete-all-submit" type="button" disabled={deletingAll || deleteConfirmation !== platformMeta[selected].name} onClick={() => void removeAllAccounts()}>{deletingAll && <span className="button-spinner" />}{deletingAll ? "전체 삭제 중..." : "전체 삭제"}</button></div></div></Modal>}
  </main></ProtectedRoute>;
}

type ManualAccountRow = { key: number; accountId: string; password: string };

function ManualAccountRegistration({ platform, onComplete, onError }: { platform: Platform; onComplete: () => Promise<void>; onError: (error: unknown) => string }) {
  const { showToast } = useToast();
  const nextKey = useRef(2);
  const rowElements = useRef(new Map<number, HTMLDivElement>());
  const accountInputs = useRef(new Map<number, HTMLInputElement>());
  const passwordInputs = useRef(new Map<number, HTMLInputElement>());
  const [rows, setRows] = useState<ManualAccountRow[]>([{ key: 1, accountId: "", password: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [invalidRowKey, setInvalidRowKey] = useState<number | null>(null);
  const [error, setError] = useState("");

  function addRow() {
    if (rows.length >= 1000) return showToast("계정은 한 번에 최대 1,000개까지 입력할 수 있습니다.", "error");
    const key = nextKey.current++;
    setRows((current) => [...current, { key, accountId: "", password: "" }]);
    window.setTimeout(() => accountInputs.current.get(key)?.focus(), 0);
  }
  function removeRow(key: number) {
    setRows((current) => current.length === 1 ? [{ key: current[0].key, accountId: "", password: "" }] : current.filter((row) => row.key !== key));
    if (invalidRowKey === key) setInvalidRowKey(null);
  }
  function updateRow(key: number, field: "accountId" | "password", value: string) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
    if (invalidRowKey === key) { setInvalidRowKey(null); setError(""); }
  }
  function moveToInvalidRow(row: ManualAccountRow) {
    setInvalidRowKey(row.key);
    setError("모든 계정의 아이디와 비밀번호를 입력해주세요.");
    window.requestAnimationFrame(() => {
      rowElements.current.get(row.key)?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => (row.accountId.trim() ? passwordInputs : accountInputs).current.get(row.key)?.focus(), 280);
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const invalid = rows.find((row) => !row.accountId.trim() || !row.password);
    if (invalid) return moveToInvalidRow(invalid);
    setSubmitting(true); setError("");
    try {
      const registered = parseImport(await apiClient<unknown>(`/api/users/me/platform-accounts/${platform}`, { method: "POST", cache: "no-store", body: JSON.stringify({ accounts: rows.map((row) => ({ accountId: row.accountId.trim(), password: row.password })) }) }));
      await onComplete();
      setRows([{ key: nextKey.current++, accountId: "", password: "" }]);
      setInvalidRowKey(null);
      showToast(registered.skippedDuplicateCount ? `이미 등록된 계정 ${registered.skippedDuplicateCount}개를 제외하고 ${registered.createdCount}개가 등록되었습니다.` : `${platformMeta[registered.platform].name} 계정 ${registered.createdCount}개를 등록했습니다.`, "success");
    } catch (requestError) { setError(onError(requestError)); }
    finally { setSubmitting(false); }
  }

  return <section className="platform-manual-card"><div className="platform-manual-head"><div><span className={`platform-account-icon ${platform}`}>{platformMeta[platform].icon}</span><div><h2>{platformMeta[platform].name} 계정 직접 등록</h2><p>아이디와 비밀번호를 입력해 최대 1,000개까지 한 번에 등록할 수 있습니다.</p></div></div><button className="secondary compact" type="button" disabled={submitting || rows.length >= 1000} onClick={addRow}>+ 계정 행 추가</button></div><form onSubmit={submit}><div className="manual-account-columns" aria-hidden="true"><span>아이디</span><span>비밀번호</span><span>관리</span></div><div className="manual-account-rows">{rows.map((row, index) => <div ref={(element) => { if (element) rowElements.current.set(row.key, element); else rowElements.current.delete(row.key); }} className={`manual-account-row ${invalidRowKey === row.key ? "invalid" : ""}`} key={row.key}><span className="manual-row-number">{index + 1}</span><label><span>아이디</span><input ref={(element) => { if (element) accountInputs.current.set(row.key, element); else accountInputs.current.delete(row.key); }} type="text" value={row.accountId} disabled={submitting} onChange={(event) => updateRow(row.key, "accountId", event.target.value)} autoComplete="off" placeholder="플랫폼 계정 아이디" /></label><label><span>비밀번호</span><input ref={(element) => { if (element) passwordInputs.current.set(row.key, element); else passwordInputs.current.delete(row.key); }} type="password" value={row.password} disabled={submitting} onChange={(event) => updateRow(row.key, "password", event.target.value)} autoComplete="new-password" placeholder="플랫폼 계정 비밀번호" /></label><button className="danger compact" type="button" disabled={submitting} onClick={() => removeRow(row.key)} aria-label={`${index + 1}번 계정 행 삭제`}>삭제</button></div>)}</div>{error && <div className="alert error">{error}</div>}<div className="platform-manual-footer"><span>{rows.length.toLocaleString()} / 1,000개 입력</span><button className="primary" type="submit" disabled={submitting}>{submitting ? <><span className="button-spinner" />등록 중...</> : "전체 등록"}</button></div></form></section>;
}
