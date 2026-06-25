"use client";

import Link from "next/link";
import { AudioLines } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
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
  );
}
