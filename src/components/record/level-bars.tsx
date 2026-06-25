import { cn } from "@/lib/utils";

export function LevelBars({ level }: { level: number }) {
  const bars = 48;
  const active = Math.round(level * bars);
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < active;
        const hue =
          i < bars * 0.7
            ? "bg-success"
            : i < bars * 0.9
            ? "bg-warning"
            : "bg-danger";
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm transition-all",
              isActive ? hue : "bg-bg-muted"
            )}
            style={{ height: `${30 + (i / bars) * 70}%` }}
          />
        );
      })}
    </div>
  );
}
