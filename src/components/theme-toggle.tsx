"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      onClick={toggle}
      title={t("theme.toggle")}
      aria-label={t("theme.toggle")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-fg-muted transition hover:bg-bg-muted hover:text-fg",
        className
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
