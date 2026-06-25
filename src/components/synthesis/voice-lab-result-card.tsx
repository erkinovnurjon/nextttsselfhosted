"use client";

import { Download, Trash2, Layers } from "lucide-react";

export interface SynthResult {
  id: string;
  text: string;
  normalizedText: string | null;
  audioUrl: string;
  checkpointId: string;
  synthTime: number;
  params: {
    temperature: number;
    speed: number;
    repetition_penalty: number;
    top_k: number;
    top_p: number;
  };
  createdAt: number;
}

/**
 * voice-lab tarixidagi bitta sintez natijasi kartochkasi.
 * JSX/class'lar voice-lab/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
export function VoiceLabResultCard({
  result,
  onDelete,
  audioRef,
}: {
  result: SynthResult;
  onDelete: () => void;
  audioRef: (el: HTMLAudioElement | null) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-accent font-mono">
              <Layers className="h-2.5 w-2.5" />
              {result.checkpointId || "?"}
            </span>
            <span className="text-fg-subtle">
              {new Date(result.createdAt).toLocaleTimeString("uz")}
            </span>
            <span className="text-fg-subtle">
              · {result.synthTime.toFixed(2)}s
            </span>
          </div>
          <div className="text-sm text-fg break-words">{result.text}</div>
          {result.normalizedText && result.normalizedText !== result.text && (
            <details className="text-[11px] text-fg-muted">
              <summary className="cursor-pointer hover:text-fg">
                Normalizatsiya qilingan matn
              </summary>
              <div className="mt-1 rounded bg-bg-muted p-1.5 font-mono text-fg">
                {result.normalizedText}
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-1.5 text-[10px] text-fg-subtle pt-0.5">
            <span>T={result.params.temperature}</span>
            <span>·</span>
            <span>speed={result.params.speed}</span>
            <span>·</span>
            <span>rep={result.params.repetition_penalty}</span>
            <span>·</span>
            <span>top_k={result.params.top_k}</span>
            <span>·</span>
            <span>top_p={result.params.top_p}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={result.audioUrl}
            download={`synth_${result.checkpointId}_${result.id.slice(0, 8)}.wav`}
            className="rounded p-1 hover:bg-bg-muted transition"
            title="Yuklab olish"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={onDelete}
            className="rounded p-1 hover:bg-bg-muted transition text-fg-muted hover:text-danger"
            title="O'chirish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <audio ref={audioRef} src={result.audioUrl} controls className="w-full h-8" />
    </div>
  );
}
