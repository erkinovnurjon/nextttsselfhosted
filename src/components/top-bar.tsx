"use client";

import { Moon, Sun, Mic, Volume2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Dataset boshqaruvi va statistika" },
  "/sinov": { title: "Sinov", subtitle: "Matn yozing — ovozni eshiting" },
  "/voice-lab": { title: "Voice Lab", subtitle: "Kengaytirilgan checkpoint sinovi" },
  "/compare": { title: "Solishtirish", subtitle: "Namunalar A/B/C yonma-yon" },
  "/status": { title: "Training holati", subtitle: "GPU progress, loss, checkpoint'lar" },
  "/record": { title: "Batch yozish", subtitle: "Yangi audio yozuvlar" },
  "/docs": { title: "Hujjatlar", subtitle: "Qo'llanma va texnik ma'lumot" },
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
  const { title, subtitle } = matched ? matched[1] : { title: "NextTTS", subtitle: "" };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/70 backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight tracking-tight truncate">
            {title}
          </div>
          <div className="text-[11px] text-fg-subtle leading-tight truncate">{subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/sinov"
            className="flex items-center gap-1.5 rounded-lg brand-gradient px-3 py-1.5 text-[12px] font-medium text-white shadow-glow transition hover:opacity-90"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Sinov
          </Link>
          <Link
            href="/record"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          >
            <Mic className="h-3.5 w-3.5" />
            Yozish
          </Link>
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
            title="Mavzu almashtirish"
            aria-label="Mavzu almashtirish"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
