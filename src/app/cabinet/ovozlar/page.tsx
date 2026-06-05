"use client";

import { useState } from "react";
import { Volume2, Sparkles, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  gender: "ayol" | "erkak";
  hours: number;
}

const FEMALE: Candidate[] = [
  { id: "1187023182", gender: "ayol", hours: 2.9 },
  { id: "146785837", gender: "ayol", hours: 1.7 },
  { id: "1346727794", gender: "ayol", hours: 1.3 },
  { id: "410196918", gender: "ayol", hours: 1.3 },
  { id: "1582694581", gender: "ayol", hours: 1.1 },
  { id: "457807311", gender: "ayol", hours: 0.6 },
];
const MALE: Candidate[] = [
  { id: "862111826", gender: "erkak", hours: 3.5 },
  { id: "881144778", gender: "erkak", hours: 3.0 },
  { id: "536824939", gender: "erkak", hours: 2.4 },
  { id: "911079671", gender: "erkak", hours: 2.1 },
  { id: "125461356", gender: "erkak", hours: 2.0 },
];

export default function OvozlarPage() {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);

  function Card({ c, n }: { c: Candidate; n: number }) {
    const enough = c.hours >= 1.5;
    const active = picked === c.id;
    return (
      <button
        onClick={() => setPicked(c.id)}
        className={cn(
          "w-full rounded-2xl border p-4 text-left transition-all",
          active ? "card-glow border-accent/40" : "border-border bg-bg-subtle/60 hover:bg-bg-muted"
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-[12px] font-semibold text-accent">
            {n}
          </span>
          <span className="text-sm font-semibold">{t("cabinet.ovozlar.voiceN", { n })}</span>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
              c.gender === "ayol" ? "bg-accent-2/15 text-accent-2" : "bg-accent/15 text-accent"
            )}
          >
            {c.gender === "ayol"
              ? t("cabinet.sintez.voices.ayol.label")
              : t("cabinet.sintez.voices.erkak.label")}
          </span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={`/audition/${c.id}.wav`} controls className="h-9 w-full" />
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-subtle">
          {t("cabinet.ovozlar.hours", { h: c.hours })}
          <span>·</span>
          <span className={enough ? "text-success" : "text-warning"}>
            {enough ? t("cabinet.ovozlar.enough") : t("cabinet.ovozlar.notEnough")}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.ovozlar.title")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.ovozlar.sub")}</p>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-fg-muted">
        {t("cabinet.ovozlar.info")}
      </div>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-accent-2" />
          {t("cabinet.ovozlar.femaleTitle")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEMALE.map((c, i) => (
            <Card key={c.id} c={c} n={i + 1} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Volume2 className="h-4 w-4 text-accent" />
          {t("cabinet.ovozlar.maleTitle")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MALE.map((c, i) => (
            <Card key={c.id} c={c} n={i + 7} />
          ))}
        </div>
      </section>

      {picked && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-accent/40 bg-bg-subtle/90 p-4 shadow-glow backdrop-blur-md animate-fade-in">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl brand-gradient text-white">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">
              {t("cabinet.ovozlar.selected")} — ID {picked}
            </div>
            <div className="text-[12px] text-fg-muted">{t("cabinet.ovozlar.selectedHint")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
