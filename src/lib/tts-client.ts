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
    const e = await res.json().catch(() => ({}));
    const fallback = options.errorFallback
      ? options.errorFallback(res.status)
      : `Error (${res.status})`;
    throw new Error((e as { error?: string }).error || fallback);
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
