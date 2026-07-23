import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// ────────────────────────────────────────────────
// Video dublyaj (EN -> o'zbekcha voiceover) job boshqaruvi.
//
// Nega alohida JARAYON (in-process emas): dub_video.py Whisper'ni GPU'ga
// yuklaydi, TTS backend (:8000) esa MMS'ni GPU'da ushlab turadi. Ikkalasi BITTA
// python jarayonida turganda segfault bo'lgan (shu sabab mikrofon ASR ham CPU'da).
// Alohida jarayon = alohida CUDA konteksti = xavfsiz.
//
// Nega JOB (oddiy so'rov emas): pipeline daqiqalar davom etadi (ffmpeg -> Whisper
// -> NLLB -> Piper -> mux). HTTP so'rovi buni kutib turolmaydi, foydalanuvchi esa
// jim ekranga qarab o'tirmasligi kerak — skript progress chiqaradi, biz uni
// stdout'dan o'qib bosqichma-bosqich ko'rsatamiz.
// ────────────────────────────────────────────────

const TTS_DIR = path.join(process.cwd(), "tts-server");
const PYTHON = path.join(TTS_DIR, ".venv", "Scripts", "python.exe");
const SCRIPT = path.join(TTS_DIR, "scripts", "dub_video.py");

/** Dublyaj natijalari: tts-server/dubs/user_{id}/{jobId}/ (voices/ konvensiyasidek). */
const DUBS_ROOT = path.join(TTS_DIR, "dubs");

/**
 * GPU'da bir vaqtda FAQAT bitta dublyaj. Bitta job ~6 GB VRAM oladi
 * (whisper-large-v3 ~3 + NLLB ~2.4 + Demucs, ustiga MMS allaqachon ~1.9).
 * O'lchangan: to'liq yugurishda 5.9 GB / 12 GB. Ikkinchi job OOM'ga olib keladi —
 * pilot uchun navbat emas, ochiq rad javob.
 */
const MAX_ACTIVE_JOBS = 1;

/** Yuklanadigan video uchun chegara (pilot). */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** Eski joblarni tozalash — shundan ko'pi saqlanmaydi (har biri mp4 = disk). */
const MAX_JOBS_PER_USER = 5;

export type DubStage =
  | "queued"
  | "audio"
  | "asr"
  | "translate"
  | "tts"
  | "mux"
  | "done"
  | "error";

export interface DubJob {
  id: string;
  userId: string;
  stage: DubStage;
  /** TTS bosqichidagi segment progressi (0..segmentsTotal). */
  segmentsDone: number;
  segmentsTotal: number;
  durationSec: number;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  /** Oxirgi log qatorlari — xato bo'lsa foydalanuvchi sababini ko'radi. */
  log: string[];
  sourceName: string;
  translator: string;
}

interface JobInternal extends DubJob {
  proc: ChildProcess | null;
}

/**
 * Jarayon xotirasidagi job'lar. Pilot = bitta instans, shuning uchun Map yetarli;
 * ko'p instansli prod'da bu Redis/DB'ga ko'chishi kerak (server qayta yuklansa
 * job'lar yo'qoladi — natija fayli diskda qoladi, lekin ro'yxatda ko'rinmaydi).
 */
const jobs = new Map<string, JobInternal>();

export function jobDir(userId: string, jobId: string): string {
  return path.join(DUBS_ROOT, `user_${userId}`, jobId);
}
export function jobVideoPath(userId: string, jobId: string): string {
  return path.join(jobDir(userId, jobId), "dub.mp4");
}
export function jobSegmentsPath(userId: string, jobId: string): string {
  return `${jobVideoPath(userId, jobId)}.segments.json`;
}

