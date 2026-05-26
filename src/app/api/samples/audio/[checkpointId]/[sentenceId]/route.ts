import { NextResponse } from "next/server";

const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ checkpointId: string; sentenceId: string }> }
) {
  const { checkpointId, sentenceId } = await params;
  try {
    const res = await fetch(
      `${TTS_BACKEND_URL}/samples/audio/${encodeURIComponent(checkpointId)}/${encodeURIComponent(sentenceId)}`,
      {
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Backend ${res.status}` }, { status: 404 });
    }
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unreachable" },
      { status: 503 }
    );
  }
}
