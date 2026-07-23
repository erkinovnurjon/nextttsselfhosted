"use client";

import {
  Mic2,
  Globe2,
  ShieldCheck,
  Code2,
  Zap,
  Mic,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

const FEATURES = [
  { icon: Globe2, k: "lang" },
  { icon: Mic2, k: "voices" },
  { icon: Zap, k: "fast" },
  { icon: ShieldCheck, k: "secure" },
  { icon: Mic, k: "mic" },
  { icon: Code2, k: "api" },
];

export function FeaturesSection() {
  const { t } = useI18n();
  return (
    <section id="features" className="mt-28 scroll-mt-24">
      <Reveal>
        <SectionHeading
          kicker={t("landing.featuresKicker")}
          title={t("landing.featuresTitle")}
        />
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <Reveal key={f.k} delay={(i % 3) * 80}>
              <div className="card group h-full p-6 transition-all hover:-translate-y-0.5 hover:border-accent/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent transition group-hover:brand-gradient group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">
                  {t(`landing.features.${f.k}.title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                  {t(`landing.features.${f.k}.desc`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
