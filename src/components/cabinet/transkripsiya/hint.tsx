"use client";

import { Info } from "lucide-react";
import type { TFunc } from "@/lib/i18n";

export function Hint({ t }: { t: TFunc }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-fg-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{t("cabinet.transkripsiya.hint")}</span>
    </div>
  );
}
