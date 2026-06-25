"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { blobToWav } from "@/lib/wav-encoder";
import { Hero } from "@/components/cabinet/transkripsiya/hero";
import { RecordPanel } from "@/components/cabinet/transkripsiya/record-panel";
import { ErrorBanner } from "@/components/cabinet/transkripsiya/error-banner";
import { ResultPanel } from "@/components/cabinet/transkripsiya/result-panel";
import { Hint } from "@/components/cabinet/transkripsiya/hint";

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
      <Hero t={t} busy={busy} />

      {/* Record / upload */}
      <RecordPanel
        t={t}
        recording={recording}
        transcribing={transcribing}
        busy={busy}
        mmss={mmss}
        onToggleRec={recording ? stopRec : startRec}
        onUploadClick={() => fileRef.current?.click()}
        fileRef={fileRef}
        onFile={onFile}
      />

      {error && <ErrorBanner message={error} />}

      {/* Result */}
      <ResultPanel
        t={t}
        text={text}
        copied={copied}
        onChangeText={(e) => setText(e.target.value)}
        onCopy={copyText}
        onClear={() => setText("")}
        onToSintez={toSintez}
      />

      {/* Hint */}
      <Hint t={t} />
    </div>
  );
}
