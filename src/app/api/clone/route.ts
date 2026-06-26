import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  userVoiceDir,
  userRefWavPath,
  userRefTxtPath,
  deleteUserReferenceFiles,
} from "@/lib/voice";

// Mediadan (video/qo'shiq URL yoki yuklangan fayl) ovoz klonlash.
// Oqim: F5 :8001 /clone/extract (yt-dlp+ffmpeg+Demucs+segment) -> reference.wav
//   -> main :8000 /transcribe (ref_text) -> userVoice upsert -> sintez "__me__" yo'li.
// Web va TTS bitta mashinada (lokal/bitta-server) — fayl yo'llari umumiy disk orqali uzatiladi.
const F5_BACKEND_URL = process.env.F5_BACKEND_URL || "http://127.0.0.1:8001";
const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

// Ajratilgan klip uchun minimal davomiylik (sifatli klon uchun).
const MIN_CLONE_SECONDS = 4;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
  }
  const userId = session.user.id;

  // ── Manbani aniqlash: URL (JSON) yoki yuklangan fayl (multipart) ──
  let source = "";
  let tempFile: string | null = null;
  const ctype = request.headers.get("content-type") || "";

  try {
    if (ctype.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      source = (body.url || "").trim();
      if (!/^https?:\/\//.test(source)) {
        return NextResponse.json(
          { error: "Yaroqli URL kiriting (http/https)." },
          { status: 400 }
        );
      }
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof Blob) || file.size < 2000) {
        return NextResponse.json(
          { error: "Fayl yo'q yoki juda kichik." },
          { status: 400 }
        );
      }
      // Yuklangan faylni user papkasiga vaqtincha yozamiz (F5 shu yo'ldan o'qiydi).
      await fs.mkdir(userVoiceDir(userId), { recursive: true });
      const ext = (file instanceof File && path.extname(file.name)) || ".bin";
      tempFile = path.join(userVoiceDir(userId), `_src${ext}`);
      await fs.writeFile(tempFile, Buffer.from(await file.arrayBuffer()));
      source = tempFile;
    }
  } catch {
    return NextResponse.json({ error: "So'rov ma'lumoti yaroqsiz" }, { status: 400 });
  }

  const outPath = userRefWavPath(userId);

  try {
    // ── 1) Ajratish (F5 server) ──
    const exRes = await fetch(`${F5_BACKEND_URL}/clone/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, out_path: outPath, use_demucs: true }),
      signal: AbortSignal.timeout(300_000), // yuklab olish + demucs uzoq bo'lishi mumkin
    });
    const meta = await exRes.json().catch(() => ({}));
    if (!exRes.ok || meta?.error) {
      // 422 = sifat darvozasi (nutq yetarli emas) — F5 xabarini to'g'ridan ko'rsatamiz.
      const status = exRes.status === 422 ? 422 : 502;
      return NextResponse.json(
        { error: meta?.error || `Ajratish xatosi (${exRes.status})` },
        { status }
      );
    }
    const duration = Number(meta?.duration || 0);
    if (duration < MIN_CLONE_SECONDS) {
      return NextResponse.json(
        { error: `Ajratilgan ovoz juda qisqa (${duration.toFixed(1)}s). Boshqa manba sinab ko'ring.` },
        { status: 422 }
      );
    }

    // ── 2) Transkripsiya (main server Whisper) ──
    const wavBytes = await fs.readFile(outPath);
    let refText = "";
    try {
      const trRes = await fetch(`${TTS_BACKEND_URL}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(wavBytes),
        signal: AbortSignal.timeout(120_000),
      });
      const tr = await trRes.json().catch(() => ({}));
      refText = (tr?.text || "").trim();
    } catch {
      refText = "";
    }
    await fs.writeFile(userRefTxtPath(userId), refText, "utf8");

    // ── 3) userVoice upsert (sintez "__me__" shu slotdan o'qiydi) ──
    const voice = await db.userVoice.upsert({
      where: { userId },
      create: {
        userId,
        refPath: outPath,
        refText,
        status: "ready",
        durationSec: duration,
      },
      update: {
        refPath: outPath,
        refText,
        status: "ready",
        durationSec: duration,
      },
      select: { status: true, durationSec: true, createdAt: true, updatedAt: true },
    });

    // SNR past bo'lsa ogohlantiramiz (fon shovqini ko'p bo'lishi mumkin).
    const warning =
      Number(meta?.snr) < 10
        ? "Fon shovqini sezilarli bo'lishi mumkin — gapiradigan (kuylamaydigan) manba yaxshiroq natija beradi."
        : null;

    return NextResponse.json({ voice, meta, refText, warning });
  } catch (err) {
    // Xato bo'lsa yarim qolgan reference'ni tozalaymiz.
    await deleteUserReferenceFiles(userId).catch(() => undefined);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Klonlashda xato" },
      { status: 500 }
    );
  } finally {
    if (tempFile) await fs.rm(tempFile, { force: true }).catch(() => undefined);
  }
}
