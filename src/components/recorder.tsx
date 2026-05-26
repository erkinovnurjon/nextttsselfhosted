"use client";

import { useEffect, useState } from "react";
import { Mic, Square, Save, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { useRecorder } from "@/hooks/use-recorder";
import { blobToWav } from "@/lib/wav-encoder";
import { cn } from "@/lib/utils";
import type { Sentence } from "@/lib/types";

interface RecorderProps {
  sentenceId: string;
  onSaved: (sentence: Sentence) => void;
  onCancel: () => void;
}

export function Recorder({ sentenceId, onSaved, onCancel }: RecorderProps) {
  const { state, blob, duration, level, error, start, stop, reset } = useRecorder();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (blob && state === "stopped") {
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [blob, state]);

  function handleStop() {
    stop();
  }

  function handleRetry() {
    setPreviewUrl(null);
    setSaveError(null);
    reset();
  }

  async function handleSave() {
    if (!blob) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { wav, duration: wavDuration, sampleRate } = await blobToWav(blob);
      const formData = new FormData();
      formData.append("audio", wav, `${sentenceId}.wav`);
      formData.append("duration", String(wavDuration));
      formData.append("sampleRate", String(sampleRate));
      const res = await fetch(`/api/recordings/${sentenceId}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Saqlashda xatolik");
      }
      const data = await res.json();
      onSaved(data.sentence as Sentence);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setSaving(false);
    }
  }

  const showPreview = state === "stopped" && blob && previewUrl;

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {state === "idle" && (
        <div className="flex items-center gap-3">
          <button
            onClick={start}
            className="flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            <Mic className="h-4 w-4" />
            Yozishni boshlash
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-bg-muted transition"
          >
            Bekor qilish
          </button>
        </div>
      )}

      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleStop}
              className="flex items-center gap-2 rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-90 transition"
            >
              <Square className="h-4 w-4" />
              Toʻxtatish
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
              </span>
              <span className="font-mono text-fg-muted">
                {duration.toFixed(1)}s
              </span>
            </div>
          </div>
          <LevelMeter level={level} />
        </div>
      )}

      {showPreview && (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-fg-muted">
              Yozuv: {duration.toFixed(2)} soniya
            </div>
            <audio src={previewUrl} controls className="w-full" />
          </div>
          {saveError && (
            <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition",
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saqlanmoqda…" : "Saqlash (WAV)"}
            </button>
            <button
              onClick={handleRetry}
              disabled={saving}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-bg-muted transition"
            >
              <RotateCcw className="h-4 w-4" />
              Qayta yozish
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-bg-muted transition"
            >
              Yopish
            </button>
          </div>
          <p className="text-xs text-fg-subtle">
            Saqlanganda 22050 Hz, mono, 16-bit WAV ga aylantiriladi.
          </p>
        </div>
      )}
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  const bars = 32;
  const active = Math.round(level * bars);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < active;
        const hue = i < bars * 0.7 ? "bg-success" : i < bars * 0.9 ? "bg-warning" : "bg-danger";
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-sm transition-all",
              isActive ? hue : "bg-bg-muted"
            )}
            style={{ height: `${20 + (i / bars) * 80}%` }}
          />
        );
      })}
    </div>
  );
}
