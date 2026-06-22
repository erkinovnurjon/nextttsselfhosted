"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Download, Sparkles, Mic, User2, Wand2, Star, Fingerprint } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WaveBars } from "@/components/wave-bars";
import { blobToWav } from "@/lib/wav-encoder";

type Voice = "piper" | "feruza" | "jonli" | "ayol" | "erkak" | "base" | "__me__";

// piper — NATIV o'zbek ayol ovozi (FeruzaSpeech, espeak fonema x/gʻ/ch to'g'ri; checkpoint_id="piper").
// feruza/jonli/ayol — F5-TTS tabiiy ayol ovozlari (alohida engine, checkpoint_id="f5").
//   ayol = 1571110404 (01) speakerga ATALGAN mayin/yosh model (dedicated fine-tune, x→kh baked-in).
// base/erkak — tez MMS (checkpoint_id="mms").
const F5_VOICES: Voice[] = ["feruza", "jonli", "ayol"];

interface Result {
  id: string;
  text: string;
  voice: Voice;
  url: string;
  time: number;
}

const PRESETS = [
  "Oʻzbek xalqining tarixi gʻoyat boy, shaharlari keng, togʻlari koʻrkam.",
  "Assalomu alaykum, bugun ajoyib kun, kayfiyatim juda yaxshi.",
  "Yangi ochilgan maktabda mingta oʻquvchi ilm oladi.",
  "Shoshilinch xushxabar kelganda, hamma shaharga otlandi.",
  "Gʻalaba qoʻshigʻi yangrab, togʻu toshlar jaranglashdi.",
];

// "Ayol (mayin)" (ayol, F5 dedicated) = yosh/mayin tabiiy tembr; qiyin (x-zich) so'zni
//   ba'zan xato o'qiydi (beta), sekinroq (~5s). Eski MMS "Ayol (tez)" o'rniga keldi.
// piper = nativ o'zbek (default, ishonchli, x/gʻ to'g'ri). base = neytral tez MMS. erkak = tez MMS.
// "jonli/feruza" (F5) UI'dan olingan — API/eski tarix uchun type/i18n'da qoladi.
const VOICES: { id: Voice; icon: typeof Sparkles }[] = [
  { id: "piper", icon: Star },
  { id: "ayol", icon: Wand2 },
  { id: "erkak", icon: User2 },
  { id: "base", icon: Sparkles },
];

