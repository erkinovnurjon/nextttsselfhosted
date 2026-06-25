"use client";

import { Languages, Palette, Sun, Moon } from "lucide-react";
import { LANGS, type Lang, type TFunc } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PreferencesSection({
  t,
  lang,
  setLang,
  theme,
  setTheme,
}: {
  t: TFunc;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: string;
  setTheme: (theme: "light" | "dark") => void;
}) {
  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold">{t("cabinet.sozlamalar.prefsTitle")}</h3>

      {/* Language */}
      <div className="mt-4 flex flex-col gap-3 border-b border-border/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Languages className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium">{t("cabinet.sozlamalar.language")}</div>
            <div className="text-xs text-fg-muted">{t("cabinet.sozlamalar.languageDesc")}</div>
          </div>
        </div>
        <div className="flex rounded-xl border border-border p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Lang)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
                lang === l.code ? "brand-gradient text-white shadow-glow" : "text-fg-muted hover:text-fg"
              )}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Palette className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium">{t("cabinet.sozlamalar.theme")}</div>
            <div className="text-xs text-fg-muted">{t("cabinet.sozlamalar.themeDesc")}</div>
          </div>
        </div>
        <div className="flex rounded-xl border border-border p-1">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
              theme === "light" ? "brand-gradient text-white shadow-glow" : "text-fg-muted hover:text-fg"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            {t("theme.light")}
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
              theme === "dark" ? "brand-gradient text-white shadow-glow" : "text-fg-muted hover:text-fg"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
            {t("theme.dark")}
          </button>
        </div>
      </div>
    </section>
  );
}
