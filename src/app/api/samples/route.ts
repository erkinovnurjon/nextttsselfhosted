import { NextResponse } from "next/server";

const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${TTS_BACKEND_URL}/samples`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend ${res.status}`, checkpoints: [], sentences: [] },
        { status: 502 }
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "unreachable",
        checkpoints: [],
        sentences: [],
      },
      { status: 503 }
    );
  }
}
