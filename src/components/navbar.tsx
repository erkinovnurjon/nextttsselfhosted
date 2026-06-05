"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AudioLines, Moon, Sun, Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

const LINKS = [
  { href: "/sinov", label: "Sinov" },
  { href: "/ovozlar", label: "Ovozlar" },
  { href: "/docs", label: "Hujjatlar" },
];

// Admin-only links — faqat admin foydalanuvchiga ko'rinadi
const ADMIN_LINKS = [
  { href: "/dataset", label: "Dataset" },
  { href: "/voice-lab", label: "Voice Lab" },
  { href: "/compare", label: "Solishtirish" },
  { href: "/status", label: "Status" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [open, setOpen] = useState(false);

  const links = session?.user?.role === "admin" ? [...LINKS, ...ADMIN_LINKS] : LINKS;

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark" | null) ?? "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <header className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-border/80 bg-bg-subtle/70 px-3 py-2 shadow-soft backdrop-blur-xl">
        {/* Brend */}
        <Link href="/sinov" className="flex shrink-0 items-center gap-2 pl-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
            <AudioLines className="h-[17px] w-[17px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Next<span className="brand-text">TTS</span>
          </span>
        </Link>

        {/* Markaziy nav (desktop) */}
        <nav className="mx-auto hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] transition-all",
                isActive(l.href)
                  ? "brand-gradient font-medium text-white shadow-glow"
                  : "text-fg-muted hover:bg-bg-muted hover:text-fg"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Amallar */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
            title="Mavzu almashtirish"
            aria-label="Mavzu"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <UserMenu />
          {/* Mobil menyu tugmasi */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg md:hidden"
            aria-label="Menyu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobil menyu */}
      {open && (
        <nav className="mx-auto mt-2 max-w-5xl rounded-2xl border border-border/80 bg-bg-subtle/90 p-2 shadow-soft backdrop-blur-xl md:hidden animate-fade-in">
          <div className="grid grid-cols-2 gap-1.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-[13px] transition",
                  isActive(l.href)
                    ? "brand-gradient font-medium text-white"
                    : "text-fg-muted hover:bg-bg-muted hover:text-fg"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
