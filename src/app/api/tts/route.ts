import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  consumeAnonymousUsage,
  getAnonymousUsage,
  getUserUsage,
  getClientIp,
  hashIp,
  LIMITS,
} from "@/lib/usage";
import { getBalance, spendCredits, isUnlimited } from "@/lib/credits";
import {
  BACKEND_DOWN_HINT,
  isEngine,
  metaHeaders,
  resolveUserVoiceRef,
  synthesizeOnBackend,
  type Engine,
  type F5Ref,
} from "@/lib/tts-backend";

const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const language = typeof body?.language === "string" ? body.language : "tr";
  const voice = typeof body?.voice === "string" ? body.voice : "main";
  const speed = typeof body?.speed === "number" ? body.speed : 1.0;
  const temperature =
    typeof body?.temperature === "number" ? body.temperature : 0.65;
  const repetition_penalty =
    typeof body?.repetition_penalty === "number" ? body.repetition_penalty : 5.0;
  const top_k = typeof body?.top_k === "number" ? body.top_k : 50;
  const top_p = typeof body?.top_p === "number" ? body.top_p : 0.85;
  const checkpoint_id =
    typeof body?.checkpoint_id === "string" && body.checkpoint_id
      ? body.checkpoint_id
      : undefined;

  if (!text) {
    return NextResponse.json(
      { error: "Matn bo'sh bo'lmasligi kerak" },
      { status: 400 }
    );
  }

  // ───── Limit / balans tekshiruvi ─────
  // Login qilgan foydalanuvchi → kredit balansi
  // Anonim foydalanuvchi → IP-bo'yicha kunlik limit
  const session = await auth();
  const charCount = text.length;
  const ipHash = hashIp(getClientIp(request.headers));

  let balance = 0;
  let usage; // faqat anonim uchun
  // Rolni sessiya (eskirgan JWT) emas, DB'dan o'qiymiz — set-role.mjs bilan
  // o'zgartirilgan rol qayta login qilmasdan darrov kuchga kiradi.
  let unlimited = false;

  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    unlimited = isUnlimited(dbUser?.role);
    // Admin / VIP — cheksiz: balans tekshirilmaydi
    if (!unlimited) {
      balance = await getBalance(session.user.id);
      if (charCount > balance) {
        return NextResponse.json(
          {
            error: `Balans yetarli emas: ${balance} kredit qoldi, bu matn ${charCount} kredit talab qiladi. Balansni to'ldiring.`,
            balance,
            required: charCount,
            insufficientCredits: true,
          },
          { status: 402 }
        );
      }
    }
  } else {
    usage = await getAnonymousUsage(ipHash);
    if (charCount > usage.remaining) {
      const exhausted = usage.remaining === 0;
      const error = exhausted
        ? `Anonim limit tugadi (${usage.charsUsed}/${usage.limit} belgi). Roʻyxatdan oʻtsangiz ${LIMITS.user} kredit bonus.`
        : `Limit yetarli emas: ${usage.remaining}/${usage.limit} belgi qoldi, siz ${charCount} belgi yubordingiz. Roʻyxatdan oʻtsangiz bonus olasiz.`;
      return NextResponse.json(
        { error, usage, requiresAuth: true },
        { status: 429 }
      );
    }
  }

  // ───── Shaxsiy ovoz (zero-shot klon) ─────
  // voice === "__me__" → foydalanuvchining reference klipini DB'dan olib F5'ga uzatamiz.
  // user_voice_id = kutubxonadagi konkret ovoz (Ronaldo, Messi ...); berilmasa eng yangisi.
  let f5Ref: F5Ref | null = null;
  // Shaxsiy ovoz faqat F5 orqali ishlaydi — checkpoint f5 bo'lmasa DB'ni bezovta qilmaymiz.
  if (voice === "__me__" && checkpoint_id === "f5") {
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Shaxsiy ovoz uchun tizimga kiring", requiresAuth: true },
        { status: 401 }
      );
    }
    f5Ref = await resolveUserVoiceRef(
      session.user.id,
      typeof body?.user_voice_id === "string" && body.user_voice_id
        ? body.user_voice_id
        : undefined
    );
    if (!f5Ref) {
      return NextResponse.json(
        {
          error:
            "Shaxsiy ovoz topilmadi. Avval \"Mening ovozim\" boʻlimida ovoz yarating.",
        },
        { status: 400 }
      );
    }
  }

  // ───── Sintez ─────
  // Dvigatel tanlash va backend chaqiruvi @/lib/tts-backend'da — ommaviy
  // /api/v1/tts bilan bir xil yo'l (ikki nusxa bo'lsa biri eskirardi).
  const engine: Engine = isEngine(checkpoint_id) ? checkpoint_id : "xtts";
  const out = await synthesizeOnBackend({
    text,
    engine,
    voice,
    speed,
    f5Ref,
    speaking_rate:
      typeof body?.speaking_rate === "number" ? body.speaking_rate : undefined,
    language,
    temperature,
    repetition_penalty,
    top_k,
    top_p,
    checkpointId: checkpoint_id,
  });

  if (!out.ok) {
    if (out.kind === "down") {
      return NextResponse.json(
        {
          error: "TTS backend bilan bog'lana olmadi",
          details: out.details,
          hint: BACKEND_DOWN_HINT,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `TTS server xatosi (${out.status})`, details: out.details },
      { status: 502 }
    );
  }

  const audioBuffer = out.audio;
  const synthTime = out.meta.synthTimeSec;

  // ───── Balans/limitni hisoblash + tarix saqlash ─────
  const usageHeaders: Record<string, string> = {};
  if (session?.user?.id) {
    // Admin / VIP — kredit yechilmaydi (cheksiz)
    if (unlimited) {
      usageHeaders["X-Credit-Balance"] = "unlimited";
    } else {
      // Kreditni yechish (atomik)
      const spend = await spendCredits(
        session.user.id,
        charCount,
        "synthesis",
        text.slice(0, 80)
      );
      usageHeaders["X-Credit-Balance"] = String(spend.balance);
    }
    // Sintez tarixiga yozish (har doim)
    await db.synthesis
      .create({
        data: {
          userId: session.user.id,
          text,
          // f5 -> "feruza"/"jonli"; "__me__" -> "myvoice"; mms -> "mms"; xtts -> voice.
          voice:
            checkpoint_id === "mms"
              ? "mms"
              : voice === "__me__"
                ? "myvoice"
                : voice,
          speed,
          charCount,
          durationSec: synthTime,
        },
      })
      .catch(() => undefined);
  } else {
    const nextUsage = await consumeAnonymousUsage(ipHash, charCount);
    usageHeaders["X-Usage-Limit"] = String(nextUsage.limit);
    usageHeaders["X-Usage-Used"] = String(nextUsage.charsUsed);
    usageHeaders["X-Usage-Remaining"] = String(nextUsage.remaining);
  }

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/wav",
      ...metaHeaders(out.meta),
      ...usageHeaders,
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET(request: Request) {
  try {
    const res = await fetch(`${TTS_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { available: false, error: `Backend ${res.status}` },
        { status: 503 }
      );
    }
    const data = await res.json();

    // Foydalanuvchi limiti
    const session = await auth();
    let usage;
    if (session?.user?.id) {
      usage = await getUserUsage(session.user.id, session.user.role);
    } else {
      const ipHash = hashIp(getClientIp(request.headers));
      usage = await getAnonymousUsage(ipHash);
    }

    return NextResponse.json({ available: true, ...data, usage });
  } catch (err) {
    return NextResponse.json(
      {
        available: false,
        error: err instanceof Error ? err.message : "unreachable",
      },
      { status: 503 }
    );
  }
}
