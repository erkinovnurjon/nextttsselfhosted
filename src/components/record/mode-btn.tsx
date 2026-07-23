"use client";

import { cn } from "@/lib/utils";

export function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition whitespace-nowrap",
        active ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-muted"
      )}
    >
      {children}
    </button>
  );
}
