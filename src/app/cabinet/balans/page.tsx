"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf } from "@/lib/format";
import { TopUpModal } from "@/components/cabinet/topup-modal";
import { BalanceHero } from "@/components/cabinet/balans/balance-hero";
import { BalanceStats } from "@/components/cabinet/balans/balance-stats";
import { LedgerTable } from "@/components/cabinet/balans/ledger-table";

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.balans.title")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.balans.sub")}</p>
      </div>

      {/* Balance hero */}
      <BalanceHero
        unlimited={unlimited}
        balance={data?.balance ?? 0}
        loc={loc}
        onTopup={() => setModalOpen(true)}
      />

      {/* Granted / spent */}
      <BalanceStats granted={data?.granted ?? 0} spent={data?.spent ?? 0} loc={loc} />

      {/* Top-up note */}
      {!unlimited && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-fg-muted">
          {t("cabinet.balans.topupDesc")}
        </div>
      )}

      {/* Ledger */}
      <LedgerTable ledger={data?.ledger} loc={loc} />

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
