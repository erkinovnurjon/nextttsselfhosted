import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

// ────────────────────────────────────────────────
// API kalitlari — tashqi loyihalar uchun autentifikatsiya.
//
// Nega sessiya-cookie emas: boshqa domendagi loyiha (lms3, mahoratmy ...) bizning
// cookie'mizni yubora olmaydi. Kalit — domendan mustaqil, har qanday tildan ishlaydi.
//
// Nega ikki tur: brauzerga qo'yilgan kalitni har kim DevTools'dan o'qiydi. Shuning
// uchun `publishable` kalit `origins`ga bog'lanadi va faqat sintez qila oladi —
// o'g'irlansa ham begona saytda ishlamaydi. `secret` esa hech qachon brauzerga
// tushmasligi kerak.
// ────────────────────────────────────────────────

export type ApiKeyKind = "secret" | "publishable";

/** 24 bayt = 192 bit entropiya. Taxmin qilib bo'lmaydi. */
const KEY_BYTES = 24;
/** UI'da ko'rsatiladigan tanish qismi uzunligi ("sk_live_" + 8 belgi). */
const PREFIX_LEN = 16;
/** lastUsedAt'ni har so'rovda yozmaymiz — shu oraliqdan tez-tez emas. */
const LAST_USED_THROTTLE_MS = 60_000;

const PREFIXES: Record<ApiKeyKind, string> = {
  secret: "sk_live_",
  publishable: "pk_live_",
};

export interface GeneratedKey {
  /** To'liq kalit — FAQAT shu yerda, bir marta. Saqlanmaydi. */
  token: string;
  prefix: string;
  hash: string;
}

/** Yangi kalit yaratadi. Qaytgan `token` foydalanuvchiga bir marta ko'rsatiladi. */
export function generateKey(kind: ApiKeyKind): GeneratedKey {
  const token = PREFIXES[kind] + randomBytes(KEY_BYTES).toString("base64url");
  return { token, prefix: token.slice(0, PREFIX_LEN), hash: hashKey(token) };
}

/** sha256 — qidiruv kaliti. Kalit yuqori entropiyali bo'lgani uchun yetarli. */
export function hashKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function kindOf(token: string): ApiKeyKind | null {
  if (token.startsWith(PREFIXES.secret)) return "secret";
  if (token.startsWith(PREFIXES.publishable)) return "publishable";
  return null;
}

/**
 * `Authorization: Bearer <token>` sarlavhasidan kalitni ajratadi.
 * `?key=` kabi URL parametri ATAYLAB qo'llab-quvvatlanmaydi — u brauzer tarixiga,
 * proksi va server loglariga tushadi.
 */
export function readBearer(headers: Headers): string | null {
  const raw = headers.get("authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : null;
}

export type AuthFailure =
  | "missing" // kalit umuman yuborilmagan
  | "invalid" // shakli buzuq yoki bazada yo'q
  | "revoked" // o'chirilgan
  | "origin"; // publishable kalit ruxsatsiz domendan

export interface AuthOk {
  ok: true;
  keyId: string;
  userId: string;
  kind: ApiKeyKind;
}
export interface AuthErr {
  ok: false;
  reason: AuthFailure;
}
export type AuthResult = AuthOk | AuthErr;

/**
 * Domen mosligini tekshiradi. `origins` bo'sh bo'lsa publishable kalit HECH QAYERDA
 * ishlamaydi — bu ataylab: domen ko'rsatmasdan yaratilgan kalit himoyasiz bo'lardi.
 *
 * Solishtirish origin (sxema+host+port) bo'yicha, satr sifatida — wildcard yo'q.
 * `*.example.com` ni qo'llab-quvvatlash subdomen egallash xavfini ochadi.
 */
export function originAllowed(origin: string | null, origins: string[]): boolean {
  if (!origin) return false;
  return origins.some((o) => o.toLowerCase() === origin.toLowerCase());
}

/**
 * So'rovni kalit bo'yicha autentifikatsiya qiladi.
 *
 * publishable kalit uchun Origin sarlavhasi tekshiriladi. Origin'ni brauzer o'zi
 * qo'yadi va JS uni o'zgartira olmaydi — ya'ni brauzerdan kelgan so'rov uchun bu
 * ishonchli. curl'da uni soxtalashtirish mumkin, lekin publishable kalit baribir
 * ommaviy — u yerdagi himoya kredit limiti va rate-limit, origin emas.
 */
export async function authenticateApiKey(headers: Headers): Promise<AuthResult> {
  const token = readBearer(headers);
  if (!token) return { ok: false, reason: "missing" };

  const kind = kindOf(token);
  if (!kind) return { ok: false, reason: "invalid" };

  const row = await db.apiKey.findUnique({
    where: { hash: hashKey(token) },
    select: {
      id: true,
      userId: true,
      kind: true,
      hash: true,
      origins: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };

  // Hash unique va sha256 to'qnashuvi amalda imkonsiz, lekin solishtirishni
  // vaqt-barqaror qilish arzon — kelajakda qidiruv mantig'i o'zgarsa ham xavfsiz.
  const expected = Buffer.from(row.hash, "hex");
  const actual = Buffer.from(hashKey(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "invalid" };
  }

  if (row.kind === "publishable") {
    if (!originAllowed(headers.get("origin"), row.origins)) {
      return { ok: false, reason: "origin" };
    }
  }

  // Har sintezda DB yozuvi qilmaymiz — daqiqada bir marta yetarli.
  const stale =
    !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
  if (stale) {
    void db.apiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined); // telemetriya — so'rovni yiqitmasin
  }

  return { ok: true, keyId: row.id, userId: row.userId, kind: row.kind as ApiKeyKind };
}

/** Xato sababiga mos HTTP status va o'qiladigan xabar. */
export function authErrorResponse(reason: AuthFailure): {
  status: number;
  error: string;
} {
  switch (reason) {
    case "missing":
      return {
        status: 401,
        error:
          "API kalit yuborilmadi. `Authorization: Bearer sk_live_...` sarlavhasini qo'shing.",
      };
    case "invalid":
      return { status: 401, error: "API kalit yaroqsiz." };
    case "revoked":
      return { status: 401, error: "Bu API kalit o'chirilgan." };
    case "origin":
      return {
        status: 403,
        error:
          "Bu domen kalitga ro'yxatdan o'tkazilmagan. Kabinet → API kalitlar bo'limida domenni qo'shing.",
      };
  }
}
