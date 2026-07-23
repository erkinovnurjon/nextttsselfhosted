"use client";

/**
 * Training progress paneli (epoch / step / progress bar).
 * JSX/class'lar status/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
import { Clock } from "lucide-react";

interface TrainingProgressData {
  epoch: number | null;
  epoch_max: number | null;
  step: number | null;
  step_max: number | null;
  progress_pct: number | null;
  last_step_time: string | null;
}

export function TrainingProgress({ t }: { t: TrainingProgressData }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          Epoch {(t.epoch ?? 0) + 1}/{(t.epoch_max ?? 0) + 1} · jarayon
        </span>
        <span className="font-mono text-accent">
          {(t.progress_pct ?? 0).toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${t.progress_pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-fg-muted">
        <span>step {t.step?.toLocaleString()}</span>
        {t.last_step_time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t.last_step_time}
          </span>
        )}
        <span>{t.step_max?.toLocaleString()} jami</span>
      </div>
    </div>
  );
}
