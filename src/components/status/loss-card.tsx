"use client";

/**
 * Loss qiymati kartasi (instant / running avg / eval).
 * JSX/class'lar status/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
import { cn } from "@/lib/utils";

export function LossCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-1",
        highlight
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-bg-subtle"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="text-xl font-mono font-semibold">
        {value !== null && value !== undefined ? value.toFixed(3) : "—"}
      </div>
      {hint && <div className="text-[10px] text-fg-muted">{hint}</div>}
    </div>
  );
}
