import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  writeUserReference,
  deleteUserReferenceFiles,
  MIN_REF_SECONDS,
} from "@/lib/voice";

// GET — joriy foydalanuvchining shaxsiy ovozi (yoki null)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const voice = await db.userVoice.findUnique({
    where: { userId: session.user.id },
    select: { status: true, durationSec: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ voice });
}

// POST — yozilgan reference klipni saqlash (multipart: audio, text, duration)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form ma'lumoti yaroqsiz" }, { status: 400 });
  }

  const audio = form.get("audio");
  const refText = (form.get("text") as string | null)?.trim() || "";
  const durationSec = parseFloat((form.get("duration") as string) || "0") || 0;

  if (!(audio instanceof Blob) || audio.size < 2000) {
    return NextResponse.json(
      { error: "Audio yo'q yoki juda qisqa. Mikrofon yozuvini tekshiring." },
      { status: 400 }
    );
  }
  if (!refText) {
    return NextResponse.json(
      { error: "Reference matni bo'sh (o'qilgan jumlalar)" },
      { status: 400 }
    );
  }
  // Davomiylik yo'q/buzuq (0) bo'lsa ham rad etamiz — aks holda qisqa klip "ready" saqlanardi.
  if (!durationSec || durationSec < MIN_REF_SECONDS) {
    return NextResponse.json(
      {
        error: `Yozuv juda qisqa (${durationSec.toFixed(
          0
        )}s). Sifatli klon uchun kamida ${MIN_REF_SECONDS}s o'qing.`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const refPath = await writeUserReference(userId, buffer, refText);

  const voice = await db.userVoice.upsert({
    where: { userId },
    create: { userId, refPath, refText, status: "ready", durationSec },
    update: { refPath, refText, status: "ready", durationSec },
    select: { status: true, durationSec: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ voice });
}

// DELETE — shaxsiy ovozni o'chirish
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;
  await db.userVoice.deleteMany({ where: { userId } });
  await deleteUserReferenceFiles(userId);
  return NextResponse.json({ ok: true });
}
