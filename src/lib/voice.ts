import { promises as fs } from "fs";
import path from "path";

// Klient-xavfsiz konstantalar (jumlalar + minimal davomiylik) shu yerdan re-export qilinadi,
// shunda /api ham, klient sahifa ham bir manbadan oladi.
export { REFERENCE_SENTENCES, MIN_REF_SECONDS } from "./voice-sentences";

// Shaxsiy ovoz reference fayllari: tts-server/voices/user_{id}/reference.wav (+ .txt).
// F5 server (python, :8001) AYNAN shu yo'ldan o'qiydi — web va TTS bitta mashinada
// (lokal dev / bitta-server prod). voices/ gitignore'da → foydalanuvchi audiosi maxfiy.
const VOICES_ROOT = path.join(process.cwd(), "tts-server", "voices");

export function userVoiceDir(userId: string): string {
  return path.join(VOICES_ROOT, `user_${userId}`);
}
export function userRefWavPath(userId: string): string {
  return path.join(userVoiceDir(userId), "reference.wav");
}
export function userRefTxtPath(userId: string): string {
  return path.join(userVoiceDir(userId), "reference.txt");
}

export async function writeUserReference(
  userId: string,
  wav: Buffer,
  refText: string
): Promise<string> {
  const dir = userVoiceDir(userId);
  await fs.mkdir(dir, { recursive: true });
  const wavPath = userRefWavPath(userId);
  await fs.writeFile(wavPath, wav);
  await fs.writeFile(userRefTxtPath(userId), refText, "utf8");
  return wavPath;
}

export async function deleteUserReferenceFiles(userId: string): Promise<void> {
  await fs.rm(userVoiceDir(userId), { recursive: true, force: true }).catch(
    () => undefined
  );
}
