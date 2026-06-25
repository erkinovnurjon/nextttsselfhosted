"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, AudioLines } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { WaveBars } from "@/components/wave-bars";

export function HeroSection() {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent animate-fade-in">
        <Sparkles className="h-3 w-3" />
        {t("landing.badge")}
      </div>
      <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
        {t("landing.heroTitle")}
        <br />
        <span className="brand-text">{t("landing.heroAccent")}</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-base text-fg-muted sm:text-lg">
        {t("landing.heroSub")}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register"
          className="group inline-flex items-center gap-2 rounded-xl brand-gradient px-6 py-3 text-base font-semibold text-white shadow-glow transition hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          {t("landing.ctaPrimary")}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <a
          href="#features"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-subtle/70 px-5 py-3 text-sm font-medium backdrop-blur-md transition hover:bg-bg-muted"
        >
          {t("landing.ctaSecondary")}
        </a>
      </div>

      {/* Audio preview mock */}
      <div className="mx-auto mt-12 max-w-xl">
        <div className="card-glow flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
            <AudioLines className="h-5 w-5" />
          </span>
          <WaveBars active className="h-9 flex-1" />
          <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent">
            UZ · WAV
          </span>
        </div>
        <p className="mt-3 text-[11px] text-fg-subtle">{t("landing.trustedBy")}</p>
      </div>
    </section>
  );
}
