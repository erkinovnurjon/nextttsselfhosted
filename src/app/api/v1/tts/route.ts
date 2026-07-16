import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, authErrorResponse } from "@/lib/api-key";
import { corsHeaders, preflight } from "@/lib/cors";
import { LIMITS_PER_MIN, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getBalance, spendCredits, isUnlimited } from "@/lib/credits";
import { getClientIp } from "@/lib/usage";
import {
  BACKEND_DOWN_HINT,
  isEngine,
  metaHeaders,
  resolveUserVoiceRef,
  synthesizeOnBackend,
  type Engine,
} from "@/lib/tts-backend";

// ────────────────────────────────────────────────
// OMMAVIY API — POST /api/v1/tts
//
// Ichki /api/tts dan farqi: sessiya-cookie o'rniga API kalit, ya'ni istalgan
// domendagi loyiha (lms3, mahoratmy ...) yoki istalgan tildagi backend chaqira
// oladi. Kredit hisobi kalit egasidan yechiladi.
//
// Bu marshrut BARQAROR shartnoma: /v1 ostidagi javob shakli va maydon nomlari
// buzilmasligi kerak — tashqi loyihalar unga bog'lanadi. Yangi imkoniyat kerak
// bo'lsa ixtiyoriy maydon qo'shiladi yoki /v2 ochiladi.
// ────────────────────────────────────────────────

/** Bir so'rovdagi matn chegarasi. GPU navbatini bitta ulkan matn egallamasin. */
const MAX_CHARS = 5_000;

export async function OPTIONS(request: Request) {
  return preflight(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const fail = (status: number, body: Record<string, unknown>, extra = {}) =>
    NextResponse.json(body, { status, headers: { ...cors, ...extra } });

  // ───── 1. Autentifikatsiya ─────
  const auth = await authenticateApiKey(request.headers);
  if (!auth.ok) {
    const e = authErrorResponse(auth.reason);
    return fail(e.status, { error: e.error });
  }

  // ───── 2. Rate-limit ─────
  // Publishable kalit ko'p odamda bo'ladi → IP bilan birga hisoblaymiz, aks holda
  // bitta faol foydalanuvchi qolganlarni bloklab qo'yadi. Secret server-serverdan.
  const bucket =
    auth.kind === "publishable"
      ? `${auth.keyId}:${getClientIp(request.headers)}`
      : auth.keyId;
  const rl = rateLimit(bucket, LIMITS_PER_MIN[auth.kind]);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.ok) {
    return fail(
      429,
      {
        error: "So'rovlar juda tez-tez. Biroz kutib qayta urinib ko'ring.",
        retryAfterSec: Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)),
      },
      {
        ...rlHeaders,
        "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
      }
    );
  }

  // ───── 3. Kirishni tekshirish ─────
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return fail(400, { error: "JSON tanasi kutilgan edi." }, rlHeaders);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return fail(400, { error: "`text` maydoni majburiy va bo'sh bo'lmasligi kerak." }, rlHeaders);
  }
  if (text.length > MAX_CHARS) {
    return fail(
      400,
      {
        error: `Matn juda uzun: ${text.length} belgi (chegara ${MAX_CHARS}). Uni bo'laklarga bo'lib yuboring.`,
        maxChars: MAX_CHARS,
      },
      rlHeaders
    );
  }

  const engine: Engine = isEngine(body.engine) ? body.engine : "piper";
  const voice = typeof body.voice === "string" ? body.voice : "main";
  const speed = typeof body.speed === "number" && body.speed > 0 ? body.speed : 1.0;

  // Shaxsiy ovoz — faqat secret kalit bilan. Publishable brauzerda ochiq turadi,
  // u bilan boshqa odam kalit egasining klonlangan ovozini gapirtira olmasligi kerak.
  if (voice === "__me__" && auth.kind !== "secret") {
    return fail(
      403,
      { error: "Shaxsiy ovoz (`__me__`) faqat maxfiy (sk_live_) kalit bilan ishlaydi." },
      rlHeaders
    );
  }

  // ───── 4. Balans ─────
  const charCount = text.length;
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  const unlimited = isUnlimited(user?.role);
  if (!unlimited) {
    const balance = await getBalance(auth.userId);
    if (charCount > balance) {
      return fail(
        402,
        {
          error: `Balans yetarli emas: ${balance} kredit qoldi, bu matn ${charCount} kredit talab qiladi.`,
          balance,
          required: charCount,
        },
        rlHeaders
      );
    }
  }

  // ───── 5. Sintez ─────
  let f5Ref = null;
  if (voice === "__me__" && engine === "f5") {
    f5Ref = await resolveUserVoiceRef(
      auth.userId,
      typeof body.user_voice_id === "string" ? body.user_voice_id : undefined
    );
    if (!f5Ref) {
      return fail(
        400,
        { error: "Shaxsiy ovoz topilmadi. Avval kabinetda ovoz yarating." },
        rlHeaders
      );
    }
  }

  const out = await synthesizeOnBackend({
    text,
    engine,
    voice,
    speed,
    f5Ref,
    speaking_rate:
      typeof body.speaking_rate === "number" ? body.speaking_rate : undefined,
    language: typeof body.language === "string" ? body.language : undefined,
    checkpointId:
      typeof body.checkpoint_id === "string" ? body.checkpoint_id : undefined,
  });

  if (!out.ok) {
    if (out.kind === "down") {
      return fail(
        503,
        { error: "Sintez xizmati vaqtincha ishlamayapti.", details: out.details, hint: BACKEND_DOWN_HINT },
        rlHeaders
      );
    }
    return fail(
      502,
      { error: `Sintez xatosi (${out.status})`, details: out.details },
      rlHeaders
    );
  }

  // ───── 6. Kredit yechish + tarix ─────
  // MUHIM: kredit sintezdan KEYIN yechiladi. Aks holda backend yiqilganda
  // foydalanuvchi hech nima olmay turib pul to'lardi.
  const usageHeaders: Record<string, string> = {};
  if (unlimited) {
    usageHeaders["X-Credit-Balance"] = "unlimited";
  } else {
    const spend = await spendCredits(auth.userId, charCount, "synthesis", text.slice(0, 80));
    usageHeaders["X-Credit-Balance"] = String(spend.balance);
  }

  await db.synthesis
    .create({
      data: {
        userId: auth.userId,
        text,
        voice: voice === "__me__" ? "myvoice" : engine === "mms" ? "mms" : voice,
        speed,
        charCount,
        durationSec: out.meta.synthTimeSec,
      },
    })
    .catch(() => undefined); // tarix — sintezni yiqitmasin

  return new NextResponse(out.audio, {
    headers: {
      "Content-Type": "audio/wav",
      ...cors,
      ...rlHeaders,
      ...metaHeaders(out.meta),
      ...usageHeaders,
      "Cache-Control": "no-store",
    },
  });
}
