import { NextResponse } from "next/server";

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

  try {
    const res = await fetch(`${TTS_BACKEND_URL}/synthesize`, {
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

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `TTS server xatosi (${res.status})`,
          details: errText,
          hint:
            "Python TTS server ishlamayapti bo'lishi mumkin. " +
            "Ishga tushirish: cd tts-server && .\\.venv\\Scripts\\python.exe -m uvicorn server.main:app --port 8000",
        },
        { status: 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "X-Synthesis-Time-Sec": res.headers.get("X-Synthesis-Time-Sec") || "",
        "X-Normalized-Text": res.headers.get("X-Normalized-Text") || "",
        "X-Original-Text": res.headers.get("X-Original-Text") || "",
        "X-Checkpoint-Id": res.headers.get("X-Checkpoint-Id") || "",
        "X-Model-Kind": res.headers.get("X-Model-Kind") || "",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "TTS backend bilan bog'lana olmadi",
        details: msg,
        hint:
          "Python TTS server ishlamayapti. " +
          "Ishga tushirish: cd tts-server && .\\.venv\\Scripts\\python.exe -m uvicorn server.main:app --port 8000",
      },
      { status: 502 }
    );
  }
}

export async function GET() {
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
    return NextResponse.json({ available: true, ...data });
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
