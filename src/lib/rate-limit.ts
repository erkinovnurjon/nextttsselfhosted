// ────────────────────────────────────────────────
// Rate-limit — ommaviy API uchun.
//
// Nega kerak: publishable kalit brauzerda ochiq turadi. Kredit limiti sarfni
// cheklaydi, lekin sekundiga yuzlab so'rov GPU navbatini bo'g'ib qo'yadi — ya'ni
// bitta e'tiborsiz (yoki yomon niyatli) sahifa butun xizmatni sekinlashtiradi.
//
// ⚠️ Jarayon xotirasida: pilot = bitta instans, shuning uchun Map yetarli.
// Ko'p instansli prod'da har instans o'z hisobini yuritadi va amaldagi limit
// instans soniga ko'payadi → Redis (yoki Upstash) ga ko'chirish kerak.
// ────────────────────────────────────────────────

export interface RateLimitResult {
  ok: boolean;
  /** Oynada qolgan so'rovlar soni. */
  remaining: number;
  /** Oyna qachon yangilanadi (unix ms). */
  resetAt: number;
  /** Limitning o'zi — X-RateLimit-Limit uchun. */
  limit: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;

/**
 * Kalit turiga qarab daqiqadagi so'rov chegarasi.
 * secret server-serverdan keladi (ishonchli, ko'p bo'lishi tabiiy);
 * publishable ochiq brauzerdan — qattiqroq.
 */
export const LIMITS_PER_MIN: Record<string, number> = {
  secret: 120,
  publishable: 30,
};

const windows = new Map<string, Window>();

/**
 * Eskirgan yozuvlarni tozalash. Bufer Map cheksiz o'smasligi uchun — har
 * tekshiruvda emas, vaqti-vaqti bilan (tozalash O(n), har so'rovda qilish isrof).
 */
let lastSweep = Date.now();
const SWEEP_EVERY_MS = 5 * 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [k, w] of windows) {
    if (w.resetAt <= now) windows.delete(k);
  }
}

/**
 * Bitta so'rovni hisobga oladi.
 *
 * `key` — hisob birligi. Publishable uchun kalit+IP (bitta kalitni ko'p odam
 * ishlatadi, IP'siz bir foydalanuvchi hammani bloklardi); secret uchun kalitning
 * o'zi yetarli.
 *
 * Oyna qat'iy (fixed window), sirpanuvchi emas: chegarada 2x burst bo'lishi mumkin.
 * Pilot uchun bu maqbul — maqsad suiiste'molni to'xtatish, ideal adolat emas.
 */
export function rateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    windows.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt, limit };
  }

  if (w.count >= limit) {
    return { ok: false, remaining: 0, resetAt: w.resetAt, limit };
  }
  w.count += 1;
  return { ok: true, remaining: limit - w.count, resetAt: w.resetAt, limit };
}

/** Javobga qo'yiladigan standart sarlavhalar. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
}
