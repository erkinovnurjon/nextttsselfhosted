import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { auth } from "@/lib/auth";
import { isValidJobId, jobSegmentsPath } from "@/lib/dub";

// Dublyaj matni: har segment uchun {start, end, en, uz}.
// dub_video.py buni mp4 yoniga .segments.json qilib yozadi — tarjima sifatini
// ko'z bilan tekshirish uchun (NLLB ba'zan g'alizroq chiqaradi).
//
// Video marshrutidagidek: xotiradagi job Map'ga tayanmaymiz (u marshrutlar
// orasida bo'linmaydi) — yo'l sessiyadagi userId + tekshirilgan jobId'dan.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await ctx.params;
  if (!isValidJobId(id)) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  try {
    const raw = await fs.readFile(jobSegmentsPath(userId, id), "utf8");
    return NextResponse.json({ segments: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ error: "Matn topilmadi" }, { status: 404 });
  }
}
