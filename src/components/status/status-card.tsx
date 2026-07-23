"use client";

/**
 * GPU/Backend status kartasi.
 * JSX/class'lar status/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
import { cn } from "@/lib/utils";

export function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3 space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-fg-subtle">
        <span>{label}</span>
        <Icon
          className={cn(
            "h-3 w-3",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger"
          )}
        />
      </div>
      <div className="text-sm font-semibold truncate">{value}</div>
      <div className="text-[10px] text-fg-muted truncate">{sub}</div>
    </div>
  );
}
