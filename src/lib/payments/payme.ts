import { db } from "@/lib/db";
import { grantCredits, spendCredits } from "@/lib/credits";
import { PAYME } from "@/lib/payments/config";
import { somToTiyin } from "@/lib/pricing";

// ────────────────────────────────────────────────
// Payme Merchant API (JSON-RPC) handler
// Hujjat: https://developer.help.paycom.uz/protokol-merchant-api
// Provayder bizning endpoint'ga POST qiladi. Biz buyurtmani topib,
// tasdiqlaymiz va to'langach kredit beramiz (idempotent).
// ────────────────────────────────────────────────

// Payme tranzaksiya holatlari
const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELED = -1; // yaratilgandan keyin bekor
const STATE_CANCELED_AFTER = -2; // to'langandan keyin bekor

// 12 soat (ms) — tranzaksiya muddati
const TIMEOUT_MS = 12 * 60 * 60 * 1000;

type Msg = { ru: string; uz: string; en: string };

const ERR = {
  AUTH: -32504,
  ACCOUNT: -31050, // buyurtma topilmadi / noto'g'ri
  AMOUNT: -31001, // summa mos emas
  TXN_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  CANNOT_CANCEL: -31007,
} as const;

function msg(ru: string, uz: string, en: string): Msg {
  return { ru, uz, en };
}

interface RpcError {
  code: number;
  message: Msg;
  data?: string;
}

function rpcError(code: number, m: Msg, data?: string): { error: RpcError } {
  return { error: { code, message: m, data } };
}

// Authorization: Basic base64("Paycom:KEY")
export function checkPaymeAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
    return Boolean(PAYME.key) && pass === PAYME.key;
  } catch {
    return false;
  }
}

function orderIdFrom(params: Record<string, unknown>): string | null {
  const account = params?.account as Record<string, unknown> | undefined;
  if (!account) return null;
  const v = account.order_id ?? account.orderId ?? Object.values(account)[0];
  return v != null ? String(v) : null;
}

function now(): number {
  return Date.now();
}

// ── Asosiy dispatcher ──
export async function handlePayme(
  method: string,
  params: Record<string, unknown>
): Promise<{ result: unknown } | { error: RpcError }> {
  switch (method) {
    case "CheckPerformTransaction":
      return checkPerform(params);
    case "CreateTransaction":
      return createTransaction(params);
    case "PerformTransaction":
      return performTransaction(params);
    case "CancelTransaction":
      return cancelTransaction(params);
    case "CheckTransaction":
      return checkTransaction(params);
    case "GetStatement":
      return getStatement(params);
    default:
      return rpcError(
        -32601,
        msg("Метод не найден", "Metod topilmadi", "Method not found")
      );
  }
}

const ACCOUNT_ERR = msg(
  "Заказ не найден",
  "Buyurtma topilmadi",
  "Order not found"
);
const AMOUNT_ERR = msg("Неверная сумма", "Summa noto'g'ri", "Invalid amount");

async function checkPerform(params: Record<string, unknown>) {
  const orderId = orderIdFrom(params);
  if (!orderId) return rpcError(ERR.ACCOUNT, ACCOUNT_ERR, "order_id");

  const payment = await db.payment.findUnique({ where: { id: orderId } });
  if (!payment || payment.provider !== "payme") {
    return rpcError(ERR.ACCOUNT, ACCOUNT_ERR, "order_id");
  }
  if (payment.status === "paid") {
    return rpcError(ERR.ACCOUNT, msg("Заказ уже оплачен", "Buyurtma to'langan", "Order already paid"), "order_id");
  }
  const amountTiyin = Number(params.amount);
  if (amountTiyin !== somToTiyin(payment.amountSom)) {
    return rpcError(ERR.AMOUNT, AMOUNT_ERR);
  }
  return { result: { allow: true } };
}

async function createTransaction(params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const time = Number(params.time);
  const amountTiyin = Number(params.amount);

  // Shu payme id allaqachon mavjudmi? (idempotent)
  const existing = await db.payment.findFirst({
    where: { provider: "payme", providerTxnId: paymeId },
  });
  if (existing) {
    if (existing.state !== STATE_CREATED) {
      return rpcError(
        ERR.CANNOT_PERFORM,
        msg("Невозможно выполнить", "Bajarib bo'lmaydi", "Cannot perform")
      );
    }
    return {
      result: {
        create_time: Number(existing.createTime ?? time),
        transaction: existing.id,
        state: STATE_CREATED,
      },
    };
  }

  const orderId = orderIdFrom(params);
  if (!orderId) return rpcError(ERR.ACCOUNT, ACCOUNT_ERR, "order_id");

  const payment = await db.payment.findUnique({ where: { id: orderId } });
  if (!payment || payment.provider !== "payme") {
    return rpcError(ERR.ACCOUNT, ACCOUNT_ERR, "order_id");
  }
  if (amountTiyin !== somToTiyin(payment.amountSom)) {
    return rpcError(ERR.AMOUNT, AMOUNT_ERR);
  }
  // Buyurtmaga boshqa tranzaksiya biriktirilganmi?
  if (payment.providerTxnId && payment.providerTxnId !== paymeId) {
    return rpcError(
      ERR.ACCOUNT,
      msg("Заказ в обработке", "Buyurtma jarayonda", "Order in process"),
      "order_id"
    );
  }
  if (payment.status !== "pending") {
    return rpcError(ERR.CANNOT_PERFORM, msg("Невозможно", "Bo'lmaydi", "Cannot perform"));
  }
  // Muddat tekshiruvi
  if (now() - time > TIMEOUT_MS) {
    return rpcError(
      ERR.CANNOT_PERFORM,
      msg("Срок истёк", "Muddat o'tdi", "Timeout")
    );
  }

  const updated = await db.payment.update({
    where: { id: orderId },
    data: {
      providerTxnId: paymeId,
      state: STATE_CREATED,
      createTime: BigInt(time),
    },
  });

  return {
    result: {
      create_time: time,
      transaction: updated.id,
      state: STATE_CREATED,
    },
  };
}

