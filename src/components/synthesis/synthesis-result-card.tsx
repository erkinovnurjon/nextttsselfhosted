"use client";

import { Download } from "lucide-react";

/**
 * Sintez sahifasidagi bitta natija kartochkasi (audio + yuklab olish).
 * JSX/class'lar sintez/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
export function SynthesisResultCard({
  id,
  voiceId,
  voiceLabel,
  text,
  time,
  url,
  downloadTitle,
  audioRef,
  onPlay,
  onPause,
  onEnded,
}: {
  id: string;
  voiceId: string;
  voiceLabel: string;
  text: string;
  time: number;
  url: string;
  downloadTitle: string;
  audioRef: (el: HTMLAudioElement | null) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}) {
  return (
    <div className="card animate-fade-in space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
          {voiceLabel}
        </span>
        <span className="text-[10px] text-fg-subtle">{time.toFixed(1)}s</span>
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
      <div className="flex items-center gap-2">
        <audio
          ref={audioRef}
          src={url}
          controls
          className="h-9 flex-1"
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        />
        <a
          href={url}
          download={`${voiceId}_${id.slice(0, 6)}.wav`}
          className="rounded-lg border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          title={downloadTitle}
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
