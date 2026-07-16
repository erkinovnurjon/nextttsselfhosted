// ────────────────────────────────────────────────
// NextTTS — /api/tts uchun umumiy klient
// Uchala sintez sahifasida (sintez / voice-lab / my-voice) takrorlanadigan
// POST + blob mantiqini birlashtiradi. Xulq AYNAN saqlanadi:
//   - so'rov URL/method/header/body o'zgarmaydi
//   - xato matni har sahifaning o'zinikidek qoladi (errorFallback orqali)
//   - response headerlari xom holda qaytariladi (decode kerak bo'lsa chaqiruvchi qiladi)
// ────────────────────────────────────────────────

export interface TtsResult {
  blob: Blob;
  url: string;
  timeSec: number;
  normalizedText: string;
  modelKind: string;
  checkpointId: string;
}

export interface SynthesizeOptions {
  /**
   * Xato javobida ko'rsatiladigan fallback matn. Har sahifa o'zining
   * aynan matnini saqlashi uchun. Berilmasa — `Error (${status})`.
   */
  errorFallback?: (status: number) => string;
}

/** Xato tafsiloti UI'ni bosib ketmasligi uchun chegara. */
const DETAIL_MAX = 400;

/**
 * Uzun tafsilotni qisqartiradi — o'rtasidan kesib.
 * Sabab boshida ("F5 serveri bilan bog'lanib bo'lmadi"), yechim esa oxirida
 * ("Ishga tushirish: ...") bo'ladi; o'rtasi odatda stack/urllib3 shovqini.
 * Oddiy `slice(0, MAX)` aynan yechimni yeb qo'yadi.
 */
function clamp(text: string): string {
  if (text.length <= DETAIL_MAX) return text;
  const head = Math.ceil(DETAIL_MAX * 0.55);
  const tail = DETAIL_MAX - head;
  return `${text.slice(0, head).trimEnd()} … ${text.slice(-tail).trimStart()}`;
}

/**
 * Backend `details` ni o'qiladigan matnga aylantiradi.
 * /api/tts uni FastAPI javobidan xom string sifatida uzatadi, ya'ni odatda
 * `{"detail":"..."}` ko'rinishidagi JSON. Ichidagi odam o'qiy oladigan matnni
 * ajratib olamiz; JSON bo'lmasa — stringning o'zini qaytaramiz.
 */
function readableDetail(details: unknown): string {
  if (typeof details !== "string") return "";
  const raw = details.trim();
  if (!raw) return "";

  let text = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      text = parsed;
    } else if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      const picked = o.detail ?? o.error ?? o.message;
      if (typeof picked === "string") text = picked;
    }
  } catch {
    // JSON emas — xom matn o'zi ketadi.
  }

  return clamp(text.trim());
}

export async function synthesize(
  payload: Record<string, unknown>,
  options: SynthesizeOptions = {}
): Promise<TtsResult> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as {
      error?: string;
      details?: unknown;
      hint?: unknown;
    };
    const fallback = options.errorFallback
      ? options.errorFallback(res.status)
      : `Error (${res.status})`;
    // Sabab va yo'l-yo'riq ham xabarga kiradi — aks holda foydalanuvchi faqat
    // "TTS server xatosi (503)" ni ko'rib, nima buzilganini bilmay qoladi.
    const message = [
      e.error || fallback,
      readableDetail(e.details),
      typeof e.hint === "string" ? e.hint.trim() : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(message);
  }
  const timeSec = parseFloat(res.headers.get("X-Synthesis-Time-Sec") || "0");
  const blob = await res.blob();
  return {
    blob,
    url: URL.createObjectURL(blob),
    timeSec,
    normalizedText: res.headers.get("X-Normalized-Text") || "",
    modelKind: res.headers.get("X-Model-Kind") || "",
    checkpointId: res.headers.get("X-Checkpoint-Id") || "",
  };
}