async function performTransaction(params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const payment = await db.payment.findFirst({
    where: { provider: "payme", providerTxnId: paymeId },
  });
  if (!payment) {
    return rpcError(
      ERR.TXN_NOT_FOUND,
      msg("Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found")
    );
  }

  if (payment.state === STATE_PERFORMED) {
    // Idempotent
    return {
      result: {
        transaction: payment.id,
        perform_time: Number(payment.performTime ?? 0),
        state: STATE_PERFORMED,
      },
    };
  }
  if (payment.state !== STATE_CREATED) {
    return rpcError(
      ERR.CANNOT_PERFORM,
      msg("Невозможно выполнить", "Bajarib bo'lmaydi", "Cannot perform")
    );
  }

  const performTime = now();
  // Kreditni berish + statusni yangilash (idempotent, meta=payment.id)
  await grantCredits(payment.userId, payment.credits, "topup", `payme:${payment.id}`);
  await db.payment.update({
    where: { id: payment.id },
    data: {
      state: STATE_PERFORMED,
      status: "paid",
      performTime: BigInt(performTime),
    },
  });

  return {
    result: {
      transaction: payment.id,
      perform_time: performTime,
      state: STATE_PERFORMED,
    },
  };
}

async function cancelTransaction(params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const reason = params.reason != null ? Number(params.reason) : null;
  const payment = await db.payment.findFirst({
    where: { provider: "payme", providerTxnId: paymeId },
  });
  if (!payment) {
    return rpcError(
      ERR.TXN_NOT_FOUND,
      msg("Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found")
    );
  }

  // Allaqachon bekor qilingan — idempotent
  if (payment.state === STATE_CANCELED || payment.state === STATE_CANCELED_AFTER) {
    return {
      result: {
        transaction: payment.id,
        cancel_time: Number(payment.cancelTime ?? 0),
        state: payment.state,
      },
    };
  }

  const cancelTime = now();
  let newState = STATE_CANCELED;

  if (payment.state === STATE_PERFORMED) {
    // To'langandan keyin bekor — kreditni qaytarib olishga harakat
    newState = STATE_CANCELED_AFTER;
    await spendCredits(payment.userId, payment.credits, "admin", `payme-cancel:${payment.id}`).catch(
      () => undefined
    );
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      state: newState,
      status: "canceled",
      cancelTime: BigInt(cancelTime),
      reason,
    },
  });

  return {
    result: {
      transaction: payment.id,
      cancel_time: cancelTime,
      state: newState,
    },
  };
}

async function checkTransaction(params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const payment = await db.payment.findFirst({
    where: { provider: "payme", providerTxnId: paymeId },
  });
  if (!payment) {
    return rpcError(
      ERR.TXN_NOT_FOUND,
      msg("Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found")
    );
  }
  return {
    result: {
      create_time: Number(payment.createTime ?? 0),
      perform_time: Number(payment.performTime ?? 0),
      cancel_time: Number(payment.cancelTime ?? 0),
      transaction: payment.id,
      state: payment.state,
      reason: payment.reason ?? null,
    },
  };
}

async function getStatement(params: Record<string, unknown>) {
  const from = Number(params.from);
  const to = Number(params.to);
  const payments = await db.payment.findMany({
    where: {
      provider: "payme",
      providerTxnId: { not: null },
      createTime: { gte: BigInt(from), lte: BigInt(to) },
    },
    orderBy: { createTime: "asc" },
  });
  return {
    result: {
      transactions: payments.map((p) => ({
        id: p.providerTxnId,
        time: Number(p.createTime ?? 0),
        amount: somToTiyin(p.amountSom),
        account: { order_id: p.id },
        create_time: Number(p.createTime ?? 0),
        perform_time: Number(p.performTime ?? 0),
        cancel_time: Number(p.cancelTime ?? 0),
        transaction: p.id,
        state: p.state,
        reason: p.reason ?? null,
      })),
    },
  };
}
