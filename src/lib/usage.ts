import crypto from "crypto";
import { db } from "@/lib/db";
import { isUnlimited } from "@/lib/role";

export const LIMITS = {
  anonymous: 100000, // SINOV: prod'ga chiqishda 100 ga qaytaring
  user: 1000,
  admin: 50000,
  vip: 50000, // cheksiz rejimda ishlatilmaydi (faqat ko'rsatkich)
} as const;

export type UsageRole = keyof typeof LIMITS;

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(ip + (process.env.AUTH_SECRET ?? "salt"))
    .digest("hex")
    .slice(0, 32);
}

export interface UsageStatus {
  role: UsageRole;
  limit: number;
  charsUsed: number;
  remaining: number;
  resetAt: string; // ertangi sana
  unlimited: boolean; // vip/admin → cheksiz
}

// "role" string'ni LIMITS kalitiga moslash
function usageRole(role: string): UsageRole {
  if (role === "admin") return "admin";
  if (role === "vip") return "vip";
  return "user";
}

export async function getUserUsage(userId: string, role: string): Promise<UsageStatus> {
  const date = today();
  const row = await db.dailyUsage.findUnique({
    where: { userId_date: { userId, date } },
  });
  const charsUsed = row?.charsUsed ?? 0;
  const r = usageRole(role);
  const limit = LIMITS[r];
  return {
    role: r,
    limit,
    charsUsed,
    remaining: Math.max(0, limit - charsUsed),
    resetAt: nextMidnight(),
    unlimited: isUnlimited(role),
  };
}

export async function getAnonymousUsage(ipHash: string): Promise<UsageStatus> {
  const date = today();
  const row = await db.anonymousUsage.findUnique({
    where: { ipHash_date: { ipHash, date } },
  });
  const charsUsed = row?.charsUsed ?? 0;
  const limit = LIMITS.anonymous;
  return {
    role: "anonymous",
    limit,
    charsUsed,
    remaining: Math.max(0, limit - charsUsed),
    resetAt: nextMidnight(),
    unlimited: false,
  };
}

export async function consumeUserUsage(
  userId: string,
  role: string,
  chars: number,
): Promise<UsageStatus> {
  const date = today();
  const row = await db.dailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, charsUsed: chars, requests: 1 },
    update: {
      charsUsed: { increment: chars },
      requests: { increment: 1 },
    },
  });
  const r = usageRole(role);
  const limit = LIMITS[r];
  return {
    role: r,
    limit,
    charsUsed: row.charsUsed,
    remaining: Math.max(0, limit - row.charsUsed),
    resetAt: nextMidnight(),
    unlimited: isUnlimited(role),
  };
}

export async function consumeAnonymousUsage(
  ipHash: string,
  chars: number,
): Promise<UsageStatus> {
  const date = today();
  const row = await db.anonymousUsage.upsert({
    where: { ipHash_date: { ipHash, date } },
    create: { ipHash, date, charsUsed: chars, requests: 1 },
    update: {
      charsUsed: { increment: chars },
      requests: { increment: 1 },
    },
  });
  const limit = LIMITS.anonymous;
  return {
    role: "anonymous",
    limit,
    charsUsed: row.charsUsed,
    remaining: Math.max(0, limit - row.charsUsed),
    resetAt: nextMidnight(),
    unlimited: false,
  };
}

function nextMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") || "127.0.0.1";
}
