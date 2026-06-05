"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  FileText,
  Type,
  CalendarDays,
  AudioLines,
  Users,
  History,
  ArrowRight,
  Wallet,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf, formatDate } from "@/lib/format";

interface MeData {
  user: { name: string | null; email: string | null; role: string; createdAt: string };
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
  const balance = data?.credits?.balance ?? 0;
  const granted = data?.credits?.granted ?? 0;
  const spent = data?.credits?.spent ?? 0;
  const balancePct = granted > 0 ? Math.min(100, Math.round((balance / granted) * 100)) : 100;
  const firstName = (data?.user.name || data?.user.email?.split("@")[0] || "").split(" ")[0];

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
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label={t("cabinet.dashboard.statTotal")}
            value={(data?.stats.total ?? 0).toLocaleString(loc)}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label={t("cabinet.dashboard.statToday")}
            value={(data?.stats.today ?? 0).toLocaleString(loc)}
          />
          <StatCard
            icon={<Type className="h-4 w-4" />}
            label={t("cabinet.dashboard.statChars")}
            value={(data?.stats.charsToday ?? 0).toLocaleString(loc)}
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label={t("cabinet.dashboard.statMember")}
            value={data ? formatDate(data.user.createdAt, loc, { dateOnly: true }) : "—"}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("cabinet.dashboard.quickTitle")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction
            href="/cabinet/sintez"
            icon={<AudioLines className="h-5 w-5" />}
            title={t("cabinet.dashboard.quickSintez")}
            desc={t("cabinet.dashboard.quickSintezDesc")}
            primary
          />
          <QuickAction
            href="/cabinet/ovozlar"
            icon={<Users className="h-5 w-5" />}
            title={t("cabinet.dashboard.quickOvozlar")}
            desc={t("cabinet.dashboard.quickOvozlarDesc")}
          />
          <QuickAction
            href="/cabinet/tarix"
            icon={<History className="h-5 w-5" />}
            title={t("cabinet.dashboard.quickTarix")}
            desc={t("cabinet.dashboard.quickTarixDesc")}
          />
        </div>
      </div>

      {/* Recent */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("cabinet.dashboard.recentTitle")}</h3>
          {(data?.recent.length ?? 0) > 0 && (
            <Link
              href="/cabinet/tarix"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {t("cabinet.dashboard.viewAll")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {!data || data.recent.length === 0 ? (
          <div className="card p-10 text-center">
            <AudioLines className="mx-auto mb-3 h-8 w-8 text-fg-subtle opacity-50" />
            <p className="text-sm text-fg-muted">{t("cabinet.dashboard.recentEmpty")}</p>
            <Link
              href="/cabinet/sintez"
              className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {t("cabinet.dashboard.recentStart")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recent.map((s) => (
              <div key={s.id} className="card flex items-start gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-fg-subtle">
                  <AudioLines className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm">{s.text}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-fg-subtle">
                    <span className="rounded-full bg-accent/12 px-1.5 py-0.5 text-accent">
                      {s.voice}
                    </span>
                    <span>{s.charCount.toLocaleString(loc)}</span>
                    <span>{formatDate(s.createdAt, loc)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 truncate text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/30"
    >
      <div
        className={
          primary
            ? "flex h-11 w-11 items-center justify-center rounded-xl brand-gradient text-white shadow-glow"
            : "flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"
        }
      >
        {icon}
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        <h4 className="text-sm font-semibold">{title}</h4>
        <ArrowRight className="h-3.5 w-3.5 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
      <p className="mt-1 text-xs text-fg-muted">{desc}</p>
    </Link>
  );
}
