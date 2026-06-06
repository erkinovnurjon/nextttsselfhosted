"use client";

import { Crown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Premium rol nishonchasi (VIP — oltin, Admin — havorang).
// Cheksiz hisoblar uchun kabinet bo'ylab ishlatiladi.
export function VipBadge({
  role,
  size = "md",
  className,
}: {
  role: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  if (role !== "vip" && role !== "admin") return null;
  const isVip = role === "vip";
  const Icon = isVip ? Crown : ShieldCheck;
  const label = isVip ? "VIP" : "ADMIN";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        isVip
          ? "bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-500 ring-amber-400/40 dark:text-amber-300"
          : "bg-accent/15 text-accent ring-accent/30",
        className
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </span>
  );
}
