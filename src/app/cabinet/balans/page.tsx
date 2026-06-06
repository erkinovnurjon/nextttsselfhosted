"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Gift,
  AudioLines,
  Loader2,
  Sparkles,
  Crown,
  Infinity as InfinityIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TopUpModal } from "@/components/cabinet/topup-modal";

interface Ledger {
  id: string;
  amount: number;
  reason: string;
  balanceAfter: number;
  meta: string | null;
  createdAt: string;
}

interface CreditsData {
  balance: number;
  granted: number;
  spent: number;
  ledger: Ledger[];
  unlimited?: boolean;
}

const REASON_ICON: Record<string, typeof Gift> = {
  signup: Gift,
  synthesis: AudioLines,
  topup: Plus,
  admin: Sparkles,
};

export default function BalansPage() {
  const { t, lang } = useI18n();
  const loc = localeOf(lang);
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    const d = await fetch("/api/credits?limit=100").then((r) => r.json());
    setData(d);
  }

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-fg-subtle">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const unlimited = data?.unlimited ?? false;

  const reasonLabel = (r: string) =>
    t(`cabinet.balans.reasons.${r}`) === `cabinet.balans.reasons.${r}`
      ? r
      : t(`cabinet.balans.reasons.${r}`);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.balans.title")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.balans.sub")}</p>
      </div>

      {/* Balance hero */}
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
                  {(data?.balance ?? 0).toLocaleString(loc)}
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
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("cabinet.balans.topupOpen")}
            </button>
          )}
        </div>
      </div>

      {/* Granted / spent */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <TrendingUp className="h-4 w-4 text-success" />
            {t("cabinet.balans.granted")}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">
            {(data?.granted ?? 0).toLocaleString(loc)}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <TrendingDown className="h-4 w-4 text-danger" />
            {t("cabinet.balans.spent")}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">
            {(data?.spent ?? 0).toLocaleString(loc)}
          </div>
        </div>
      </div>

      {/* Top-up note */}
      {!unlimited && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-fg-muted">
          {t("cabinet.balans.topupDesc")}
        </div>
      )}

      {/* Ledger */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("cabinet.balans.ledgerTitle")}</h3>
        {!data || data.ledger.length === 0 ? (
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
                {data.ledger.map((e) => {
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

      {modalOpen && (
        <TopUpModal
          onClose={() => {
            setModalOpen(false);
            load().catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
