"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf } from "@/lib/format";
import { BalanceCard } from "@/components/cabinet/dashboard/balance-card";
import { StatGrid } from "@/components/cabinet/dashboard/stat-grid";
import { QuickActions } from "@/components/cabinet/dashboard/quick-actions";
import { RecentList } from "@/components/cabinet/dashboard/recent-list";

interface MeData {
  user: { name: string | null; email: string | null; role: string; createdAt: string };
  unlimited?: boolean;
  usage: { limit: number; charsUsed: number; remaining: number };
  credits: { balance: number; granted: number; spent: number };
  stats: { total: number; today: number; charsToday: number };
  recent: {
    id: string;
    text: string;
    voice: string;
    charCount: number;
    durationSec: number | null;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me?limit=6")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const loc = localeOf(lang);
  const unlimited = data?.unlimited ?? false;
  const balance = data?.credits?.balance ?? 0;
  const granted = data?.credits?.granted ?? 0;
  const spent = data?.credits?.spent ?? 0;
  const balancePct = granted > 0 ? Math.min(100, Math.round((balance / granted) * 100)) : 100;
  const firstName = (data?.user?.name || data?.user?.email?.split("@")[0] || "").split(" ")[0];

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex h-64 items-center justify-center text-fg-subtle">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("cabinet.dashboard.greeting", { name: firstName })}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.dashboard.subtitle")}</p>
      </div>

      {/* Usage + stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Balance card */}
        <BalanceCard
          unlimited={unlimited}
          balance={balance}
          spent={spent}
          balancePct={balancePct}
          loc={loc}
        />

        {/* Stat grid */}
        <StatGrid stats={data?.stats} createdAt={data?.user?.createdAt} loc={loc} />
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Recent */}
      <RecentList recent={data?.recent} loc={loc} />
    </div>
  );
}
