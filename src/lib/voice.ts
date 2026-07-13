import { promises as fs } from "fs";
import path from "path";

// Klient-xavfsiz konstantalar (jumlalar + minimal davomiylik) shu yerdan re-export qilinadi,
// shunda /api ham, klient sahifa ham bir manbadan oladi.
export { REFERENCE_SENTENCES, MIN_REF_SECONDS } from "./voice-sentences";

// Shaxsiy ovozlar kutubxonasi: tts-server/voices/user_{id}/v_{slug}/reference.wav (+ .txt, avatar).
// F5 server (python, :8001) AYNAN shu yo'ldan o'qiydi — web va TTS bitta mashinada
// (lokal dev / bitta-server prod). voices/ gitignore'da → foydalanuvchi audiosi maxfiy.
// Eski bitta-slot davridan qolgan ovozlar user_{id}/reference.wav'da bo'lishi mumkin —
// DB'dagi refPath manba, o'chirishda legacy holat alohida ko'riladi.
const VOICES_ROOT = path.join(process.cwd(), "tts-server", "voices");

export const MAX_VOICES_PER_USER = 8;

export function userVoiceDir(userId: string): string {
  return path.join(VOICES_ROOT, `user_${userId}`);
}

/** Yangi ovoz uchun papka nomi (DB id'dan mustaqil — refPath DB'da saqlanadi). */
export function newVoiceSlug(): string {
  return `v_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function voiceDir(userId: string, slug: string): string {
  return path.join(userVoiceDir(userId), slug);
}
export function voiceRefWavPath(userId: string, slug: string): string {
  return path.join(voiceDir(userId, slug), "reference.wav");
}
export function voiceRefTxtPath(userId: string, slug: string): string {
  return path.join(voiceDir(userId, slug), "reference.txt");
}

// Ovoz nomi cheklovi
export const VOICE_NAME_MAX = 40;

/** Nomni tozalash: bitta qatorga, bo'shliqlarni yig'ish, uzunlikni cheklash. */
export function sanitizeVoiceName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VOICE_NAME_MAX);
}

// ── Avatar rasm ──
export const VOICE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Avatar rasmni ovoz papkasiga saqlaydi. Yaroqsiz tur/hajm bo'lsa null
 * (rasm ixtiyoriy — xato sabab butun oqimni to'xtatmaymiz).
 */
export async function saveVoiceImage(
  userId: string,
  slug: string,
  image: Blob
): Promise<string | null> {
  const ext = IMAGE_EXT_BY_MIME[image.type];
  if (!ext || image.size <= 0 || image.size > VOICE_IMAGE_MAX_BYTES) return null;
  const dir = voiceDir(userId, slug);
  await fs.mkdir(dir, { recursive: true });
  const imagePath = path.join(dir, `avatar${ext}`);
  await fs.writeFile(imagePath, Buffer.from(await image.arrayBuffer()));
  return imagePath;
}

export async function writeVoiceReference(
  userId: string,
  slug: string,
  wav: Buffer,
  refText: string
): Promise<string> {
  const dir = voiceDir(userId, slug);
  await fs.mkdir(dir, { recursive: true });
  const wavPath = voiceRefWavPath(userId, slug);
  await fs.writeFile(wavPath, wav);
  await fs.writeFile(voiceRefTxtPath(userId, slug), refText, "utf8");
  return wavPath;
}

/**
 * Bitta ovozning fayllarini o'chiradi (refPath'dan kelib chiqib).
 * Yangi format: user_{id}/v_xxx/ — butun papka o'chadi.
 * Legacy (bitta-slot): user_{id}/reference.wav — faqat o'sha fayllar o'chadi,
 * user papkasi qoladi (boshqa ovozlar bor bo'lishi mumkin).
 */
export async function deleteVoiceFiles(
  userId: string,
  refPath: string
): Promise<void> {
  const userDir = userVoiceDir(userId);
  const parent = path.dirname(refPath);
  // Xavfsizlik: faqat shu foydalanuvchi papkasi ichidagi yo'llar o'chiriladi.
  if (!parent.startsWith(userDir)) return;
  if (path.basename(parent).startsWith("v_")) {
    await fs.rm(parent, { recursive: true, force: true }).catch(() => undefined);
  } else {
    for (const f of ["reference.wav", "reference.txt", "name.txt"]) {
      await fs.rm(path.join(userDir, f), { force: true }).catch(() => undefined);
    }
  }
}
