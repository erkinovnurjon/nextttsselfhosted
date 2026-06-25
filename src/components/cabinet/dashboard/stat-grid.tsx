"use client";

import { Activity, FileText, Type, CalendarDays } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { StatCard } from "./stat-card";

export function StatGrid({
  stats,
  createdAt,
  loc,
}: {
  stats: { total: number; today: number; charsToday: number } | undefined;
  createdAt: string | undefined;
  loc: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4 lg:col-span-2">
      <StatCard
        icon={<Activity className="h-4 w-4" />}
        label={t("cabinet.dashboard.statTotal")}
        value={(stats?.total ?? 0).toLocaleString(loc)}
      />
      <StatCard
        icon={<FileText className="h-4 w-4" />}
        label={t("cabinet.dashboard.statToday")}
        value={(stats?.today ?? 0).toLocaleString(loc)}
      />
      <StatCard
        icon={<Type className="h-4 w-4" />}
        label={t("cabinet.dashboard.statChars")}
        value={(stats?.charsToday ?? 0).toLocaleString(loc)}
      />
      <StatCard
        icon={<CalendarDays className="h-4 w-4" />}
        label={t("cabinet.dashboard.statMember")}
        value={createdAt ? formatDate(createdAt, loc, { dateOnly: true }) : "—"}
      />
    </div>
  );
}
