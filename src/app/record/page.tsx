"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRecorder } from "@/hooks/use-recorder";
import { blobToWav } from "@/lib/wav-encoder";
import type { Sentence } from "@/lib/types";
import { RecordHeader } from "@/components/record/record-header";
import { SentencePanel } from "@/components/record/sentence-panel";
import { RecorderControls } from "@/components/record/recorder-controls";
import { KeyboardHints } from "@/components/record/keyboard-hints";

type Mode = "pending" | "all";

export default function RecordPage() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("pending");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const { state, blob, duration, level, error, start, stop, reset } =
    useRecorder();

  useEffect(() => {
    fetch("/api/sentences")
      .then((r) => r.json())
      .then((d) => setSentences(d.sentences))
      .finally(() => setLoading(false));
  }, []);

  const list = useMemo(() => {
    if (mode === "pending") return sentences.filter((s) => !s.audioPath);
    return sentences;
  }, [sentences, mode]);

  const current = list[currentIdx];

  useEffect(() => {
    if (currentIdx >= list.length && list.length > 0) {
      setCurrentIdx(Math.max(0, list.length - 1));
    }
  }, [list.length, currentIdx]);

  useEffect(() => {
    if (blob && state === "stopped") {
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [blob, state]);

  const resetAll = useCallback(() => {
    reset();
    setPreviewUrl(null);
    setSaveError(null);
  }, [reset]);

  const goNext = useCallback(() => {
    resetAll();
    setCurrentIdx((i) => Math.min(i + 1, list.length - 1));
  }, [resetAll, list.length]);

  const goPrev = useCallback(() => {
    resetAll();
    setCurrentIdx((i) => Math.max(0, i - 1));
  }, [resetAll]);

  const handleSave = useCallback(async () => {
    if (!blob || !current || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const {
        wav,
        duration: wavDuration,
        sampleRate,
      } = await blobToWav(blob);
      const formData = new FormData();
      formData.append("audio", wav, `${current.id}.wav`);
      formData.append("duration", String(wavDuration));
      formData.append("sampleRate", String(sampleRate));
      const res = await fetch(`/api/recordings/${current.id}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Saqlashda xato");
      }
      const data = await res.json();
      const savedSentence = data.sentence as Sentence;
      setSentences((prev) =>
        prev.map((s) => (s.id === savedSentence.id ? savedSentence : s))
      );
      setSavedCount((c) => c + 1);
      resetAll();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Nomalum xato");
    } finally {
      setSaving(false);
    }
  }, [blob, current, saving, resetAll]);

  const handleStartStop = useCallback(() => {
    if (saving) return;
    if (state === "recording") {
      stop();
    } else {
      resetAll();
      start();
    }
  }, [state, start, stop, saving, resetAll]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        handleStartStop();
      } else if (e.code === "Enter") {
        if (state === "stopped" && blob && !saving) {
          e.preventDefault();
          handleSave();
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (state === "recording") stop();
        else resetAll();
      } else if (e.code === "ArrowRight" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        goNext();
      } else if (e.code === "ArrowLeft" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, blob, saving, handleStartStop, handleSave, resetAll, goNext, goPrev, stop]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg-muted">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Yuklanmoqda…
      </div>
    );
  }

  if (mode === "pending" && list.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-success" />
        <h1 className="text-2xl font-semibold">Hammasi yozilgan!</h1>
        <p className="text-fg-muted max-w-md">
          "Pending" jumlalar tugadi. Yangi jumlalar qoʻshing yoki butun
          dataset'ni qayta koʻrib chiqing.
        </p>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition"
          >
            Dashboardga qaytish
          </Link>
          <button
            onClick={() => setMode("all")}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-bg-muted transition"
          >
            Hammasini koʻrish
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg-muted">
        Jumla topilmadi
      </div>
    );
  }

  const progress = ((currentIdx + 1) / list.length) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <RecordHeader
        progress={progress}
        currentIdx={currentIdx}
        total={list.length}
        mode={mode}
        onModeChange={setMode}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl space-y-8">
          <SentencePanel current={current} savedCount={savedCount} />

          {/* Recording UI */}
          <RecorderControls
            state={state}
            level={level}
            duration={duration}
            error={error}
            saveError={saveError}
            previewUrl={previewUrl}
            saving={saving}
            currentIdx={currentIdx}
            listLength={list.length}
            onPrev={goPrev}
            onNext={goNext}
            onStartStop={handleStartStop}
            onReset={resetAll}
            onSave={handleSave}
          />
        </div>
      </main>

      {/* Bottom keyboard hint */}
      <KeyboardHints />
    </div>
  );
}
