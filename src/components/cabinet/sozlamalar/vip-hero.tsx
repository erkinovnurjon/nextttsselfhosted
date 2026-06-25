"use client";

import { Crown, Check, Infinity as InfinityIcon } from "lucide-react";
import type { TFunc } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { VipBadge } from "@/components/cabinet/vip-badge";

export function VipHero({
  t,
  role,
  vip,
}: {
  t: TFunc;
  role: string | null | undefined;
  vip: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 shadow-glow",
        vip
          ? "border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-bg-subtle to-yellow-500/5"
          : "border-accent/40 bg-gradient-to-br from-accent/10 via-bg-subtle to-accent-2/5"
      )}
    >
      {/* Dekorativ porlash */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl",
          vip ? "bg-amber-400/20" : "bg-accent/20"
        )}
      />
      <div className="relative flex items-start gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow",
            vip
              ? "bg-gradient-to-br from-amber-400 to-yellow-500"
              : "brand-gradient"
          )}
        >
          <Crown className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight">
              {vip ? t("cabinet.sozlamalar.roleVip") : t("cabinet.sozlamalar.roleAdmin")}
            </h3>
            <VipBadge role={role} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {vip ? t("cabinet.sozlamalar.vipDesc") : t("cabinet.sozlamalar.adminDesc")}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-bg/50 px-3 py-2 text-sm">
            <InfinityIcon className={cn("h-4 w-4", vip ? "text-amber-500" : "text-accent")} />
            <span className="font-semibold">{t("cabinet.sozlamalar.unlimited")}</span>
            <span className="text-fg-subtle">·</span>
            <span className="text-fg-muted">{t("cabinet.sozlamalar.vipActive")}</span>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {t("cabinet.sozlamalar.vipPerksTitle")}
            </div>
            <ul className="mt-2 space-y-1.5">
              {[
                t("cabinet.sozlamalar.vipPerk1"),
                t("cabinet.sozlamalar.vipPerk2"),
                t("cabinet.sozlamalar.vipPerk3"),
              ].map((perk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-fg">
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      vip ? "bg-amber-400/20 text-amber-500" : "bg-accent/15 text-accent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
