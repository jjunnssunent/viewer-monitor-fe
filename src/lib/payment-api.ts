import { ApiError } from "./api-client";
import type { PaymentType, UserPayment } from "./types";

const paymentTypes: PaymentType[] = ["card", "bank_transfer", "cash", "virtual_account", "other"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseUserPayments(data: unknown): UserPayment[] {
  const list = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.payments)
      ? data.payments
      : isRecord(data) && Array.isArray(data.data)
        ? data.data
        : null;
  if (!list) throw new ApiError("결제 내역 응답 형식이 올바르지 않습니다.", 500, data);

  return list.map((value) => {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.userId !== "string" || typeof value.amount !== "number" || !paymentTypes.includes(value.paymentType as PaymentType) || typeof value.paidAt !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
      throw new ApiError("결제 내역 응답 형식이 올바르지 않습니다.", 500, data);
    }
    return {
      id: value.id,
      userId: value.userId,
      amount: value.amount,
      paymentType: value.paymentType as PaymentType,
      bankName: typeof value.bankName === "string" ? value.bankName : null,
      paidAt: value.paidAt,
      memo: typeof value.memo === "string" ? value.memo : null,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}
