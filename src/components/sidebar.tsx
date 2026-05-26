"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mic2,
  Sparkles,
  Activity,
  Settings2,
  ExternalLink,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    group: "Asosiy",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, hint: "Dataset va statistika" },
      { href: "/voice-lab", label: "Voice Lab", icon: Sparkles, hint: "Versiyalarni A/B sinash" },
      { href: "/status", label: "Training holati", icon: Activity, hint: "GPU progress, loss" },
    ],
  },
  {
    group: "Yozish",
    items: [
      { href: "/record", label: "Batch yozish", icon: Mic2, hint: "Yangi audio yozuvlar" },
    ],
  },
  {
    group: "Tizim",
    items: [
      { href: "/api/export", label: "metadata.csv", icon: ExternalLink, hint: "Eksport", external: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-bg-subtle">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg">
          <Waves className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">NextTTS</div>
          <div className="text-[10px] text-fg-subtle">Self-hosted TTS · Uzbek</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
              {group.group}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
              const isExternal = "external" in item && item.external;
              const className = cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
                active
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-fg-muted hover:bg-bg-muted hover:text-fg"
              );
              return isExternal ? (
                <a key={item.href} href={item.href} className={className}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1">{item.label}</span>
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={className}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[10px] text-fg-subtle space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3 w-3" />
          MVP · v0.1.0
        </div>
        <div>github.com/erkinovnurjon/nextttsselfhosted</div>
      </div>
    </aside>
  );
}
