import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import {
  canStart,
  getJob,
  jobDir,
  listUserJobs,
  newJobId,
  startJob,
  userActiveJob,
  cancelJob,
  MAX_VIDEO_BYTES,
} from "@/lib/dub";

// Video dublyaj: ingliz video -> o'zbekcha voiceover.
//   POST   /api/dub          -> job boshlaydi (fayl yuklash yoki URL), jobId qaytaradi
//   GET    /api/dub          -> foydalanuvchining joblari (ro'yxat)
//   GET    /api/dub?id=...   -> bitta jobning holati/progressi
//   DELETE /api/dub?id=...   -> ishlayotgan jobni bekor qiladi
// Og'ir ish alohida python jarayonida ketadi (qarang: src/lib/dub.ts).

const ALLOWED_TRANSLATORS = new Set(["nllb", "claude"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  // Bir foydalanuvchida bitta faol job — tasodifan ikki marta bosishdan himoya.
  const mine = userActiveJob(userId);
  if (mine) {
    return NextResponse.json(
      { error: "Sizda allaqachon ishlayotgan dublyaj bor.", jobId: mine.id },
      { status: 409 }
    );
  }
  // GPU sig'imi — global cheklov.
  const gate = canStart();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov (formData kutilgan)" }, { status: 400 });
  }

  const translatorRaw = String(form.get("translator") || "nllb");
  const translator = ALLOWED_TRANSLATORS.has(translatorRaw)
    ? (translatorRaw as "nllb" | "claude")
    : "nllb";

  const duckRaw = Number(form.get("duck"));
  const duck = Number.isFinite(duckRaw) ? Math.min(1, Math.max(0, duckRaw)) : 0.18;

  const urlRaw = String(form.get("url") || "").trim();
  const file = form.get("file");

  const jobId = newJobId();
  const dir = jobDir(userId, jobId);
  await fs.mkdir(dir, { recursive: true });

  let source: string;
  let sourceName: string;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_VIDEO_BYTES) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      const mb = Math.round(MAX_VIDEO_BYTES / 1024 / 1024);
      return NextResponse.json(
        { error: `Video juda katta — ${mb} MB gacha ruxsat.` },
        { status: 413 }
      );
    }
    // Kengaytmani saqlaymiz — ffmpeg konteynerni shu bo'yicha aniqlaydi.
    const ext = path.extname(file.name).slice(0, 8) || ".mp4";
    const saved = path.join(dir, `source${ext}`);
    await fs.writeFile(saved, Buffer.from(await file.arrayBuffer()));
    source = saved;
    sourceName = file.name;
  } else if (urlRaw) {
    let parsed: URL;
    try {
      parsed = new URL(urlRaw);
    } catch {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json({ error: "URL noto'g'ri." }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json({ error: "Faqat http/https URL qabul qilinadi." }, { status: 400 });
    }
    source = parsed.toString();
    sourceName = parsed.pathname.split("/").pop() || parsed.hostname;
  } else {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: "Video fayl yoki URL kerak." }, { status: 400 });
  }

  const job = startJob({ userId, jobId, source, sourceName, translator, duck });
  return NextResponse.json({ job });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ jobs: listUserJobs(userId) });
  }

  const job = getJob(id);
  // Boshqa foydalanuvchining jobi = mavjud emas (id sanab topilmasin).
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });

  const job = getJob(id);
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const stopped = cancelJob(id);
  return NextResponse.json({ ok: stopped, job: getJob(id) });
}
