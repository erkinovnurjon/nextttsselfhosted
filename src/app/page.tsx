import { Backdrop } from "@/components/backdrop";
import { SiteHeader } from "@/components/site-header";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsBand } from "@/components/landing/stats-band";
import { FeaturesSection } from "@/components/landing/features-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { HowSection } from "@/components/landing/how-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <SiteHeader />

      <main className="relative mx-auto max-w-6xl px-4 pb-24">
        {/* ─────────── Hero ─────────── */}
        <HeroSection />

        {/* ─────────── Stats band ─────────── */}
        <StatsBand />

        {/* ─────────── Features ─────────── */}
        <FeaturesSection />

        {/* ─────────── Use cases ─────────── */}
        <UseCasesSection />

        {/* ─────────── How it works ─────────── */}
        <HowSection />

        {/* ─────────── FAQ ─────────── */}
        <FaqSection />

        {/* ─────────── CTA ─────────── */}
        <CtaSection />

        {/* ─────────── Footer ─────────── */}
        <SiteFooter />
      </main>
    </div>
  );
}
