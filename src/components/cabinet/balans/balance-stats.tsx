"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BalanceStats({
  granted,
  spent,
  loc,
}: {
  granted: number;
  spent: number;
  loc: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <TrendingUp className="h-4 w-4 text-success" />
          {t("cabinet.balans.granted")}
        </div>
        <div className="mt-1.5 text-2xl font-semibold tabular-nums">
          {granted.toLocaleString(loc)}
        </div>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <TrendingDown className="h-4 w-4 text-danger" />
          {t("cabinet.balans.spent")}
        </div>
        <div className="mt-1.5 text-2xl font-semibold tabular-nums">
          {spent.toLocaleString(loc)}
        </div>
      </div>
    </div>
  );
}
