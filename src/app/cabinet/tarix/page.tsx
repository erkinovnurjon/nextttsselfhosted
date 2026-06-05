"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AudioLines, History, ArrowRight, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf, formatDate, formatDuration } from "@/lib/format";

interface Item {
  id: string;
  text: string;
  voice: string;
  charCount: number;
  durationSec: number | null;
  createdAt: string;
}

export default function TarixPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const loc = localeOf(lang);

  useEffect(() => {
    fetch("/api/me?limit=200")
      .then((r) => r.json())
      .then((d) => setItems(d.recent ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-fg-subtle">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.tarix.title")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t("cabinet.tarix.sub")}</p>
        </div>
        {items && items.length > 0 && (
          <span className="text-xs text-fg-subtle">
            {t("cabinet.tarix.total", { n: items.length })}
          </span>
        )}
      </div>

      {!items || items.length === 0 ? (
        <div className="card p-12 text-center">
          <History className="mx-auto mb-3 h-9 w-9 text-fg-subtle opacity-50" />
          <p className="text-sm font-medium">{t("cabinet.tarix.empty")}</p>
          <p className="mt-1 text-xs text-fg-muted">{t("cabinet.tarix.emptyHint")}</p>
          <Link
            href="/cabinet/sintez"
            className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            {t("cabinet.dashboard.recentStart")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-bg-subtle/60 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  <th className="px-4 py-3">{t("cabinet.tarix.colText")}</th>
                  <th className="px-4 py-3">{t("cabinet.tarix.colVoice")}</th>
                  <th className="px-4 py-3 text-right">{t("cabinet.tarix.colChars")}</th>
                  <th className="px-4 py-3 text-right">{t("cabinet.tarix.colDuration")}</th>
                  <th className="px-4 py-3 text-right">{t("cabinet.tarix.colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/40 transition last:border-0 hover:bg-bg-muted/40"
                  >
                    <td className="max-w-md px-4 py-3">
                      <span className="line-clamp-1">{s.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] text-accent">
                        {s.voice}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                      {s.charCount.toLocaleString(loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                      {formatDuration(s.durationSec)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] text-fg-subtle">
                      {formatDate(s.createdAt, loc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {items.map((s) => (
              <div key={s.id} className="card flex items-start gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-fg-subtle">
                  <AudioLines className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{s.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-fg-subtle">
                    <span className="rounded-full bg-accent/12 px-1.5 py-0.5 text-accent">
                      {s.voice}
                    </span>
                    <span>{s.charCount.toLocaleString(loc)}</span>
                    <span>{formatDuration(s.durationSec)}</span>
                    <span>{formatDate(s.createdAt, loc)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
