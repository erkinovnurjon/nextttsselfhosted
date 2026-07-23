import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  userVoiceDir,
  voiceDir,
  voiceRefWavPath,
  saveVoiceImage,
  sanitizeVoiceName,
  newVoiceSlug,
  MAX_VOICES_PER_USER,
} from "@/lib/voice";

// Mediadan (video/qo'shiq URL yoki yuklangan fayllar) ovoz klonlash.
// Ikki rejim:
//   YANGI MODEL: nom majburiy, rasm ixtiyoriy, 1-4 manba -> eng sifatlisi g'olib,
//     yangi UserVoice "draft" holatida yaratiladi (sinash -> tasdiqlash oqimi).
//   YAXSHILASH (voice_id berilsa): mavjud model reference'i 0-kandidat (ANCHOR),
//     +1-3 yangi manba -> speaker-solishtirish anchorga bog'lanadi (boshqa odam
//     chetlatiladi), g'olib mavjud reference USTIGA yoziladi, DB yangilanadi.
// Oqim: F5 :8001 /clone/extract_multi -> main :8000 /transcribe -> DB.
// Web va TTS bitta mashinada — fayl yo'llari umumiy disk orqali uzatiladi.
const F5_BACKEND_URL = process.env.F5_BACKEND_URL || "http://127.0.0.1:8001";
const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

// Ajratilgan klip uchun minimal davomiylik (sifatli klon uchun).
const MIN_CLONE_SECONDS = 4;
// Bir so'rovda maksimal manbalar (har biri yuklab olish + Demucs = 1-2 daqiqa).
const MAX_CLONE_SOURCES = 4;
// Har manba uchun ajratish vaqti zahirasi (yuklab olish + demucs).
const EXTRACT_TIMEOUT_PER_SOURCE_MS = 300_000;

const VOICE_SELECT = {
  id: true,
  name: true,
  imagePath: true,
  status: true,
  durationSec: true,
  createdAt: true,
  updatedAt: true,
} as const;

function validUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => String(u ?? "").trim())
    .filter((u) => /^https?:\/\//.test(u));
}

function toClient(v: { imagePath: string | null } & Record<string, unknown>) {
  const { imagePath, ...rest } = v;
  return { ...rest, hasImage: !!imagePath };
}

