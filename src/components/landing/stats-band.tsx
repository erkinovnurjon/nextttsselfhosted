"use client";

import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";

const STATS = [
  { v: "3", k: "langs" },
  { v: "100%", k: "hosted" },
  { v: "WAV", k: "export" },
  { v: "REST", k: "api" },
];

export function StatsBand() {
  const { t } = useI18n();
  return (
    <Reveal className="mt-16">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.k}
            className="card flex flex-col items-center justify-center px-4 py-6 text-center"
          >
            <div className="brand-text text-3xl font-bold tracking-tight sm:text-4xl">
              {s.v}
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              {t(`landing.stats.${s.k}`)}
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
