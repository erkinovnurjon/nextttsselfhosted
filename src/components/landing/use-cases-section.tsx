"use client";

import { GraduationCap, Code2, AudioLines } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

const USE_CASES = [
  { icon: GraduationCap, k: "students" },
  { icon: Code2, k: "devs" },
  { icon: AudioLines, k: "creators" },
];

export function UseCasesSection() {
  const { t } = useI18n();
  return (
    <section id="use-cases" className="mt-28 scroll-mt-24">
      <Reveal>
        <SectionHeading
          kicker={t("landing.useCasesKicker")}
          title={t("landing.useCasesTitle")}
        />
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {USE_CASES.map((u, i) => {
          const Icon = u.icon;
          return (
            <Reveal key={u.k} delay={i * 90}>
              <div className="card-glow h-full p-7 transition-all hover:-translate-y-0.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  {t(`landing.useCases.${u.k}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  {t(`landing.useCases.${u.k}.desc`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
