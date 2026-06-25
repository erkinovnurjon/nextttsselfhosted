"use client";

import { Mic, Square, Upload, Loader2 } from "lucide-react";
import type { TFunc } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RecordPanel({
  t,
  recording,
  transcribing,
  busy,
  mmss,
  onToggleRec,
  onUploadClick,
  fileRef,
  onFile,
}: {
  t: TFunc;
  recording: boolean;
  transcribing: boolean;
  busy: boolean;
  mmss: string;
  onToggleRec: () => void;
  onUploadClick: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="card-glow space-y-4 p-6">
      <button
        onClick={onToggleRec}
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
        onClick={onUploadClick}
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
  );
}
