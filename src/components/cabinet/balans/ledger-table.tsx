"use client";

import {
  Plus,
  Gift,
  AudioLines,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Ledger {
  id: string;
  amount: number;
  reason: string;
  balanceAfter: number;
  meta: string | null;
  createdAt: string;
}

const REASON_ICON: Record<string, typeof Gift> = {
  signup: Gift,
  synthesis: AudioLines,
  topup: Plus,
  admin: Sparkles,
};

export function LedgerTable({
  ledger,
  loc,
}: {
  ledger: Ledger[] | undefined;
  loc: string;
}) {
  const { t } = useI18n();

  const reasonLabel = (r: string) =>
    t(`cabinet.balans.reasons.${r}`) === `cabinet.balans.reasons.${r}`
      ? r
      : t(`cabinet.balans.reasons.${r}`);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("cabinet.balans.ledgerTitle")}</h3>
      {!ledger || ledger.length === 0 ? (
        <div className="card p-10 text-center text-sm text-fg-muted">
          {t("cabinet.balans.ledgerEmpty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-bg-subtle/60 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-3">{t("cabinet.balans.colReason")}</th>
                <th className="px-4 py-3 text-right">{t("cabinet.balans.colAmount")}</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  {t("cabinet.balans.colBalance")}
                </th>
                <th className="px-4 py-3 text-right">{t("cabinet.balans.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => {
                const Icon = REASON_ICON[e.reason] ?? Sparkles;
                const positive = e.amount > 0;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border/40 transition last:border-0 hover:bg-bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            positive ? "bg-success/12 text-success" : "bg-bg-muted text-fg-subtle"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium">{reasonLabel(e.reason)}</span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-semibold tabular-nums",
                        positive ? "text-success" : "text-fg"
                      )}
                    >
                      {positive ? "+" : ""}
                      {e.amount.toLocaleString(loc)}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-fg-muted sm:table-cell">
                      {e.balanceAfter.toLocaleString(loc)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-fg-subtle">
                      {formatDate(e.createdAt, loc)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
