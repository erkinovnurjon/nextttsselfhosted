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

  // ───── Sintez ─────
  let backendRes: Response;
  try {
    if (checkpoint_id === "mms") {
      const speaking_rate =
        typeof body?.speaking_rate === "number" ? body.speaking_rate : undefined;
      backendRes = await fetch(`${TTS_BACKEND_URL}/synthesize/mms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, normalize: true, speaking_rate, voice }),
        signal: AbortSignal.timeout(120_000),
      });
    } else {
      backendRes = await fetch(`${TTS_BACKEND_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          voice,
          speed,
          temperature,
          repetition_penalty,
          top_k,
          top_p,
          checkpoint_id,
        }),
        signal: AbortSignal.timeout(180_000),
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "TTS backend bilan bog'lana olmadi",
        details: err instanceof Error ? err.message : "Unknown error",
        hint:
          "Python TTS server ishlamayapti. " +
          "Ishga tushirish: cd tts-server && .\\.venv\\Scripts\\python.exe -m uvicorn server.main:app --port 8000",
      },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    const errText = await backendRes.text().catch(() => "");
    return NextResponse.json(
      {
        error: `TTS server xatosi (${backendRes.status})`,
        details: errText,
      },
      { status: 502 }
    );
  }

  const audioBuffer = await backendRes.arrayBuffer();
  const synthTime = parseFloat(
    backendRes.headers.get("X-Synthesis-Time-Sec") || "0"
  );

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
          voice: checkpoint_id === "mms" ? "mms" : voice,
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
      "X-Synthesis-Time-Sec": backendRes.headers.get("X-Synthesis-Time-Sec") || "",
      "X-Normalized-Text": backendRes.headers.get("X-Normalized-Text") || "",
      "X-Original-Text": backendRes.headers.get("X-Original-Text") || "",
      "X-Checkpoint-Id":
        backendRes.headers.get("X-Checkpoint-Id") || checkpoint_id || "",
      "X-Model-Kind": backendRes.headers.get("X-Model-Kind") || "",
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