export function newJobId(): string {
  return `d_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * jobId shaklini tekshiradi.
 *
 * Fayl uzatuvchi marshrutlar (video/segments) job'ni XOTIRADAN qidirmaydi:
 * Next.js'da har marshrut alohida modul bundle'i bo'lib, `jobs` Map ular orasida
 * BO'LINMAYDI (holat marshruti ko'rgan job'ni video marshruti ko'rmaydi -> 404).
 * Shuning uchun ular yo'lni sessiyadagi userId + jobId'dan yig'ib, diskka
 * qaraydi. Bu server qayta yuklangandan keyin ham ishlaydi.
 *
 * userId sessiyadan keladi (ishonchli), jobId esa URL'dan — ya'ni yagona xavf
 * yo'ldan chiqish ("../"). Shaklni qat'iy tekshirib, uni yopamiz.
 */
export function isValidJobId(id: string): boolean {
  return /^d_[a-f0-9]{12}$/.test(id);
}

export function getJob(id: string): DubJob | undefined {
  const j = jobs.get(id);
  if (!j) return undefined;
  const { proc: _proc, ...pub } = j;
  return pub;
}

export function listUserJobs(userId: string): DubJob[] {
  return [...jobs.values()]
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ proc: _proc, ...pub }) => pub);
}

export function activeJobCount(): number {
  return [...jobs.values()].filter((j) => j.stage !== "done" && j.stage !== "error").length;
}

export function userActiveJob(userId: string): DubJob | undefined {
  return listUserJobs(userId).find((j) => j.stage !== "done" && j.stage !== "error");
}

export function canStart(): { ok: boolean; reason?: string } {
  if (activeJobCount() >= MAX_ACTIVE_JOBS) {
    return {
      ok: false,
      reason:
        "Hozir boshqa dublyaj ishlanmoqda. Videolar GPU'ni to'liq band qiladi, " +
        "shuning uchun bir vaqtda bittasi bajariladi — tugashini kuting.",
    };
  }
  return { ok: true };
}

// ───────────────────── stdout -> bosqich ─────────────────────

/**
 * dub_video.py progressni stdout'ga bosib chiqaradi. Emoji'ga emas, o'zbekcha
 * matn bo'lagiga qaraymiz — konsol kodlash muammosida emoji buzilishi mumkin,
 * matn esa qoladi.
 */
function parseStage(line: string): DubStage | null {
  if (line.includes("Audio ajratilmoqda")) return "audio";
  if (line.includes("Ingliz nutq aniqlanmoqda")) return "asr";
  if (line.includes("Tarjima (")) return "translate";
  if (line.includes("zbekcha ovoz yozilmoqda")) return "tts";
  if (line.includes("Video yig")) return "mux";
  if (line.includes("Dublyaj tayyor:")) return "done";
  return null;
}

const RE_SEGMENTS = /^\s*(\d+) segment, ([\d.]+)s video/;
const RE_TTS_PROGRESS = /^\s*\[(\d+)\/(\d+)\]/;

function applyLine(job: JobInternal, line: string): void {
  const trimmed = line.trimEnd();
  if (!trimmed) return;

  job.log.push(trimmed);
  if (job.log.length > 40) job.log.splice(0, job.log.length - 40);

  const stage = parseStage(trimmed);
  if (stage) job.stage = stage;

  const segs = RE_SEGMENTS.exec(trimmed);
  if (segs) {
    job.segmentsTotal = Number(segs[1]);
    job.durationSec = Number(segs[2]);
  }

  const prog = RE_TTS_PROGRESS.exec(trimmed);
  if (prog) {
    job.segmentsDone = Number(prog[1]);
    job.segmentsTotal = Number(prog[2]);
  }
}

// ───────────────────── ishga tushirish ─────────────────────

export interface StartOptions {
  userId: string;
  jobId: string;
  /** Video fayl yo'li (yuklangan) yoki URL. */
  source: string;
  sourceName: string;
  translator: "nllb" | "claude";
  /** Original ovoz balandligi fon sifatida (0..1). */
  duck: number;
}

export function startJob(opts: StartOptions): DubJob {
  const out = jobVideoPath(opts.userId, opts.jobId);
  const job: JobInternal = {
    id: opts.jobId,
    userId: opts.userId,
    stage: "queued",
    segmentsDone: 0,
    segmentsTotal: 0,
    durationSec: 0,
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    log: [],
    sourceName: opts.sourceName,
    translator: opts.translator,
    proc: null,
  };
  jobs.set(opts.jobId, job);

  const proc = spawn(
    PYTHON,
    [
      SCRIPT,
      "--source", opts.source,
      "--out", out,
      "--translator", opts.translator,
      "--duck", String(opts.duck),
    ],
    {
      cwd: TTS_DIR,
      // PYTHONUTF8: o'zbekcha matn/emoji Windows konsolida buzilmasligi uchun.
      // PYTHONUNBUFFERED: progress qatorlari bufer'da qolib ketmasligi uchun —
      // aks holda progress faqat oxirida to'p bo'lib keladi.
      env: { ...process.env, PYTHONUTF8: "1", PYTHONUNBUFFERED: "1" },
    }
  );
  job.proc = proc;

  let stdoutBuf = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString("utf8");
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const l of lines) applyLine(job, l);
  });

  // Python traceback stderr'ga chiqadi — xato sababi shu yerda bo'ladi.
  let stderrBuf = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString("utf8");
    if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
  });

  proc.on("error", (err) => {
    job.stage = "error";
    job.error = `Dublyaj jarayonini ishga tushirib bo'lmadi: ${err.message}`;
    job.finishedAt = Date.now();
  });

  proc.on("close", (code) => {
    if (stdoutBuf.trim()) applyLine(job, stdoutBuf);
    job.proc = null;
    job.finishedAt = Date.now();
    if (job.stage === "error") return;

    if (code === 0 && job.stage === "done") {
      void cleanupOldJobs(opts.userId);
      return;
    }
    job.stage = "error";
    job.error = explainFailure(code, stderrBuf, job.log);
  });

  return getJob(opts.jobId)!;
}

