import { CheckCircle2 } from "lucide-react";
import type { Sentence } from "@/lib/types";

export function SentencePanel({
  current,
  savedCount,
}: {
  current: Sentence;
  savedCount: number;
}) {
  return (
    <>
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
    </>
  );
}
