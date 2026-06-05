"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Square,
  Upload,
  Loader2,
  Copy,
  Check,
  Trash2,
  AudioLines,
  Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WaveBars } from "@/components/wave-bars";
import { blobToWav } from "@/lib/wav-encoder";

export default function TranskripsiyaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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
      setSeconds(0);
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(t("cabinet.transkripsiya.micDenied"));
    }
  }

  function stopRec() {
    stopTimer();
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
    }
  }

  async function handleRecStop() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1500) {
      setError(t("cabinet.transkripsiya.notRecognized"));
      return;
    }
    await transcribe(blob);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // bir faylni qayta tanlash mumkin bo'lsin
    if (!file) return;
    setError(null);
    await transcribe(file);
  }

  async function transcribe(input: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const { wav } = await blobToWav(input, 16000);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: wav,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ASR error");
      const said = (data.text || "").trim();
      if (!said) {
        setError(t("cabinet.transkripsiya.notRecognized"));
        return;
      }
      // Mavjud matnga qo'shib boradi (ketma-ket diktovka uchun)
      setText((prev) => (prev ? prev.trimEnd() + " " + said : said));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ASR error");
    } finally {
      setTranscribing(false);
    }
  }

  function copyText() {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined
    );
  }

  function toSintez() {
    if (!text.trim()) return;
    try {
      sessionStorage.setItem("nexttts:sintez-text", text.trim());
    } catch {
      /* ignore */
    }
    router.push("/cabinet/sintez");
  }

  const busy = recording || transcribing;
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-3xl space-y-7 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-subtle/50 px-6 py-8 text-center backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-70" />
        <div className="relative space-y-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("cabinet.transkripsiya.title")}
          </h2>
          <p className="text-sm text-fg-muted">{t("cabinet.transkripsiya.sub")}</p>
          <WaveBars active={busy} className="h-11" />
        </div>
      </div>

      {/* Record / upload */}
      <div className="card-glow space-y-4 p-6">
        <button
          onClick={recording ? stopRec : startRec}
          disabled={transcribing}
          className={cn(
            "flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-5 text-base font-semibold transition",
            recording
              ? "border border-danger bg-danger/15 text-danger"
              : transcribing
              ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
              : "brand-gradient text-white shadow-glow hover:opacity-90"
          )}
        >
          {recording ? (
            <>
              <Square className="h-5 w-5 fill-current" />
              {t("cabinet.transkripsiya.stop")} · {mmss}
            </>
          ) : transcribing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("cabinet.transkripsiya.transcribing")}
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              {t("cabinet.transkripsiya.record")}
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-fg-subtle">
          <span className="h-px flex-1 bg-border" />
          {t("cabinet.transkripsiya.or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg/40 px-4 py-3 text-sm font-medium transition",
            busy ? "cursor-not-allowed text-fg-subtle" : "hover:bg-bg-muted"
          )}
        >
          <Upload className="h-4 w-4" />
          {t("cabinet.transkripsiya.upload")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Result */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            {t("cabinet.transkripsiya.resultLabel")}
          </span>
          <span className="text-[10px] text-fg-subtle">
            {t("cabinet.transkripsiya.charCount", { n: text.length })}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t("cabinet.transkripsiya.resultPlaceholder")}
          className="w-full resize-none rounded-2xl border border-border bg-bg/60 px-4 py-3 text-base outline-none transition focus:border-accent/50"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyText}
            disabled={!text}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              !text
                ? "cursor-not-allowed border-border text-fg-subtle"
                : copied
                ? "border-success/40 bg-success/10 text-success"
                : "border-border hover:bg-bg-muted"
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("cabinet.transkripsiya.copied") : t("cabinet.transkripsiya.copy")}
          </button>

          <button
            onClick={() => setText("")}
            disabled={!text}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              !text
                ? "cursor-not-allowed border-border text-fg-subtle"
                : "border-border hover:bg-bg-muted hover:text-danger"
            )}
          >
            <Trash2 className="h-4 w-4" />
            {t("cabinet.transkripsiya.clear")}
          </button>

          <button
            onClick={toSintez}
            disabled={!text.trim()}
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition",
              !text.trim()
                ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                : "brand-gradient text-white shadow-glow hover:opacity-90"
            )}
          >
            <AudioLines className="h-4 w-4" />
            {t("cabinet.transkripsiya.toSintez")}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-fg-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>{t("cabinet.transkripsiya.hint")}</span>
      </div>
    </div>
  );
}
