"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  AudioLines,
  Mic,
  Users,
  History,
  Settings,
  Menu,
  X,
  LogOut,
  Database,
  FlaskConical,
  GitCompare,
  Activity,
  BookText,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Backdrop } from "@/components/backdrop";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangSwitcher } from "@/components/lang-switcher";
import { localeOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: LucideIcon;
  key: string; // i18n key under cabinet.nav
}

const MAIN_NAV: NavItem[] = [
  { href: "/cabinet", icon: LayoutDashboard, key: "dashboard" },
  { href: "/cabinet/sintez", icon: AudioLines, key: "sintez" },
  { href: "/cabinet/transkripsiya", icon: Mic, key: "transkripsiya" },
  { href: "/cabinet/ovozlar", icon: Users, key: "ovozlar" },
  { href: "/cabinet/tarix", icon: History, key: "tarix" },
  { href: "/cabinet/balans", icon: Wallet, key: "balans" },
  { href: "/cabinet/sozlamalar", icon: Settings, key: "sozlamalar" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/dataset", icon: Database, key: "dataset" },
  { href: "/voice-lab", icon: FlaskConical, key: "voiceLab" },
  { href: "/compare", icon: GitCompare, key: "compare" },
  { href: "/status", icon: Activity, key: "status" },
  { href: "/docs", icon: BookText, key: "docs" },
];

export function CabinetShell({
  user,
  children,
}: {
  user: { name: string | null; email: string | null; role: string };
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const loc = localeOf(lang);

  useEffect(() => setOpen(false), [pathname]);

  // Balansni topbar uchun yuklash (sahifa o'zgarganda + sintezdan keyin)
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/credits?limit=1")
        .then((r) => r.json())
        .then((d) => {
          if (active && typeof d?.balance === "number") setBalance(d.balance);
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("nexttts:credits-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("nexttts:credits-changed", refresh);
    };
  }, [pathname]);

  const isAdmin = user.role === "admin";

  const isActive = (href: string) =>
    href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(href);

  // Joriy sahifa sarlavhasi (topbar uchun)
  const current =
    MAIN_NAV.find((n) => isActive(n.href)) ?? ADMIN_NAV.find((n) => isActive(n.href));
  const title = current ? t(`cabinet.nav.${current.key}`) : t("common.appName");

  const initial = (user.name || user.email || "?")[0].toUpperCase();

  const SidebarBody = (
    <div className="relative flex h-full flex-col">
      {/* Nozik gradient tusi — panel foni ustida, kontent ostida */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent/10 via-transparent to-accent-2/5"
      />

      {/* Brend */}
      <Link href="/cabinet" className="group flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white shadow-glow transition-transform duration-200 group-hover:scale-105">
          <AudioLines className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[16px] font-semibold tracking-tight">
          Next<span className="brand-text">TTS</span>
        </span>
      </Link>

      {/* Yangi sintez CTA */}
      <div className="px-3 pb-1">
        <Link
          href="/cabinet/sintez"
          className="group flex items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2.5 text-[13px] font-semibold text-white shadow-glow ring-1 ring-inset ring-white/15 transition hover:opacity-95 hover:shadow-[0_4px_20px_rgb(var(--accent)/0.5)]"
        >
          <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          {t("cabinet.topbar.new")}
        </Link>
      </div>

      <div className="mx-4 my-2.5 h-px bg-border/50" />

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-2">
        <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {t("cabinet.sidebar.main")}
        </div>
        <div className="space-y-1">
          {MAIN_NAV.map((n) => (
            <NavLink key={n.href} item={n} active={isActive(n.href)} label={t(`cabinet.nav.${n.key}`)} />
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              {t("cabinet.nav.adminSection")}
              <span className="h-px flex-1 bg-border/50" />
            </div>
            <div className="space-y-1">
              {ADMIN_NAV.map((n) => (
                <NavLink key={n.href} item={n} active={isActive(n.href)} label={t(`cabinet.nav.${n.key}`)} />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-border/50 p-3">
        <div className="group flex items-center gap-2.5 rounded-2xl border border-border/60 bg-bg-muted/30 px-2.5 py-2 transition hover:border-accent/30 hover:bg-bg-muted/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full brand-gradient text-[13px] font-semibold text-white shadow-glow ring-2 ring-bg-subtle">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {user.name || user.email?.split("@")[0]}
            </div>
            <div className="truncate text-[11px] text-fg-subtle">{user.email}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title={t("common.signOut")}
            className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/60 bg-bg-subtle/70 backdrop-blur-xl lg:block">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border/60 bg-bg-subtle/95 backdrop-blur-xl animate-fade-in">
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-border p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/cabinet/balans"
              title={t("cabinet.balans.current")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-bg-subtle/60 px-2.5 text-[12px] font-medium text-fg transition hover:border-accent/30 hover:bg-bg-muted"
            >
              <Wallet className="h-4 w-4 text-accent" />
              <span className="tabular-nums">
                {balance === null ? "…" : balance.toLocaleString(loc)}
              </span>
            </Link>
            <LangSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>

      {/* Mobile close button when drawer open handled above */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed right-4 top-3.5 z-[60] rounded-xl border border-border bg-bg-subtle p-2 text-fg-muted lg:hidden"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
  label,
}: {
  item: NavItem;
  active: boolean;
  label: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl py-2 pl-3 pr-2.5 text-[13px] font-medium transition-all duration-200",
        active
          ? "bg-gradient-to-r from-accent/15 via-accent/5 to-transparent text-fg"
          : "text-fg-muted hover:bg-bg-muted/70 hover:text-fg"
      )}
    >
      {/* Faol/hover chap indikator */}
      <span
        className={cn(
          "absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-full brand-gradient transition-all duration-200",
          active ? "h-5 opacity-100" : "h-3 opacity-0 group-hover:opacity-40"
        )}
      />
      {/* Ikona chip */}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
          active
            ? "brand-gradient text-white shadow-[0_2px_10px_rgb(var(--accent)/0.45)]"
            : "bg-bg-muted/70 text-fg-subtle group-hover:bg-bg-muted group-hover:text-fg"
        )}
      >
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
