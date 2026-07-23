"use client";

import {
  Mic,
  Square,
  Save,
  RotateCcw,
  SkipForward,
  SkipBack,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecorderState } from "@/hooks/use-recorder";
import { LevelBars } from "@/components/record/level-bars";

export function RecorderControls({
  state,
  level,
  duration,
  error,
  saveError,
  previewUrl,
  saving,
  currentIdx,
  listLength,
  onPrev,
  onNext,
  onStartStop,
  onReset,
  onSave,
}: {
  state: RecorderState;
  level: number;
  duration: number;
  error: string | null;
  saveError: string | null;
  previewUrl: string | null;
  saving: boolean;
  currentIdx: number;
  listLength: number;
  onPrev: () => void;
  onNext: () => void;
  onStartStop: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
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
          onClick={onPrev}
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
            onClick={onStartStop}
            className="flex items-center gap-3 rounded-lg bg-danger px-8 py-3 text-base font-medium text-white hover:opacity-90 transition shadow-lg"
          >
            <Mic className="h-5 w-5" />
            Yozish (Space)
          </button>
        ) : state === "recording" ? (
          <button
            onClick={onStartStop}
            className="flex items-center gap-3 rounded-lg bg-fg px-8 py-3 text-base font-medium text-bg hover:opacity-90 transition shadow-lg"
          >
            <Square className="h-5 w-5" />
            Toʻxtatish (Space)
          </button>
        ) : (
          <>
            <button
              onClick={onReset}
              disabled={saving}
              title="Qayta yozish (Esc)"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm hover:bg-bg-muted transition disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Qayta (Esc)
            </button>
            <button
              onClick={onSave}
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
          onClick={onNext}
          disabled={currentIdx >= listLength - 1}
          title="Keyingi (→)"
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm hover:bg-bg-muted transition",
            currentIdx >= listLength - 1 && "opacity-30 cursor-not-allowed"
          )}
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
