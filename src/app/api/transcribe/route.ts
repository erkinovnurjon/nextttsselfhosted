import { NextResponse } from "next/server";

const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

// Ovozli kiritish: WAV audio -> matn (Whisper, backend /transcribe)
export async function POST(request: Request) {
  const audio = await request.arrayBuffer();
  if (!audio || audio.byteLength < 1000) {
    return NextResponse.json({ error: "Audio juda qisqa yoki bo'sh" }, { status: 400 });
  }
  try {
    const res = await fetch(`${TTS_BACKEND_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: audio,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: `ASR xatosi (${res.status})`, details: t }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "ASR backend bilan bog'lana olmadi", details: err instanceof Error ? err.message : "" },
      { status: 502 }
    );
  }
}
