"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  User,
  Mail,
  ShieldCheck,
  CalendarDays,
  Languages,
  Palette,
  Sun,
  Moon,
  LogOut,
  Loader2,
} from "lucide-react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { localeOf, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MeUser {
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

export default function SozlamalarPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const loc = localeOf(lang);

  useEffect(() => {
    fetch("/api/me?limit=1")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-fg-subtle">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const initial = (user?.name || user?.email || "?")[0].toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.sozlamalar.title")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.sozlamalar.sub")}</p>
      </div>

      {/* Profile */}
      <section className="card p-6">
        <h3 className="text-sm font-semibold">{t("cabinet.sozlamalar.profileTitle")}</h3>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient text-xl font-semibold text-white shadow-glow">
            {initial}
          </span>
          <div>
            <div className="text-lg font-semibold">{user?.name}</div>
            <div className="text-sm text-fg-muted">{user?.email}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow icon={<User className="h-4 w-4" />} label={t("cabinet.sozlamalar.name")} value={user?.name ?? "—"} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label={t("cabinet.sozlamalar.email")} value={user?.email ?? "—"} />
          <InfoRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label={t("cabinet.sozlamalar.role")}
            value={user?.role === "admin" ? t("cabinet.sozlamalar.roleAdmin") : t("cabinet.sozlamalar.roleUser")}
          />
          <InfoRow
            icon={<CalendarDays className="h-4 w-4" />}
            label={t("cabinet.sozlamalar.memberSince")}
            value={user ? formatDate(user.createdAt, loc, { dateOnly: true }) : "—"}
          />
        </div>
      </section>

      {/* Preferences */}
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

      {/* Danger zone */}
      <section className="card border-danger/30 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-danger">{t("cabinet.sozlamalar.dangerTitle")}</h3>
            <p className="mt-0.5 text-xs text-fg-muted">{t("cabinet.sozlamalar.dangerDesc")}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/15"
          >
            <LogOut className="h-4 w-4" />
            {t("cabinet.sozlamalar.signOut")}
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg/40 p-3">
      <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
