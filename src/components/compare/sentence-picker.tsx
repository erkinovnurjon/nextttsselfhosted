"use client";

/**
 * Test jumlasi tanlash + versiyalarni ko'rsatish (checkbox) aside paneli.
 * JSX/class'lar compare/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function SentencePicker({
  sentences,
  checkpoints,
  selectedSentence,
  onSelectSentence,
  hiddenCheckpoints,
  onToggleCheckpoint,
}: {
  sentences: SentenceMeta[];
  checkpoints: CheckpointSamples[];
  selectedSentence: string | null;
  onSelectSentence: (id: string) => void;
  hiddenCheckpoints: Set<string>;
  onToggleCheckpoint: (id: string) => void;
}) {
  return (
    <aside className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-subtle p-3">
        <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-accent" />
          Test jumlalari
        </h3>
        <div className="space-y-1">
          {sentences.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectSentence(s.id)}
              className={cn(
                "w-full text-left rounded-md p-2 text-xs transition",
                selectedSentence === s.id
                  ? "bg-accent/20 border border-accent/40 text-fg"
                  : "border border-transparent hover:bg-bg-muted text-fg-muted hover:text-fg"
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  {s.id} · {s.category}
                </span>
              </div>
              <div className="text-fg break-words">{s.text}</div>
              <div className="text-[10px] text-fg-subtle mt-0.5">{s.focus}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-subtle p-3 space-y-1.5">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-accent" />
          Versiyalarni ko'rsatish
        </h3>
        <p className="text-[10px] text-fg-subtle">
          Solishtirish uchun bir nechta versiyani yashirib qo'yishingiz mumkin
        </p>
        <div className="space-y-0.5 pt-1">
          {checkpoints.map((cp) => (
            <label
              key={cp.id}
              className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-bg-muted rounded px-1.5 py-0.5"
            >
              <input
                type="checkbox"
                checked={!hiddenCheckpoints.has(cp.id)}
                onChange={() => onToggleCheckpoint(cp.id)}
                className="accent-accent"
              />
              <span className="font-mono truncate flex-1">{cp.id}</span>
              <span className="text-fg-subtle">{cp.samples.length}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
