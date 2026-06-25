"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Mic,
  Square,
  Trash2,
  Play,
  CheckCircle2,
  Fingerprint,
  Sparkles,
  AudioLines,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blobToWav } from "@/lib/wav-encoder";
import { synthesize } from "@/lib/tts-client";
import { REFERENCE_SENTENCES, MIN_REF_SECONDS } from "@/lib/voice-sentences";

type VoiceInfo = {
  status: string;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
} | null;

export default function MyVoicePage() {
  const [voice, setVoice] = useState<VoiceInfo>(null);
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<number>(0);

  useEffect(() => {
    fetch("/api/voice")
      .then((r) => r.json())
      .then((d) => setVoice(d.voice ?? null))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    if (recording || saving) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = handleStop;
      recRef.current = rec;
      rec.start();
      startedRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed((Date.now() - startedRef.current) / 1000),
        200
      );
      setRecording(true);
    } catch {
      setError("Mikrofonga ruxsat berilmadi.");
    }
  }

  function stop() {
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function handleStop() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 3000) {
      setError("Yozuv juda qisqa. Qaytadan urinib ko'ring.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { wav, duration } = await blobToWav(blob, 24000);
      const fd = new FormData();
      fd.append("audio", wav, "reference.wav");
      fd.append("text", REFERENCE_SENTENCES.join(" "));
      fd.append("duration", String(duration));
      const res = await fetch("/api/voice", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Saqlashda xato");
      setVoice(data.voice);
      setTestUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setError(null);
    try {
      const { url } = await synthesize(
        {
          text: "Salom! Bu mening shaxsiy ovozim bilan aytilgan sinov gapi.",
          checkpoint_id: "f5",
          voice: "__me__",
          speed: 0.95,
        },
        { errorFallback: () => "Sintez xatosi" }
      );
      setTestUrl(url);
      window.dispatchEvent(new Event("nexttts:credits-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!window.confirm("Shaxsiy ovozni o'chirasizmi?")) return;
    await fetch("/api/voice", { method: "DELETE" }).catch(() => undefined);
    setVoice(null);
    setTestUrl(null);
  }

  const enough = elapsed >= MIN_REF_SECONDS;

  return (
    <div className="mx-auto max-w-2xl space-y-7 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-subtle/50 px-6 py-8 text-center backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-70" />
        <div className="relative space-y-3">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-white shadow-glow">
            <Fingerprint className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Mening ovozim
          </h2>
          <p className="mx-auto max-w-md text-sm text-fg-muted">
            Quyidagi jumlalarni o'qib, o'z ovozingizni yozdiring. Sun'iy intellekt
            uni o'rganib, istalgan matnni <b>sizning ovozingizda</b> gapiradi.
          </p>
        </div>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-10 text-fg-subtle">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Mavjud ovoz holati */}
          {voice && (
            <div className="card-glow space-y-4 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
                Ovozingiz tayyor
                {voice.durationSec ? (
                  <span className="ml-1 text-[11px] font-normal text-fg-subtle">
                    · {voice.durationSec.toFixed(0)}s yozuv
                  </span>
                ) : null}
              </div>
              <p className="text-[13px] text-fg-muted">
                Sintez sahifasida <b>“Mening ovozim”</b> ni tanlab, istalgan matnni
                shu ovozda eshiting.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={test}
                  disabled={testing}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                    testing
                      ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                      : "brand-gradient text-white shadow-glow hover:opacity-90"
                  )}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Sinab ko'rish
                </button>
                <Link
                  href="/cabinet/sintez"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
                >
                  <AudioLines className="h-4 w-4" />
                  Sintezga o'tish
                </Link>
                <button
                  onClick={remove}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-danger/30 px-3 py-2.5 text-sm text-danger transition hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                  O'chirish
                </button>
              </div>
              {testUrl && (
                <audio src={testUrl} controls autoPlay className="h-10 w-full" />
              )}
            </div>
          )}

          {/* Yozish bo'limi */}
          <div className="card-glow space-y-5 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {voice ? "Qayta yozish" : "Yozib olish"} — quyidagi jumlalarni o'qing
            </div>

            <ol className="space-y-2">
              {REFERENCE_SENTENCES.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-border bg-bg/50 p-3 text-[15px] leading-relaxed"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Tinch xonada, mikrofonga yaqin, tabiiy ohangda o'qing. Kamida{" "}
              {MIN_REF_SECONDS} soniya.
            </div>

            {/* Yozish tugmasi */}
            {!recording ? (
              <button
                onClick={start}
                disabled={saving}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition",
                  saving
                    ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                    : "brand-gradient text-white shadow-glow hover:opacity-90"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saqlanmoqda…
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Yozishni boshlash
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={stop}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger bg-danger/15 px-4 py-3.5 text-base font-semibold text-danger transition hover:bg-danger/20"
              >
                <Square className="h-5 w-5 fill-current" />
                To'xtatish · {elapsed.toFixed(0)}s
                <span
                  className={cn(
                    "ml-1 h-2.5 w-2.5 animate-pulse rounded-full",
                    enough ? "bg-emerald-500" : "bg-danger"
                  )}
                />
              </button>
            )}
            {recording && !enough && (
              <div className="text-center text-[11px] text-fg-subtle">
                Yana {(MIN_REF_SECONDS - elapsed).toFixed(0)}s o'qing…
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
