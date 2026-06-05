import crypto from "crypto";
import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { CLICK } from "@/lib/payments/config";

// ────────────────────────────────────────────────
// Click SHOP API (Prepare / Complete) handler
// Hujjat: https://docs.click.uz/click-api/
// Click bizning endpoint'ga form-urlencoded POST qiladi.
// Imzoni MD5 bilan tekshiramiz, Complete'da kredit beramiz (idempotent).
// ────────────────────────────────────────────────

// Click xato kodlari
const E = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  BAD_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TXN_NOT_FOUND: -6,
  UPDATE_FAILED: -7,
  BAD_REQUEST: -8,
  CANCELED: -9,
} as const;

export interface ClickParams {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string; // bizning order id
  merchant_prepare_id?: string;
  amount: string; // so'm "5000.00"
  action: string; // "0" prepare, "1" complete
  error: string;
  error_note?: string;
  sign_time: string;
  sign_string: string;
}

function md5(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex");
}

function verifyPrepareSign(p: ClickParams): boolean {
  const raw =
    p.click_trans_id +
    p.service_id +
    CLICK.secretKey +
    p.merchant_trans_id +
    p.amount +
    p.action +
    p.sign_time;
  return md5(raw) === p.sign_string;
}

function verifyCompleteSign(p: ClickParams): boolean {
  const raw =
    p.click_trans_id +
    p.service_id +
    CLICK.secretKey +
    p.merchant_trans_id +
    (p.merchant_prepare_id ?? "") +
    p.amount +
    p.action +
    p.sign_time;
  return md5(raw) === p.sign_string;
}

function amountMatches(amountStr: string, amountSom: number): boolean {
  const a = parseFloat(amountStr);
  return Number.isFinite(a) && Math.round(a) === amountSom;
}

// ── Prepare (action=0) ──
export async function clickPrepare(p: ClickParams) {
  if (!verifyPrepareSign(p)) {
    return { error: E.SIGN_FAILED, error_note: "SIGN CHECK FAILED" };
  }
  const payment = await db.payment.findUnique({ where: { id: p.merchant_trans_id } });
  if (!payment || payment.provider !== "click") {
    return { error: E.ORDER_NOT_FOUND, error_note: "Order not found" };
  }
  if (payment.status === "paid") {
    return { error: E.ALREADY_PAID, error_note: "Already paid" };
  }
  if (payment.status === "canceled") {
    return { error: E.CANCELED, error_note: "Transaction cancelled" };
  }
  if (!amountMatches(p.amount, payment.amountSom)) {
    return { error: E.BAD_AMOUNT, error_note: "Incorrect amount" };
  }

  // prepare id sifatida click_trans_id'ni saqlaymiz
  await db.payment.update({
    where: { id: payment.id },
    data: { providerTxnId: p.click_trans_id, prepareId: p.click_trans_id },
  });

  return {
    error: E.SUCCESS,
    error_note: "Success",
    click_trans_id: p.click_trans_id,
    merchant_trans_id: payment.id,
    merchant_prepare_id: p.click_trans_id,
  };
}

// ── Complete (action=1) ──
export async function clickComplete(p: ClickParams) {
  if (!verifyCompleteSign(p)) {
    return { error: E.SIGN_FAILED, error_note: "SIGN CHECK FAILED" };
  }
  const payment = await db.payment.findUnique({ where: { id: p.merchant_trans_id } });
  if (!payment || payment.provider !== "click") {
    return { error: E.ORDER_NOT_FOUND, error_note: "Order not found" };
  }
  if (payment.prepareId !== p.merchant_prepare_id) {
    return { error: E.TXN_NOT_FOUND, error_note: "Prepare not found" };
  }
  if (!amountMatches(p.amount, payment.amountSom)) {
    return { error: E.BAD_AMOUNT, error_note: "Incorrect amount" };
  }

  // Click o'z tomonidan xato yuborgan (foydalanuvchi bekor qildi va h.k.)
  if (Number(p.error) < 0) {
    if (payment.status !== "paid") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "canceled" },
      });
    }
    return { error: E.CANCELED, error_note: "Transaction cancelled" };
  }

  // Idempotent: allaqachon to'langan
  if (payment.status === "paid") {
    return {
      error: E.SUCCESS,
      error_note: "Already confirmed",
      click_trans_id: p.click_trans_id,
      merchant_trans_id: payment.id,
      merchant_confirm_id: payment.id,
    };
  }

  // To'lovni tasdiqlash + kredit berish
  await grantCredits(payment.userId, payment.credits, "topup", `click:${payment.id}`);
  await db.payment.update({
    where: { id: payment.id },
    data: { status: "paid", state: 2 },
  });

  return {
    error: E.SUCCESS,
    error_note: "Success",
    click_trans_id: p.click_trans_id,
    merchant_trans_id: payment.id,
    merchant_confirm_id: payment.id,
  };
}
