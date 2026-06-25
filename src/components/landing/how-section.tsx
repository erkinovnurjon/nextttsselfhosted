"use client";

import { PenLine, Sparkles, Headphones } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

const STEPS = [
  { icon: PenLine, k: "step1" },
  { icon: Sparkles, k: "step2" },
  { icon: Headphones, k: "step3" },
];

export function HowSection() {
  const { t } = useI18n();
  return (
    <section id="how" className="mt-28 scroll-mt-24">
      <Reveal>
        <SectionHeading
          kicker={t("landing.howKicker")}
          title={t("landing.howTitle")}
        />
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.k} delay={i * 90}>
              <div className="relative h-full card p-7">
                <span className="absolute right-5 top-5 text-4xl font-bold text-fg/5">
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">
                  {t(`landing.how.${s.k}.title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                  {t(`landing.how.${s.k}.desc`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
