"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { localeOf, formatDate } from "@/lib/format";
import { isUnlimited, isVip } from "@/lib/role";
import { VipHero } from "@/components/cabinet/sozlamalar/vip-hero";
import { ProfileSection } from "@/components/cabinet/sozlamalar/profile-section";
import { PreferencesSection } from "@/components/cabinet/sozlamalar/preferences-section";

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
  const unlimited = isUnlimited(user?.role);
  const vip = isVip(user?.role);
  const roleLabel =
    user?.role === "admin"
      ? t("cabinet.sozlamalar.roleAdmin")
      : user?.role === "vip"
      ? t("cabinet.sozlamalar.roleVip")
      : t("cabinet.sozlamalar.roleUser");

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cabinet.sozlamalar.title")}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.sozlamalar.sub")}</p>
      </div>

      {/* VIP / Admin premium hero */}
      {unlimited && <VipHero t={t} role={user?.role} vip={vip} />}

      {/* Profile */}
      <ProfileSection
        t={t}
        role={user?.role}
        vip={vip}
        initial={initial}
        name={user?.name}
        email={user?.email}
        memberSince={user ? formatDate(user.createdAt, loc, { dateOnly: true }) : "—"}
        roleLabel={roleLabel}
      />

      {/* Preferences */}
      <PreferencesSection
        t={t}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
      />

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
