import { db } from "@/lib/db";

// ────────────────────────────────────────────────
// Python TTS backend bilan muloqot — YAGONA joy.
//
// Nega alohida modul: ichki `/api/tts` (sessiya bilan) va ommaviy `/api/v1/tts`
// (API kalit bilan) bir xil dvigatellarga murojaat qiladi. Tarmoqlanishni ikki
// marta yozsak, yangi dvigatel qo'shilganda biri unutiladi va jimgina eskiradi.
// Autentifikatsiya/kredit — marshrutlarniki; dvigatel tanlash — bu yerda.
// ────────────────────────────────────────────────

const TTS_BACKEND_URL = process.env.TTS_BACKEND_URL || "http://127.0.0.1:8000";

/** Sintez dvigatellari. `xtts` — eski ko'p tilli yo'l (checkpoint_id berilmasa). */
export type Engine = "mms" | "f5" | "piper" | "xtts";

export const ENGINES: readonly Engine[] = ["mms", "f5", "piper", "xtts"] as const;

export function isEngine(v: unknown): v is Engine {
  return typeof v === "string" && (ENGINES as readonly string[]).includes(v);
}

export interface F5Ref {
  ref_wav: string;
  ref_text: string;
}

export interface SynthesisParams {
  text: string;
  engine: Engine;
  voice: string;
  speed: number;
  /** F5 zero-shot klon uchun reference klip. Faqat serverda hal qilinadi. */
  f5Ref?: F5Ref | null;
  /** MMS uchun. */
  speaking_rate?: number;
  /** xtts uchun. */
  language?: string;
  temperature?: number;
  repetition_penalty?: number;
  top_k?: number;
  top_p?: number;
  /**
   * xtts uchun aniq checkpoint (trening natijalari: v4, v5 ...). engine="xtts"
   * bo'lganda backend'ga o'zi uzatiladi; boshqa dvigatellarda ma'nosiz.
   */
  checkpointId?: string;
}

export interface BackendMeta {
  synthTimeSec: number;
  normalizedText: string;
  originalText: string;
  checkpointId: string;
  modelKind: string;
}

export type BackendOutcome =
  | { ok: true; audio: ArrayBuffer; meta: BackendMeta }
  /** Backend umuman javob bermadi (server ko'tarilmagan). */
  | { ok: false; kind: "down"; details: string }
  /** Backend javob berdi, lekin xato bilan. */
  | { ok: false; kind: "error"; status: number; details: string };

/** F5 diffuziya — sekinroq, shuning uchun uzunroq kutamiz. */
const TIMEOUT_MS: Record<Engine, number> = {
  mms: 120_000,
  piper: 120_000,
  f5: 180_000,
  xtts: 180_000,
};

export const BACKEND_DOWN_HINT =
  "Python TTS server ishlamayapti. " +
  "Ishga tushirish: cd tts-server && .\\.venv\\Scripts\\python.exe -m uvicorn server.main:app --port 8000";

function endpointFor(engine: Engine): string {
  return engine === "xtts"
    ? `${TTS_BACKEND_URL}/synthesize`
    : `${TTS_BACKEND_URL}/synthesize/${engine}`;
}

function bodyFor(p: SynthesisParams): Record<string, unknown> {
  switch (p.engine) {
    case "mms":
      return {
        text: p.text,
        normalize: true,
        speaking_rate: p.speaking_rate,
        voice: p.voice,
      };
    case "f5":
      // voice = reference tanlovi ("feruza"/"jonli"/"ayol"); f5Ref bo'lsa
      // foydalanuvchining o'z klipi bilan zero-shot klon.
      return { text: p.text, speed: p.speed, voice: p.voice, ...(p.f5Ref ?? {}) };
    case "piper":
      // Piper tezlikni length_scale bilan boshqaradi: kichikroq = tezroq.
      return {
        text: p.text,
        length_scale: p.speed > 0 ? 1 / p.speed : 1,
      };
    case "xtts":
      return {
        text: p.text,
        language: p.language ?? "tr",
        voice: p.voice,
        speed: p.speed,
        temperature: p.temperature ?? 0.65,
        repetition_penalty: p.repetition_penalty ?? 5.0,
        top_k: p.top_k ?? 50,
        top_p: p.top_p ?? 0.85,
        checkpoint_id: p.checkpointId,
      };
  }
}

/** Sintez qiladi. Xatolarni tashlamaydi — natijani union sifatida qaytaradi. */
export async function synthesizeOnBackend(
  p: SynthesisParams
): Promise<BackendOutcome> {
  let res: Response;
  try {
    res = await fetch(endpointFor(p.engine), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyFor(p)),
      signal: AbortSignal.timeout(TIMEOUT_MS[p.engine]),
    });
  } catch (err) {
    return {
      ok: false,
      kind: "down",
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    return { ok: false, kind: "error", status: res.status, details };
  }

  const audio = await res.arrayBuffer();
  return {
    ok: true,
    audio,
    meta: {
      synthTimeSec: parseFloat(res.headers.get("X-Synthesis-Time-Sec") || "0"),
      normalizedText: res.headers.get("X-Normalized-Text") || "",
      originalText: res.headers.get("X-Original-Text") || "",
      // Backend sarlavha yubormasa: so'ralgan checkpoint (xtts'da "v4" kabi),
      // u ham bo'lmasa dvigatel nomi.
      checkpointId: res.headers.get("X-Checkpoint-Id") || p.checkpointId || p.engine,
      modelKind: res.headers.get("X-Model-Kind") || "",
    },
  };
}

/**
 * Foydalanuvchining shaxsiy ovoz reference klipini DB'dan oladi.
 *
 * XAVFSIZLIK: ref_wav HECH QACHON mijozdan kelmaydi — faqat shu yerda, DB'dan.
 * Aks holda mijoz ixtiyoriy fayl yo'lini yuborib serverdagi boshqa fayllarni
 * o'qitishi mumkin edi (path injection).
 */
export async function resolveUserVoiceRef(
  userId: string,
  userVoiceId?: string
): Promise<F5Ref | null> {
  // Aniq id berilsa draft ham sintez qilinadi ("Sinash" tugmasi);
  // id'siz (fallback eng yangi) — faqat tasdiqlangan ovoz.
  const uv = await db.userVoice.findFirst({
    where: {
      userId,
      ...(userVoiceId
        ? { id: userVoiceId, status: { in: ["ready", "draft"] } }
        : { status: "ready" }),
    },
    orderBy: { createdAt: "desc" },
    select: { refPath: true, refText: true },
  });
  return uv ? { ref_wav: uv.refPath, ref_text: uv.refText } : null;
}

/** Sintez javobiga qo'yiladigan meta-sarlavhalar. */
export function metaHeaders(meta: BackendMeta): Record<string, string> {
  return {
    "X-Synthesis-Time-Sec": String(meta.synthTimeSec || ""),
    "X-Normalized-Text": meta.normalizedText,
    "X-Original-Text": meta.originalText,
    "X-Checkpoint-Id": meta.checkpointId,
    "X-Model-Kind": meta.modelKind,
  };
}
