"use client";

import Link from "next/link";
import { Wallet, ArrowRight, Infinity as InfinityIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BalanceCard({
  unlimited,
  balance,
  spent,
  balancePct,
  loc,
}: {
  unlimited: boolean;
  balance: number;
  spent: number;
  balancePct: number;
  loc: string;
}) {
  const { t } = useI18n();
  return (
    <div className="card-glow p-6 lg:col-span-1">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-accent" />
          {t("cabinet.dashboard.balanceTitle")}
        </h3>
        <Link
          href="/cabinet/balans"
          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
        >
          {t("cabinet.dashboard.balanceTopup")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {unlimited ? (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <InfinityIcon className="h-8 w-8 text-amber-500" />
            <span className="brand-text text-3xl font-semibold">
              {t("cabinet.dashboard.balanceUnlimited")}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-muted">
            <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500" style={{ width: "100%" }} />
          </div>
          <div className="mt-2 text-[11px] text-fg-subtle">
            {t("cabinet.dashboard.balanceUnlimitedHint")}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="brand-text text-3xl font-semibold tabular-nums">
              {balance.toLocaleString(loc)}
            </span>
            <span className="text-sm text-fg-muted">
              {t("cabinet.dashboard.balanceUnit")}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full brand-gradient transition-all"
              style={{ width: `${balancePct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-fg-subtle">
            <span>{t("cabinet.dashboard.balanceHint")}</span>
            <span className="tabular-nums">
              −{spent.toLocaleString(loc)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
