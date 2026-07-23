"use client";

import { Wallet, Plus, Crown, Infinity as InfinityIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BalanceHero({
  unlimited,
  balance,
  loc,
  onTopup,
}: {
  unlimited: boolean;
  balance: number;
  loc: string;
  onTopup: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "card-glow relative overflow-hidden p-7",
        unlimited && "border-amber-400/40"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-70",
          unlimited
            ? "bg-gradient-to-br from-amber-400/15 via-transparent to-yellow-500/10"
            : "bg-app-gradient"
        )}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            {unlimited ? (
              <Crown className="h-4 w-4 text-amber-500" />
            ) : (
              <Wallet className="h-4 w-4 text-accent" />
            )}
            {t("cabinet.balans.current")}
          </div>
          {unlimited ? (
            <div className="mt-2 flex items-center gap-2">
              <InfinityIcon className="h-12 w-12 text-amber-500" />
              <span className="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                {t("cabinet.balans.unlimited")}
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="brand-text text-5xl font-bold tracking-tight tabular-nums">
                {balance.toLocaleString(loc)}
              </span>
              <span className="text-sm font-medium text-fg-muted">
                {t("cabinet.balans.unit")}
              </span>
            </div>
          )}
          <p className="mt-2 max-w-sm text-xs text-fg-subtle">
            {unlimited ? t("cabinet.balans.vipNote") : t("cabinet.balans.hint")}
          </p>
        </div>

        {!unlimited && (
          <button
            onClick={onTopup}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("cabinet.balans.topupOpen")}
          </button>
        )}
      </div>
    </div>
  );
}
