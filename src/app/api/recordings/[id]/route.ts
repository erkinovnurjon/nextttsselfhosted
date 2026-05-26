import { NextResponse } from "next/server";
import { deleteRecording, saveRecording } from "@/lib/dataset";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const formData = await request.formData();
  const file = formData.get("audio");
  const durationRaw = formData.get("duration");
  const sampleRateRaw = formData.get("sampleRate");

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Audio fayl yo'q" },
      { status: 400 }
    );
  }
  const duration = parseFloat(String(durationRaw ?? "0"));
  const sampleRate = parseInt(String(sampleRateRaw ?? "22050"), 10);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json(
      { error: "Audio davomiyligi noto'g'ri" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sentence = await saveRecording(id, buffer, { duration, sampleRate });
  if (!sentence) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ sentence });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sentence = await deleteRecording(id);
  if (!sentence) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ sentence });
}
