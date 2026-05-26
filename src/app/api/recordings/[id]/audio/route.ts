import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { loadSentences, getAudioFullPath } from "@/lib/dataset";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sentences = await loadSentences();
  const sentence = sentences.find((s) => s.id === id);
  if (!sentence || !sentence.audioPath) {
    return NextResponse.json({ error: "Audio yo'q" }, { status: 404 });
  }
  try {
    const buffer = await fs.readFile(getAudioFullPath(sentence.audioPath));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }
}
