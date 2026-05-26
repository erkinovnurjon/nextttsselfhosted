"use client";

import { Download, Mic, Moon, Sun, Waves } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = stored ?? "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg">
            <Waves className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">NextTTS</h1>
            <p className="text-xs text-fg-subtle leading-tight">
              Dataset boshqaruv paneli
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/record"
            className="flex items-center gap-2 rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition"
          >
            <Mic className="h-3.5 w-3.5" />
            Batch yozish
          </Link>
          <a
            href="/api/export"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-muted transition"
          >
            <Download className="h-3.5 w-3.5" />
            Eksport (metadata.csv)
          </a>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-border p-1.5 hover:bg-bg-muted transition"
            title="Mavzu almashtirish"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
