"use client";

import Link from "next/link";
import { AudioLines, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

interface RecentItem {
  id: string;
  text: string;
  voice: string;
  charCount: number;
  durationSec: number | null;
  createdAt: string;
}

export function RecentList({
  recent,
  loc,
}: {
  recent: RecentItem[] | undefined;
  loc: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("cabinet.dashboard.recentTitle")}</h3>
        {(recent?.length ?? 0) > 0 && (
          <Link
            href="/cabinet/tarix"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {t("cabinet.dashboard.viewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {!recent || recent.length === 0 ? (
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
          {recent.map((s) => (
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
  );
}
