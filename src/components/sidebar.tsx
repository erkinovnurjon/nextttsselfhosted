"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Database,
  Mic2,
  Sparkles,
  Activity,
  ExternalLink,
  AudioLines,
  GitCompare,
  Volume2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    group: "Foydalanuvchi",
    items: [
      { href: "/", label: "Bosh sahifa", icon: Home, hint: "Landing — yangi tashrifchilar uchun" },
      { href: "/sinov", label: "Sinov", icon: Volume2, hint: "Matn → ovoz (eng oddiy)" },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/dataset", label: "Dataset", icon: Database, hint: "Jumlalar va statistika" },
      { href: "/record", label: "Batch yozish", icon: Mic2, hint: "Yangi audio yozuvlar" },
      { href: "/voice-lab", label: "Voice Lab", icon: Sparkles, hint: "Kengaytirilgan sinov" },
      { href: "/compare", label: "Solishtirish", icon: GitCompare, hint: "Namunalar A/B/C" },
      { href: "/status", label: "Training holati", icon: Activity, hint: "GPU progress, loss" },
    ],
  },
  {
    group: "Yordam",
    items: [
      { href: "/docs", label: "Hujjatlar", icon: BookOpen, hint: "Qo'llanma" },
      { href: "/api/export", label: "metadata.csv", icon: ExternalLink, hint: "Eksport", external: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-bg-subtle/60 md:backdrop-blur-sm">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
          <AudioLines className="h-[18px] w-[18px]" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">
            Next<span className="brand-text">TTS</span>
          </div>
          <div className="text-[10px] text-fg-subtle">Self-hosted · O'zbek TTS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6">
        {NAV.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              {group.group}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const isExternal = "external" in item && item.external;
              const className = cn(
                "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all",
                active
                  ? "bg-accent/12 text-accent font-medium"
                  : "text-fg-muted hover:bg-bg-muted hover:text-fg"
              );
              const content = (
                <>
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full brand-gradient" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-fg-subtle group-hover:text-fg")} />
                  <span className="flex-1 truncate">{item.label}</span>
                </>
              );
              return isExternal ? (
                <a key={item.href} href={item.href} className={className}>
                  {content}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4 text-[10px] text-fg-subtle space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          MVP · v0.2.0
        </div>
        <div className="truncate">github.com/erkinovnurjon</div>
      </div>
    </aside>
  );
}