async function transcribeRef(wavPath: string): Promise<string> {
  try {
    const wavBytes = await fs.readFile(wavPath);
    const trRes = await fetch(`${TTS_BACKEND_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(wavBytes),
      signal: AbortSignal.timeout(120_000),
    });
    const tr = await trRes.json().catch(() => ({}));
    return (tr?.text || "").trim();
  } catch {
    return "";
  }
}

// Ogohlantirishlar: SNR, boshqa-ovoz manbalar, o'tmagan manbalar.
// improveMode'da 0-kandidat = mavjud model (foydalanuvchi "manba" deb bilmaydi) —
// raqamlar yangi manbalar bo'yicha ko'rsatiladi.
function buildWarnings(meta: Record<string, unknown>, improveMode: boolean): string[] {
  const warnings: string[] = [];
  if (Number(meta?.snr) < 10) {
    warnings.push(
      "Fon shovqini sezilarli bo'lishi mumkin — gapiradigan (kuylamaydigan) manba yaxshiroq natija beradi."
    );
  }
  const label = (i: number) => (improveMode ? i : i + 1);
  const mism: number[] = Array.isArray(meta?.speaker_mismatch)
    ? (meta.speaker_mismatch as number[])
    : [];
  if (mism.length) {
    warnings.push(
      `${mism.map(label).join(", ")}-manba ovozi ${improveMode ? "modelga" : "boshqalarga"} o'xshamadi (boshqa odam bo'lishi mumkin) — hisobga olinmadi.`
    );
  }
  const failed: number[] = Array.isArray(meta?.candidates)
    ? (meta.candidates as { error?: string; index: number }[])
        .filter((c) => c.error)
        .map((c) => c.index)
    : [];
  if (failed.length) {
    warnings.push(`${failed.map(label).join(", ")}-manbadan nutq ajratib bo'lmadi.`);
  }
  return warnings;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  // ── Kirishni yig'ish: URL'lar + fayllar + (nom, rasm | voice_id) ──
  const newSources: string[] = [];
  const tempFiles: string[] = [];
  let name = "";
  let image: Blob | null = null;
  let voiceId = "";
  const ctype = request.headers.get("content-type") || "";

  try {
    if (ctype.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      name = sanitizeVoiceName(body.name);
      voiceId = typeof body.voice_id === "string" ? body.voice_id : "";
      newSources.push(...validUrls(body.urls ?? (body.url ? [body.url] : [])));
      if (!newSources.length) {
        return NextResponse.json(
          { error: "Yaroqli URL kiriting (http/https)." },
          { status: 400 }
        );
      }
    } else {
      const form = await request.formData();
      name = sanitizeVoiceName(form.get("name"));
      voiceId = typeof form.get("voice_id") === "string" ? (form.get("voice_id") as string) : "";
      const img = form.get("image");
      if (img instanceof Blob && img.size > 0) image = img;
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      const urls = validUrls(JSON.parse(String(form.get("urls") || "[]")));
      if (!files.length && !urls.length) {
        return NextResponse.json(
          { error: "Fayl tanlang yoki URL kiriting." },
          { status: 400 }
        );
      }
      for (const file of files) {
        if (file.size < 2000) {
          return NextResponse.json(
            { error: `"${file.name}" juda kichik fayl.` },
            { status: 400 }
          );
        }
      }
      // Yuklangan fayllarni user papkasiga vaqtincha yozamiz (F5 shu yo'ldan o'qiydi).
      await fs.mkdir(userVoiceDir(userId), { recursive: true });
      for (let i = 0; i < files.length; i++) {
        const ext = path.extname(files[i].name) || ".bin";
        const tmp = path.join(userVoiceDir(userId), `_src${i}${ext}`);
        await fs.writeFile(tmp, Buffer.from(await files[i].arrayBuffer()));
        tempFiles.push(tmp);
        newSources.push(tmp);
      }
      newSources.push(...urls);
    }
  } catch {
    return NextResponse.json({ error: "So'rov ma'lumoti yaroqsiz" }, { status: 400 });
  }

  const cleanupTemp = async () => {
    for (const tmp of tempFiles) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
    }
  };

  const improveMode = !!voiceId;

  // ── Rejimga xos tekshiruvlar ──
  let existing: { id: string; name: string; refPath: string } | null = null;
  if (improveMode) {
    existing = await db.userVoice.findFirst({
      where: { id: voiceId, userId },
      select: { id: true, name: true, refPath: true },
    });
    if (!existing) {
      await cleanupTemp();
      return NextResponse.json({ error: "Model topilmadi" }, { status: 404 });
    }
    if (newSources.length > MAX_CLONE_SOURCES - 1) {
      await cleanupTemp();
      return NextResponse.json(
        { error: `Yaxshilash uchun ko'pi bilan ${MAX_CLONE_SOURCES - 1} ta yangi manba yuboring.` },
        { status: 400 }
      );
    }
  } else {
    if (!name) {
      await cleanupTemp();
      return NextResponse.json(
        { error: "Ovozga nom kiriting (masalan: \"Ronaldo\")." },
        { status: 400 }
      );
    }
    if (newSources.length > MAX_CLONE_SOURCES) {
      await cleanupTemp();
      return NextResponse.json(
        { error: `Ko'pi bilan ${MAX_CLONE_SOURCES} ta manba yuboring.` },
        { status: 400 }
      );
    }
    const count = await db.userVoice.count({ where: { userId } });
    if (count >= MAX_VOICES_PER_USER) {
      await cleanupTemp();
      return NextResponse.json(
        { error: `Ko'pi bilan ${MAX_VOICES_PER_USER} ta ovoz saqlash mumkin. Avval keraksizini o'chiring.` },
        { status: 400 }
      );
    }
  }

  // Yangi model: alohida papka (xato bo'lsa faqat shu papka o'chadi).
  // Yaxshilash: g'olib MAVJUD reference ustiga yoziladi (extract_multi avval hamma
  // manbani o'qib bo'lib, faylni faqat OXIRIDA yozadi — o'qish/yozish to'qnashmaydi).
  const slug = improveMode ? "" : newVoiceSlug();
  const outPath = improveMode ? existing!.refPath : voiceRefWavPath(userId, slug);
  const sources = improveMode ? [existing!.refPath, ...newSources] : newSources;
  const cleanupVoiceDir = async () => {
    if (!improveMode) {
      await fs
        .rm(voiceDir(userId, slug), { recursive: true, force: true })
        .catch(() => undefined);
    }
  };

  try {
    // ── 1) Ajratish + eng yaxshisini tanlash (F5 server) ──
    const exRes = await fetch(`${F5_BACKEND_URL}/clone/extract_multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources,
        out_path: outPath,
        use_demucs: true,
        // Yaxshilashda 0-manba (joriy reference) = anchor: boshqa odam chetlatiladi.
        anchor_index: improveMode ? 0 : null,
      }),
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_PER_SOURCE_MS * sources.length),
    });
    const meta = await exRes.json().catch(() => ({}));
    if (!exRes.ok || meta?.error) {
      // 422 = sifat darvozasi (nutq yetarli emas) — F5 xabarini to'g'ridan ko'rsatamiz.
      const status = exRes.status === 422 ? 422 : 502;
      await cleanupVoiceDir();
      return NextResponse.json(
        { error: meta?.error || `Ajratish xatosi (${exRes.status})` },
        { status }
      );
    }
    const duration = Number(meta?.duration || 0);
    if (duration < MIN_CLONE_SECONDS) {
      await cleanupVoiceDir();
      return NextResponse.json(
        { error: `Ajratilgan ovoz juda qisqa (${duration.toFixed(1)}s). Boshqa manba sinab ko'ring.` },
        { status: 422 }
      );
    }

    // ── 2) Transkripsiya (main server Whisper) ──
    const refText = await transcribeRef(outPath);
    await fs.writeFile(outPath.replace(/\.wav$/, ".txt"), refText, "utf8");

    // ── 3) DB: yangi model yaratish YOKI mavjudni yangilash ──
    let voice;
    if (improveMode) {
      voice = await db.userVoice.update({
        where: { id: existing!.id },
        data: { refText, durationSec: duration },
        select: VOICE_SELECT,
      });
    } else {
      const imagePath = image ? await saveVoiceImage(userId, slug, image) : null;
      // "draft" — foydalanuvchi sinab ko'rib "safga qo'shish" bilan tasdiqlaydi.
      voice = await db.userVoice.create({
        data: {
          userId,
          name,
          imagePath,
          refPath: outPath,
          refText,
          status: "draft",
          durationSec: duration,
        },
        select: VOICE_SELECT,
      });
    }

    const warnings = buildWarnings(meta, improveMode);
    return NextResponse.json({
      voice: toClient(voice),
      meta,
      refText,
      improved: improveMode,
      keptExisting: improveMode && meta?.winner_index === 0,
      warning: warnings.length ? warnings.join(" ") : null,
    });
  } catch (err) {
    // Xato bo'lsa faqat YANGI ovoz papkasini tozalaymiz (yaxshilashda tegilmaydi).
    await cleanupVoiceDir();
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Klonlashda xato" },
      { status: 500 }
    );
  } finally {
    await cleanupTemp();
  }
}
