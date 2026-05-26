"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mic,
  Square,
  Save,
  RotateCcw,
  SkipForward,
  SkipBack,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Keyboard,
} from "lucide-react";
import { useRecorder } from "@/hooks/use-recorder";
import { blobToWav } from "@/lib/wav-encoder";
import { cn } from "@/lib/utils";
import type { Sentence } from "@/lib/types";

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
      <header className="border-b border-border bg-bg-subtle">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-muted transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-fg-muted whitespace-nowrap">
              {currentIdx + 1} / {list.length}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-bg p-0.5">
            <ModeBtn active={mode === "pending"} onClick={() => setMode("pending")}>
              Kutilmoqda
            </ModeBtn>
            <ModeBtn active={mode === "all"} onClick={() => setMode("all")}>
              Hammasi
            </ModeBtn>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl space-y-8">
          {/* Saved feedback */}
          {savedCount > 0 && (
            <div className="text-center text-xs text-success">
              ✓ Bu sessiyada {savedCount} ta yozuv saqlandi
            </div>
          )}

          {/* Sentence ID + status */}
          <div className="flex items-center justify-center gap-3 text-xs text-fg-muted">
            <span className="font-mono">#{current.id}</span>
            {current.audioPath && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Yozilgan ({current.duration?.toFixed(1)}s) — qayta yozsangiz almashtiriladi
              </span>
            )}
          </div>

          {/* Big sentence */}
          <div className="rounded-xl border border-border bg-bg-subtle p-8 md:p-12">
            <p className="text-2xl md:text-3xl leading-relaxed text-center font-medium">
              {current.text}
            </p>
          </div>

          {/* Recording UI */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* State: recording */}
            {state === "recording" && (
              <div className="space-y-4">
                <LevelBars level={level} />
                <div className="text-center font-mono text-3xl text-fg-muted">
                  {duration.toFixed(1)}s
                </div>
              </div>
            )}

            {/* State: stopped (preview) */}
            {state === "stopped" && previewUrl && (
              <div className="space-y-3">
                <audio src={previewUrl} controls autoPlay className="w-full" />
                <div className="text-center text-xs text-fg-muted">
                  {duration.toFixed(2)} soniya — eshitib koʻring
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={goPrev}
                disabled={currentIdx === 0}
                title="Oldingi (←)"
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm hover:bg-bg-muted transition",
                  currentIdx === 0 && "opacity-30 cursor-not-allowed"
                )}
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {state === "idle" || state === "error" ? (
                <button
                  onClick={handleStartStop}
                  className="flex items-center gap-3 rounded-lg bg-danger px-8 py-3 text-base font-medium text-white hover:opacity-90 transition shadow-lg"
                >
                  <Mic className="h-5 w-5" />
                  Yozish (Space)
                </button>
              ) : state === "recording" ? (
                <button
                  onClick={handleStartStop}
                  className="flex items-center gap-3 rounded-lg bg-fg px-8 py-3 text-base font-medium text-bg hover:opacity-90 transition shadow-lg"
                >
                  <Square className="h-5 w-5" />
                  Toʻxtatish (Space)
                </button>
              ) : (
                <>
                  <button
                    onClick={resetAll}
                    disabled={saving}
                    title="Qayta yozish (Esc)"
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm hover:bg-bg-muted transition disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Qayta (Esc)
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-3 rounded-lg bg-success px-8 py-3 text-base font-medium text-white hover:opacity-90 transition shadow-lg",
                      saving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {saving ? "Saqlanmoqda…" : "Saqlash + Keyingi (Enter)"}
                  </button>
                </>
              )}

              <button
                onClick={goNext}
                disabled={currentIdx >= list.length - 1}
                title="Keyingi (→)"
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm hover:bg-bg-muted transition",
                  currentIdx >= list.length - 1 && "opacity-30 cursor-not-allowed"
                )}
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom keyboard hint */}
      <footer className="border-t border-border bg-bg-subtle">
        <div className="mx-auto max-w-4xl px-4 py-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" />
          </span>
          <Kbd k="Space" desc="Yozish / Toʻxtatish" />
          <Kbd k="Enter" desc="Saqlash" />
          <Kbd k="Esc" desc="Qayta yozish" />
          <Kbd k="→" desc="Keyingi" />
          <Kbd k="←" desc="Oldingi" />
        </div>
      </footer>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition whitespace-nowrap",
        active ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function Kbd({ k, desc }: { k: string; desc: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px]">
        {k}
      </kbd>
      <span>{desc}</span>
    </span>
  );
}

function LevelBars({ level }: { level: number }) {
  const bars = 48;
  const active = Math.round(level * bars);
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < active;
        const hue =
          i < bars * 0.7
            ? "bg-success"
            : i < bars * 0.9
            ? "bg-warning"
            : "bg-danger";
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm transition-all",
              isActive ? hue : "bg-bg-muted"
            )}
            style={{ height: `${30 + (i / bars) * 70}%` }}
          />
        );
      })}
    </div>
  );
}
