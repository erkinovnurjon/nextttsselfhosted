"use client";

import type { TFunc } from "@/lib/i18n";
import { WaveBars } from "@/components/wave-bars";

export function Hero({ t, busy }: { t: TFunc; busy: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-subtle/50 px-6 py-8 text-center backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-70" />
      <div className="relative space-y-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("cabinet.transkripsiya.title")}
        </h2>
        <p className="text-sm text-fg-muted">{t("cabinet.transkripsiya.sub")}</p>
        <WaveBars active={busy} className="h-11" />
      </div>
    </div>
  );
}
