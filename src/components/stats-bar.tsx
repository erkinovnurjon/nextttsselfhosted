"use client";

import { Database, Mic, Hourglass, Clock } from "lucide-react";
import type { DatasetStats } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface StatsBarProps {
  stats: DatasetStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const pct = stats.total > 0 ? (stats.recorded / stats.total) * 100 : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={<Database className="h-4 w-4" />}
        label="Jami jumla"
        value={stats.total.toString()}
      />
      <StatCard
        icon={<Mic className="h-4 w-4" />}
        label="Yozilgan"
        value={stats.recorded.toString()}
        accent
        sub={`${pct.toFixed(0)}%`}
      />
      <StatCard
        icon={<Hourglass className="h-4 w-4" />}
        label="Kutilmoqda"
        value={stats.pending.toString()}
      />
      <StatCard
        icon={<Clock className="h-4 w-4" />}
        label="Jami davomiylik"
        value={formatDuration(stats.totalDurationSec)}
        sub={`o'rt: ${formatDuration(stats.avgDurationSec)}`}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={
            "text-2xl font-semibold tabular-nums " +
            (accent ? "text-accent" : "")
          }
        >
          {value}
        </span>
        {sub && <span className="text-xs text-fg-subtle">{sub}</span>}
      </div>
    </div>
  );
}
