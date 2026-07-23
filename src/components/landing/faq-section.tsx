"use client";

import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { FaqItem } from "@/components/landing/faq-item";

const FAQ = ["q1", "q2", "q3", "q4", "q5"];

export function FaqSection() {
  const { t } = useI18n();
  return (
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
  );
}
