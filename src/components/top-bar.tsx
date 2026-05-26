"use client";

import { Moon, Sun, Mic, Download, Activity, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Dataset boshqaruvi va statistika" },
  "/voice-lab": { title: "Voice Lab", subtitle: "TTS versiyalarini A/B sinash" },
  "/status": { title: "Training holati", subtitle: "GPU progress, loss, checkpoint'lar" },
  "/record": { title: "Batch yozish", subtitle: "Yangi audio yozuvlar" },
};

export function TopBar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark" | null) ?? "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  const matched = Object.entries(PAGE_TITLES).find(([href]) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  );
  const { title, subtitle } = matched
    ? matched[1]
    : { title: "NextTTS", subtitle: "" };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight truncate">{title}</div>
          <div className="text-[11px] text-fg-subtle leading-tight truncate">
            {subtitle}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/voice-lab"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-bg-muted transition"
          >
            <Sparkles className="h-3 w-3" />
            Voice Lab
          </Link>
          <Link
            href="/status"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-bg-muted transition"
          >
            <Activity className="h-3 w-3" />
            Status
          </Link>
          <Link
            href="/record"
            className="flex items-center gap-1.5 rounded-md bg-danger px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 transition"
          >
            <Mic className="h-3 w-3" />
            Yozish
          </Link>
          <a
            href="/api/export"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-bg-muted transition"
            title="metadata.csv eksport"
          >
            <Download className="h-3 w-3" />
            Eksport
          </a>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-border p-1.5 hover:bg-bg-muted transition"
            title="Mavzu almashtirish"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
