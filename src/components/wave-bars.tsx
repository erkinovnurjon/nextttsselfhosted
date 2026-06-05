"use client";

import { cn } from "@/lib/utils";

/**
 * Audio to'lqin vizualizatori — TTS uchun signature element.
 * active=true bo'lsa bar'lar animatsiyalanadi (sintez/ijro paytida).
 */
export function WaveBars({
  active = false,
  count = 28,
  className,
}: {
  active?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        // Markazga yaqin bar'lar balandroq — tabiiy to'lqin shakli
        const dist = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2);
        const base = 0.3 + (1 - dist) * 0.7;
        return (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full brand-gradient origin-center",
              active ? "animate-[wave_0.9s_ease-in-out_infinite]" : ""
            )}
            style={{
              height: `${Math.round(base * 40)}px`,
              animationDelay: `${(i % 7) * 0.08}s`,
              opacity: active ? 1 : 0.35,
              transform: active ? undefined : `scaleY(${0.3 + (1 - dist) * 0.5})`,
            }}
          />
        );
      })}
    </div>
  );
}
