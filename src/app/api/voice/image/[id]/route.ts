import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Ovoz avatari — voices/ papkasi public emas, shu route orqali xavfsiz beriladi
// (faqat egasiga; yo'l DB'dan olinadi, klientdan path kelmaydi).
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const { id } = await params;

  const voice = await db.userVoice.findFirst({
    where: { id, userId: session.user.id },
    select: { imagePath: true },
  });
  if (!voice?.imagePath) {
    return NextResponse.json({ error: "Rasm topilmadi" }, { status: 404 });
  }

  try {
    const buf = await fs.readFile(voice.imagePath);
    const mime =
      MIME_BY_EXT[path.extname(voice.imagePath).toLowerCase()] ||
      "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        // Rasm o'zgarmas (yaratishda bir marta yoziladi) — brauzer keshiga ruxsat
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Rasm o'qilmadi" }, { status: 404 });
  }
}
