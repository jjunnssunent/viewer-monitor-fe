"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/admin-api";
import { parseUserPayments } from "@/lib/payment-api";
import type { PaymentType, UserPayment } from "@/lib/types";
import { Modal } from "./modal";
import { useToast } from "./toast-provider";

const paymentTypeOptions: Array<{ value: PaymentType; label: string }> = [
  { value: "card", label: "카드" },
  { value: "bank_transfer", label: "계좌이체" },
  { value: "cash", label: "현금" },
  { value: "virtual_account", label: "가상계좌" },
  { value: "other", label: "기타" },
];
const bankNames = ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크"];
type PaymentFormValue = { amount: string; paymentType: PaymentType; bankName: string; paidAt: string; memo: string };

function localDateTimeValue(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function emptyPayment(): PaymentFormValue { return { amount: "", paymentType: "card", bankName: "", paidAt: localDateTimeValue(), memo: "" }; }
function paymentFormValue(payment: UserPayment): PaymentFormValue { return { amount: String(payment.amount), paymentType: payment.paymentType, bankName: payment.bankName ?? "", paidAt: localDateTimeValue(new Date(payment.paidAt)), memo: payment.memo ?? "" }; }
function paymentTypeLabel(type: PaymentType) { return paymentTypeOptions.find((option) => option.value === type)?.label ?? type; }

export function AdminUserPayments({ userId }: { userId: string }) {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<UserPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserPayment | "create" | null>(null);
  const [deleting, setDeleting] = useState<UserPayment | null>(null);

  const loadPayments = useCallback(async () => {
    try {
      const response = await apiClient<unknown>(`/api/admin/users/${userId}/payments`, { cache: "no-store" });
      setPayments(parseUserPayments(response));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "결제 내역을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPayments(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPayments]);
  useEffect(() => {
    if (window.location.hash !== "#payments") return;
    const timer = window.setTimeout(() => document.getElementById("payments")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => window.clearTimeout(timer);
  }, []);
  const totalAmount = useMemo(() => payments.reduce((total, payment) => total + payment.amount, 0), [payments]);

  return <section className="admin-detail-card admin-payment-card" id="payments">
    <div className="payment-section-head"><div className="mypage-title"><span>05</span><div><h2>결제 내역 관리</h2><p>등록된 결제 내역과 누적 결제 금액을 관리합니다.</p></div></div><button className="primary compact" type="button" onClick={() => setEditing("create")}>결제 등록</button></div>
    <div className="payment-total"><span>총 결제 금액</span><strong>{totalAmount.toLocaleString("ko-KR")}원</strong><small>총 {payments.length.toLocaleString("ko-KR")}건</small></div>
    {loading ? <div className="payment-empty">결제 내역을 불러오는 중입니다.</div> : payments.length ? <div className="payment-list">{payments.map((payment) => <article key={payment.id}><div className="payment-main"><span className={`payment-type ${payment.paymentType}`}>{paymentTypeLabel(payment.paymentType)}</span><strong>{payment.amount.toLocaleString("ko-KR")}원</strong><time>{formatDate(payment.paidAt)}</time></div><div className="payment-meta"><span>은행 <strong>{payment.bankName || "-"}</strong></span><span>메모 <strong>{payment.memo || "-"}</strong></span></div><div className="payment-actions"><button className="secondary compact" type="button" onClick={() => setEditing(payment)}>수정</button><button className="danger compact" type="button" onClick={() => setDeleting(payment)}>삭제</button></div></article>)}</div> : <div className="payment-empty">등록된 결제 내역이 없습니다.</div>}
    {editing && <PaymentFormModal userId={userId} payment={editing === "create" ? null : editing} onClose={() => setEditing(null)} onComplete={async (message) => { setEditing(null); showToast(message, "success"); await loadPayments(); }} />}
    {deleting && <DeletePaymentModal userId={userId} payment={deleting} onClose={() => setDeleting(null)} onComplete={async () => { setDeleting(null); showToast("결제 내역을 삭제했습니다.", "success"); await loadPayments(); }} />}
  </section>;
}

function PaymentFormModal({ userId, payment, onClose, onComplete }: { userId: string; payment: UserPayment | null; onClose: () => void; onComplete: (message: string) => Promise<void> }) {
  const [form, setForm] = useState<PaymentFormValue>(() => payment ? paymentFormValue(payment) : emptyPayment());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError("금액은 1원 이상의 정수로 입력해주세요.");
    const paidAt = new Date(form.paidAt);
    if (!form.paidAt || Number.isNaN(paidAt.getTime())) return setError("결제일을 입력해주세요.");
    setSubmitting(true); setError("");
    try {
      await apiClient(`/api/admin/users/${userId}/payments${payment ? `/${payment.id}` : ""}`, { method: payment ? "PATCH" : "POST", cache: "no-store", body: JSON.stringify({ amount, paymentType: form.paymentType, bankName: form.bankName.trim() || null, paidAt: paidAt.toISOString(), memo: form.memo.trim() || null }) });
      await onComplete(payment ? "결제 내역을 수정했습니다." : "결제 내역을 등록했습니다.");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "결제 내역을 저장하지 못했습니다."); }
    finally { setSubmitting(false); }
  }
  return <Modal title={payment ? "결제 내역 수정" : "결제 내역 등록"} onClose={onClose} closeDisabled={submitting}><form className="modal-form payment-form" onSubmit={submit}><label>금액 (원)<input type="number" min={1} step={1} inputMode="numeric" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required autoFocus /></label><label>결제 종류<select value={form.paymentType} onChange={(event) => setForm((current) => ({ ...current, paymentType: event.target.value as PaymentType }))}>{paymentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>은행 종류<input list="payment-bank-options" value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="은행을 선택하거나 직접 입력" maxLength={100} /><datalist id="payment-bank-options">{bankNames.map((bank) => <option value={bank} key={bank} />)}</datalist></label><label>결제일<input type="datetime-local" value={form.paidAt} onChange={(event) => setForm((current) => ({ ...current, paidAt: event.target.value }))} required /></label><label className="full-field">메모<textarea value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} maxLength={1000} placeholder="선택 입력" /></label>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button className="secondary" type="button" disabled={submitting} onClick={onClose}>취소</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "저장 중..." : payment ? "수정" : "등록"}</button></div></form></Modal>;
}

function DeletePaymentModal({ userId, payment, onClose, onComplete }: { userId: string; payment: UserPayment; onClose: () => void; onComplete: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  async function remove() { setSubmitting(true); setError(""); try { await apiClient(`/api/admin/users/${userId}/payments/${payment.id}`, { method: "DELETE", cache: "no-store" }); await onComplete(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "결제 내역을 삭제하지 못했습니다."); } finally { setSubmitting(false); } }
  return <Modal title="결제 내역을 삭제할까요?" onClose={onClose} closeDisabled={submitting}><div className="delete-account-dialog"><p><strong>{payment.amount.toLocaleString("ko-KR")}원 · {paymentTypeLabel(payment.paymentType)}</strong> 결제 내역을 삭제합니다.<br />삭제한 내역은 복구할 수 없습니다.</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button className="secondary" type="button" disabled={submitting} onClick={onClose}>취소</button><button className="danger" type="button" disabled={submitting} onClick={() => void remove()}>{submitting ? "삭제 중..." : "삭제"}</button></div></div></Modal>;
}
