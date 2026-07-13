import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  writeVoiceReference,
  deleteVoiceFiles,
  saveVoiceImage,
  sanitizeVoiceName,
  newVoiceSlug,
  MIN_REF_SECONDS,
  MAX_VOICES_PER_USER,
} from "@/lib/voice";

const VOICE_SELECT = {
  id: true,
  name: true,
  imagePath: true,
  status: true,
  durationSec: true,
  createdAt: true,
  updatedAt: true,
} as const;

type VoiceRow = {
  id: string;
  name: string;
  imagePath: string | null;
  status: string;
  durationSec: number | null;
  createdAt: Date;
  updatedAt: Date;
};

// imagePath — server fayl yo'li, klientga chiqmaydi; o'rniga hasImage.
function toClient(v: VoiceRow) {
  const { imagePath, ...rest } = v;
  return { ...rest, hasImage: !!imagePath };
}

// GET — foydalanuvchining barcha shaxsiy ovozlari (yangi birinchi)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const voices = await db.userVoice.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: VOICE_SELECT,
  });
  return NextResponse.json({ voices: voices.map(toClient) });
}

// POST — yozilgan reference klipdan YANGI ovoz yaratish
// (multipart: audio, text, duration, name (majburiy), image (ixtiyoriy))
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
  const name = sanitizeVoiceName(form.get("name"));
  const image = form.get("image");

  if (!name) {
    return NextResponse.json(
      { error: "Ovozga nom kiriting (masalan: \"Mening ovozim\")." },
      { status: 400 }
    );
  }
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

  const count = await db.userVoice.count({ where: { userId } });
  if (count >= MAX_VOICES_PER_USER) {
    return NextResponse.json(
      { error: `Ko'pi bilan ${MAX_VOICES_PER_USER} ta ovoz saqlash mumkin. Avval keraksizini o'chiring.` },
      { status: 400 }
    );
  }

  const slug = newVoiceSlug();
  const buffer = Buffer.from(await audio.arrayBuffer());
  const refPath = await writeVoiceReference(userId, slug, buffer, refText);
  const imagePath =
    image instanceof Blob ? await saveVoiceImage(userId, slug, image) : null;

  // Yangi ovoz "draft" — foydalanuvchi sinab, "safga qo'shish" bilan tasdiqlaydi.
  // Sintez ro'yxatida faqat "ready" ovozlar chiqadi.
  const voice = await db.userVoice.create({
    data: { userId, name, imagePath, refPath, refText, status: "draft", durationSec },
    select: VOICE_SELECT,
  });

  return NextResponse.json({ voice: toClient(voice) });
}

// PATCH — draft ovozni tasdiqlash: modellar safiga qo'shish (status -> ready)
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Ovoz id kerak" }, { status: 400 });
  }

  const voice = await db.userVoice.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!voice) {
    return NextResponse.json({ error: "Ovoz topilmadi" }, { status: 404 });
  }

  const updated = await db.userVoice.update({
    where: { id: voice.id },
    data: { status: "ready" },
    select: VOICE_SELECT,
  });
  return NextResponse.json({ voice: toClient(updated) });
}

// DELETE — bitta ovozni o'chirish (?id=... yoki JSON {id})
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  let id = new URL(request.url).searchParams.get("id") || "";
  if (!id) {
    const body = await request.json().catch(() => ({}));
    id = typeof body?.id === "string" ? body.id : "";
  }
  if (!id) {
    return NextResponse.json({ error: "Ovoz id kerak" }, { status: 400 });
  }

  const voice = await db.userVoice.findFirst({
    where: { id, userId },
    select: { id: true, refPath: true },
  });
  if (!voice) {
    return NextResponse.json({ error: "Ovoz topilmadi" }, { status: 404 });
  }

  await db.userVoice.delete({ where: { id: voice.id } });
  await deleteVoiceFiles(userId, voice.refPath);
  return NextResponse.json({ ok: true });
}
