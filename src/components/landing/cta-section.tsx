"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";

export function CtaSection() {
  const { t } = useI18n();
  return (
    <section className="mt-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-bg-subtle/60 p-10 text-center backdrop-blur-md sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-80" />
          <div className="relative space-y-5">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              {t("landing.ctaTitle")}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-fg-muted sm:text-base">
              {t("landing.ctaSub")}
            </p>
            <div className="flex justify-center pt-1">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl brand-gradient px-7 py-3.5 text-base font-semibold text-white shadow-glow transition hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                {t("landing.ctaButton")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
