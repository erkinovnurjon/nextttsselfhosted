// ────────────────────────────────────────────────
// CORS — ommaviy API (/api/v1/*) uchun.
//
// Brauzerdagi vidjet boshqa domendan murojaat qiladi, ya'ni brauzer avval
// preflight (OPTIONS) yuboradi. Preflight'da Authorization sarlavhasi BO'LMAYDI —
// brauzer uni ataylab yubormaydi. Demak preflight'ni kalit bilan tekshirib
// bo'lmaydi: unga ruxsat beramiz, haqiqiy tekshiruv POST'da bo'ladi.
//
// Bu xavfsiz, chunki preflight hech narsa bajarmaydi — u faqat "shu so'rovni
// yuborsam bo'ladimi?" degan savol. Ruxsatsiz domendan kelgan POST 403 oladi.
//
// MUHIM: xato javoblarga ham CORS sarlavhasi kerak. Aks holda brauzer javobni
// o'qishga qo'ymaydi va dasturchi 403 o'rniga tushunarsiz "CORS error" ko'radi.
// ────────────────────────────────────────────────

const ALLOW_HEADERS = "Authorization, Content-Type";
const ALLOW_METHODS = "POST, GET, OPTIONS";
/** Preflight natijasini brauzer shuncha saqlaydi — har so'rovga OPTIONS ketmasin. */
const MAX_AGE = "86400";

/**
 * So'rov origin'iga mos CORS sarlavhalari.
 *
 * Origin yo'q (server-server, curl) → CORS umuman kerak emas, bo'sh qaytaramiz.
 * `*` ATAYLAB ishlatilmaydi: Authorization bilan birga u brauzerda baribir
 * ishlamaydi va noto'g'ri xavfsizlik taassurotini beradi.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    // Origin echo qilinganda kesh javobni domenlar orasida aralashtirmasin.
    Vary: "Origin",
  };
}

/** Preflight javobi. */
export function preflight(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": ALLOW_METHODS,
      "Access-Control-Allow-Headers": ALLOW_HEADERS,
      "Access-Control-Max-Age": MAX_AGE,
    },
  });
}
