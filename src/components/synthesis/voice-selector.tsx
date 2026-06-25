"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * Sintez sahifasidagi ovoz tanlash gridi.
 * JSX/class'lar sintez/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 * `Voice` id sahifada aniqlangani uchun komponent generic (`Id`).
 */
export function VoiceSelector<Id extends string>({
  voiceList,
  selected,
  onSelect,
  label,
  voiceLabel,
  voiceHint,
}: {
  voiceList: { id: Id; icon: ComponentType<{ className?: string }> }[];
  selected: Id;
  onSelect: (id: Id) => void;
  label: string;
  voiceLabel: (id: Id) => string;
  voiceHint: (id: Id) => string;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {voiceList.map((v) => {
          const Icon = v.icon;
          const active = selected === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                active
                  ? "card-glow border-accent/40"
                  : "border-border bg-bg-subtle/60 hover:bg-bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition",
                    active ? "brand-gradient text-white" : "bg-bg-muted text-fg-subtle"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{voiceLabel(v.id)}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-fg-muted">{voiceHint(v.id)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