/**
 * Python xatosidan foydalanuvchiga ma'noli sabab ajratadi. Xom traceback'ni
 * ko'rsatish foydasiz — oxirgi qator odatda asosiy sabab bo'ladi.
 */
function explainFailure(code: number | null, stderr: string, log: string[]): string {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Ma'lum, tez-tez uchraydigan sabablar — aniq maslahat bilan.
  const all = stderr + "\n" + log.join("\n");
  if (all.includes("Nutq topilmadi")) {
    return "Videoda ingliz nutqi topilmadi — u jim yoki faqat musiqa bo'lishi mumkin.";
  }
  if (/ffmpeg/i.test(all) && /not found|topilmadi|No such file/i.test(all)) {
    return "ffmpeg topilmadi. Uni o'rnating yoki FFMPEG_BIN muhit o'zgaruvchisini ko'rsating.";
  }
  if (all.includes("ANTHROPIC_API_KEY")) {
    return "Claude tarjimasi uchun ANTHROPIC_API_KEY yo'q. NLLB (lokal) tarjimani tanlang.";
  }
  if (/CUDA out of memory|OutOfMemoryError/i.test(all)) {
    return "GPU xotirasi yetmadi. Qisqaroq video sinab ko'ring yoki boshqa modellarni bo'shating.";
  }
  if (/urlopen error|HTTPConnectionPool.*8002|Connection refused/i.test(all)) {
    return "Piper ovoz serveri (8002) javob bermadi — u ishlayotganini tekshiring.";
  }

  const last = lines[lines.length - 1] || "";
  const detail = last.length > 300 ? `${last.slice(0, 300)}…` : last;
  return detail
    ? `Dublyaj bajarilmadi (kod ${code}): ${detail}`
    : `Dublyaj bajarilmadi (kod ${code}).`;
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job?.proc) return false;
  job.proc.kill();
  job.stage = "error";
  job.error = "Bekor qilindi.";
  job.finishedAt = Date.now();
  return true;
}

/** Eski job papkalarini o'chiradi — mp4'lar diskni to'ldirmasligi uchun. */
async function cleanupOldJobs(userId: string): Promise<void> {
  const mine = listUserJobs(userId).filter((j) => j.stage === "done");
  for (const old of mine.slice(MAX_JOBS_PER_USER)) {
    await fs.rm(jobDir(userId, old.id), { recursive: true, force: true }).catch(() => {});
    jobs.delete(old.id);
  }
}
