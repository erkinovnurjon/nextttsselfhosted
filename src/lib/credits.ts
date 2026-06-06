import { db } from "@/lib/db";

// Cheksiz rollar (vip/admin) — role.ts'dan (client-safe). Qayta eksport.
export { UNLIMITED_ROLES, isUnlimited } from "@/lib/role";

// ────────────────────────────────────────────────
// Kredit balansi tizimi
// 1 kredit = 1 belgi. Ro'yxatdan o'tganda bonus beriladi,
// har sintezda balansdan yechiladi. Har o'zgarish ledger'ga yoziladi.
// ────────────────────────────────────────────────

export const SIGNUP_BONUS = 10_000; // ro'yxatdan o'tish bonusi
export const TOPUP_AMOUNT = 5_000; // demo "to'ldirish" miqdori

export type CreditReason = "signup" | "synthesis" | "topup" | "admin";

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: string;
  balanceAfter: number;
  meta: string | null;
  createdAt: Date;
}

export interface CreditSummary {
  balance: number;
  granted: number; // jami kelgan (musbat tranzaksiyalar)
  spent: number; // jami sarflangan (manfiy tranzaksiyalarning moduli)
}

export async function getBalance(userId: string): Promise<number> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  return u?.balance ?? 0;
}

export async function getSummary(userId: string): Promise<CreditSummary> {
  const [u, pos, neg] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { balance: true } }),
    db.creditTransaction.aggregate({
      where: { userId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    db.creditTransaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ]);
  return {
    balance: u?.balance ?? 0,
    granted: pos._sum.amount ?? 0,
    spent: Math.abs(neg._sum.amount ?? 0),
  };
}

export async function getLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  return db.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      reason: true,
      balanceAfter: true,
      meta: true,
      createdAt: true,
    },
  });
}

/**
 * Kredit qo'shish (bonus/to'ldirish). Atomik: balansni oshiradi va ledger yozadi.
 * Yangi balansni qaytaradi.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  meta?: string
): Promise<number> {
  if (amount <= 0) throw new Error("amount must be positive");
  const newBalance = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    await tx.creditTransaction.create({
      data: { userId, amount, reason, balanceAfter: u.balance, meta: meta ?? null },
    });
    return u.balance;
  });
  return newBalance;
}

/**
 * Kredit sarflash. Balans yetarli bo'lsa yechadi va ledger yozadi.
 * Yetarli bo'lmasa { ok: false } qaytaradi (balansni o'zgartirmaydi).
 */
export async function spendCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  meta?: string
): Promise<{ ok: boolean; balance: number }> {
  if (amount <= 0) {
    const balance = await getBalance(userId);
    return { ok: true, balance };
  }
  try {
    const balance = await db.$transaction(async (tx) => {
      // Faqat balans yetarli bo'lsa yangilash (atomik, race-safe)
      const res = await tx.user.updateMany({
        where: { id: userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (res.count === 0) {
        throw new Error("INSUFFICIENT");
      }
      const u = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      const after = u?.balance ?? 0;
      await tx.creditTransaction.create({
        data: { userId, amount: -amount, reason, balanceAfter: after, meta: meta ?? null },
      });
      return after;
    });
    return { ok: true, balance };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT") {
      const balance = await getBalance(userId);
      return { ok: false, balance };
    }
    throw err;
  }
}
