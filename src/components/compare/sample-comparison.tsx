"use client";

/**
 * Tanlangan jumla + versiyalar bo'yicha sample audio ro'yxati (comparison area).
 * JSX/class'lar compare/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
import { Download } from "lucide-react";

interface SentenceMeta {
  id: string;
  category: string;
  text: string;
  focus: string;
}

interface SampleItem {
  sentence_id: string;
  url: string;
  size_kb: number;
}

interface CheckpointSamples {
  id: string;
  generated_at: string | null;
  checkpoint_path: string | null;
  samples: SampleItem[];
}

export function SampleComparison({
  selectedMeta,
  visibleCheckpoints,
  selectedSentence,
}: {
  selectedMeta: SentenceMeta | null | undefined;
  visibleCheckpoints: CheckpointSamples[];
  selectedSentence: string | null;
}) {
  return (
    <div className="space-y-4 min-w-0">
      {selectedMeta && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle mb-1">
            Hozir tanlangan: {selectedMeta.id}
          </div>
          <div className="text-sm font-medium">{selectedMeta.text}</div>
          <div className="text-[10px] text-fg-muted mt-1">{selectedMeta.focus}</div>
        </div>
      )}

      <div className="space-y-3">
        {visibleCheckpoints.map((cp) => {
          const sample = cp.samples.find((s) => s.sentence_id === selectedSentence);
          // Backend `/samples/audio/...` qaytaradi — Next.js proxy `/api` prefiksi kerak
          const audioUrl = sample ? `/api${sample.url}` : null;
          return (
            <div
              key={cp.id}
              className="rounded-lg border border-border bg-bg-subtle p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold font-mono truncate">
                    {cp.id}
                  </div>
                  {cp.generated_at && (
                    <div className="text-[10px] text-fg-subtle">
                      Ovozlangan: {cp.generated_at}
                    </div>
                  )}
                </div>
                {sample && audioUrl && (
                  <a
                    href={audioUrl}
                    download={`${cp.id}_${sample.sentence_id}.wav`}
                    className="rounded p-1 hover:bg-bg-muted transition"
                    title="Yuklab olish"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {sample && audioUrl ? (
                <audio src={audioUrl} controls className="w-full h-8" />
              ) : (
                <div className="text-[11px] text-fg-subtle py-2">
                  Bu jumla bu versiyada ovozlanmagan
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
