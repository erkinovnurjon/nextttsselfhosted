"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  Mic2,
  Globe2,
  ShieldCheck,
  Code2,
  GraduationCap,
  ArrowRight,
  Zap,
  AudioLines,
  Mic,
  PenLine,
  Headphones,
  Plus,
  Minus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Backdrop } from "@/components/backdrop";
import { SiteHeader } from "@/components/site-header";
import { WaveBars } from "@/components/wave-bars";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const { t } = useI18n();

  const FEATURES = [
    { icon: Globe2, k: "lang" },
    { icon: Mic2, k: "voices" },
    { icon: Zap, k: "fast" },
    { icon: ShieldCheck, k: "secure" },
    { icon: Mic, k: "mic" },
    { icon: Code2, k: "api" },
  ];

  const USE_CASES = [
    { icon: GraduationCap, k: "students" },
    { icon: Code2, k: "devs" },
    { icon: AudioLines, k: "creators" },
  ];

  const STEPS = [
    { icon: PenLine, k: "step1" },
    { icon: Sparkles, k: "step2" },
    { icon: Headphones, k: "step3" },
  ];

  const STATS = [
    { v: "3", k: "langs" },
    { v: "100%", k: "hosted" },
    { v: "WAV", k: "export" },
    { v: "REST", k: "api" },
  ];

  const FAQ = ["q1", "q2", "q3", "q4", "q5"];

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <SiteHeader />

      <main className="relative mx-auto max-w-6xl px-4 pb-24">
        {/* ─────────── Hero ─────────── */}
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

        {/* ─────────── Stats band ─────────── */}
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

        {/* ─────────── Features ─────────── */}
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

        {/* ─────────── Use cases ─────────── */}
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

        {/* ─────────── How it works ─────────── */}
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

        {/* ─────────── FAQ ─────────── */}
        <section id="faq" className="mt-28 scroll-mt-24">
          <Reveal>
            <SectionHeading
              kicker={t("landing.faqKicker")}
              title={t("landing.faqTitle")}
              sub={t("landing.faqSub")}
            />
          </Reveal>
          <div className="mx-auto mt-10 max-w-2xl space-y-3">
            {FAQ.map((id, i) => (
              <Reveal key={id} delay={i * 50}>
                <FaqItem
                  q={t(`landing.faq.${id}.q`)}
                  a={t(`landing.faq.${id}.a`)}
                  defaultOpen={i === 0}
                />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─────────── CTA ─────────── */}
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

        {/* ─────────── Footer ─────────── */}
        <footer className="mt-20 border-t border-border/60 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient text-white">
                <AudioLines className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Next<span className="brand-text">TTS</span>
              </span>
            </Link>
            <p className="text-xs text-fg-subtle">
              {t("landing.footerTagline")}
            </p>
            <p className="text-xs text-fg-subtle">
              © 2026 · {t("landing.footerRights")}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {kicker}
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {sub && <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{sub}</p>}
    </div>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className={cn(
        "card overflow-hidden transition-colors",
        open && "border-accent/30"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{q}</span>
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
            open ? "bg-accent/15 text-accent" : "bg-bg-muted text-fg-subtle"
          )}
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm leading-relaxed text-fg-muted">{a}</p>
        </div>
      </div>
    </div>
  );
}