export default function SintezPage() {
  const { t } = useI18n();
  const [text, setText] = useState(PRESETS[0]);
  const [voice, setVoice] = useState<Voice>("piper");
  const [speed, setSpeed] = useState(0.9);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [hasMyVoice, setHasMyVoice] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // "Nutqdan matn" sahifasidan kelgan matnni qabul qilish
  useEffect(() => {
    try {
      const handoff = sessionStorage.getItem("nexttts:sintez-text");
      if (handoff) {
        setText(handoff);
        sessionStorage.removeItem("nexttts:sintez-text");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Foydalanuvchining shaxsiy ovozi bormi? Bo'lsa — "Mening ovozim" tanlovi chiqadi.
  useEffect(() => {
    fetch("/api/voice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.voice?.status === "ready") setHasMyVoice(true);
      })
      .catch(() => undefined);
  }, []);

  async function speak(override?: string) {
    const t0 = (override ?? text).trim();
    if (!t0) return;
    setLoading(true);
    setError(null);
    try {
      // __me__ → shaxsiy ovoz (F5 zero-shot klon); piper → nativ o'zbek (CPU);
      // feruza/jonli/ayol → F5 engine; qolganlar → tez MMS.
      const payload =
        voice === "__me__"
          ? { text: t0, checkpoint_id: "f5", speed, voice: "__me__" }
          : voice === "piper"
            ? { text: t0, checkpoint_id: "piper", speed }
            : F5_VOICES.includes(voice)
              ? { text: t0, checkpoint_id: "f5", speed, voice }
              : { text: t0, checkpoint_id: "mms", voice, speaking_rate: speed };
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Error (${res.status})`);
      }
      const time = parseFloat(res.headers.get("X-Synthesis-Time-Sec") || "0");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const result: Result = { id: crypto.randomUUID(), text: t0, voice, url, time };
      setResults((prev) => [result, ...prev]);
      // Topbar balansini yangilash (kredit yechildi)
      window.dispatchEvent(new Event("nexttts:credits-changed"));
      setTimeout(() => audioRefs.current[result.id]?.play().catch(() => undefined), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function startRec() {
    if (recording || transcribing) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = handleRecStop;
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError(t("cabinet.sintez.micDenied"));
    }
  }

  function stopRec() {
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
    }
  }

  async function handleRecStop() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1500) return;
    setTranscribing(true);
    setError(null);
    try {
      const { wav } = await blobToWav(blob, 16000);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: wav,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ASR error");
      const said = (data.text || "").trim();
      if (!said) {
        setError(t("cabinet.sintez.notRecognized"));
        return;
      }
      setText(said);
      await speak(said);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ASR error");
    } finally {
      setTranscribing(false);
    }
  }

  // "Mening ovozim" — faqat shaxsiy ovoz tayyor bo'lsa ro'yxat boshida ko'rinadi.
  const voiceList: { id: Voice; icon: typeof Sparkles }[] = hasMyVoice
    ? [{ id: "__me__", icon: Fingerprint }, ...VOICES]
    : VOICES;
  const voiceLabel = (id: Voice) =>
    id === "__me__" ? "Mening ovozim" : t(`cabinet.sintez.voices.${id}.label`);
  const voiceHint = (id: Voice) =>
    id === "__me__"
      ? "Sizning ovozingiz — zero-shot klon"
      : t(`cabinet.sintez.voices.${id}.hint`);

  const animating = loading || playing;
  const speedLabel =
    speed <= 0.5 ? t("cabinet.sintez.slow") : speed <= 0.75 ? t("cabinet.sintez.medium") : t("cabinet.sintez.fast");

  return (
    <div className="mx-auto max-w-3xl space-y-7 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-subtle/50 px-6 py-8 text-center backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-70" />
        <div className="relative space-y-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("cabinet.sintez.title")}
          </h2>
          <p className="text-sm text-fg-muted">{t("cabinet.sintez.sub")}</p>
          <WaveBars active={animating} className="h-11" />
        </div>
      </div>

      {/* Voice */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {t("cabinet.sintez.voiceLabel")}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {voiceList.map((v) => {
            const Icon = v.icon;
            const active = voice === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  active
                    ? "card-glow border-accent/40"
                    : "border-border bg-bg-subtle/60 hover:bg-bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition",
                      active ? "brand-gradient text-white" : "bg-bg-muted text-fg-subtle"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">
                    {voiceLabel(v.id)}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-fg-muted">
                  {voiceHint(v.id)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {t("cabinet.sintez.presetsLabel")}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setText(p)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] transition",
                text === p
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
              )}
            >
              {p.length > 32 ? p.slice(0, 32) + "…" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Text + speed + button */}
      <div className="card-glow space-y-4 p-5">
        <div className="space-y-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={t("cabinet.sintez.placeholder")}
            className="w-full resize-none rounded-xl border border-border bg-bg/60 px-4 py-3 text-base outline-none transition focus:border-accent/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) speak();
            }}
          />
          <div className="text-right text-[10px] text-fg-subtle">
            {t("cabinet.sintez.charCount", { n: text.length })}
          </div>
        </div>

        {/* Mic */}
        <button
          onMouseDown={startRec}
          onMouseUp={stopRec}
          onMouseLeave={stopRec}
          onTouchStart={(e) => {
            e.preventDefault();
            startRec();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopRec();
          }}
          disabled={transcribing || loading}
          className={cn(
            "flex w-full select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
            recording
              ? "border-danger bg-danger/15 text-danger"
              : transcribing
              ? "border-border bg-bg-muted text-fg-subtle"
              : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          )}
        >
          {recording ? (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
              {t("cabinet.sintez.micRecording")}
            </>
          ) : transcribing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("cabinet.sintez.micTranscribing")}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {t("cabinet.sintez.mic")}
            </>
          )}
        </button>

        {/* Speed */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-fg-muted">{t("cabinet.sintez.speed")}</span>
            <span className="font-mono text-accent">
              {speedLabel} · {speed.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.4}
            max={1.1}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <button
          onClick={() => speak()}
          disabled={loading || !text.trim()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition",
            loading || !text.trim()
              ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
              : "brand-gradient text-white shadow-glow hover:opacity-90"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("cabinet.sintez.synthesizing")}
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              {t("cabinet.sintez.listen")}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.id} className="card animate-fade-in space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {voiceLabel(r.voice)}
              </span>
              <span className="text-[10px] text-fg-subtle">{r.time.toFixed(1)}s</span>
            </div>
            <p className="text-sm leading-relaxed">{r.text}</p>
            <div className="flex items-center gap-2">
              <audio
                ref={(el) => {
                  audioRefs.current[r.id] = el;
                }}
                src={r.url}
                controls
                className="h-9 flex-1"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
              <a
                href={r.url}
                download={`${r.voice}_${r.id.slice(0, 6)}.wav`}
                className="rounded-lg border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
                title={t("cabinet.sintez.download")}
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
