"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangSwitcher } from "@/components/lang-switcher";
import { cn } from "@/lib/utils";

// Landing uchun marketing header — app navbar'dan alohida.
export function SiteHeader() {
  const { t } = useI18n();
  const { status } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { href: "#features", label: t("landing.nav.features") },
    { href: "#use-cases", label: t("landing.nav.useCases") },
    { href: "#how", label: t("landing.nav.how") },
    { href: "#faq", label: t("landing.nav.faq") },
  ];

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border px-3 py-2 transition-all sm:px-4",
          scrolled
            ? "border-border/80 bg-bg-subtle/80 shadow-soft backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        {/* Brend */}
        <Link href="/" className="flex shrink-0 items-center gap-2 pl-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
            <AudioLines className="h-[17px] w-[17px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Next<span className="brand-text">TTS</span>
          </span>
        </Link>

        {/* Markaziy nav */}
        <nav className="mx-auto hidden items-center gap-1 md:flex">
          {navItems.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] text-fg-muted transition hover:bg-bg-muted hover:text-fg"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* Amallar */}
        <div className="ml-auto flex items-center gap-1.5">
          <LangSwitcher />
          <ThemeToggle />
          {status === "authenticated" ? (
            <Link
              href="/cabinet"
              className="inline-flex items-center rounded-xl brand-gradient px-3.5 py-2 text-[12px] font-semibold text-white shadow-glow transition hover:opacity-90"
            >
              {t("common.openCabinet")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden items-center rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg sm:inline-flex"
              >
                {t("common.signIn")}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center rounded-xl brand-gradient px-3.5 py-2 text-[12px] font-semibold text-white shadow-glow transition hover:opacity-90"
              >
                {t("common.signUp")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
